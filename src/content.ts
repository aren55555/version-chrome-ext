import { parseUrlMappings, PatternConfig, UrlMappings } from './schemas';

interface VersionInfo {
  version: string | null;
  source: 'json' | 'meta' | null;
  urlMatched?: boolean;
  expectedSource?: 'json' | 'html' | null;
  expectedSelector?: string | null;
}

interface ContentMessage {
  action: 'getVersionInfo' | 'buttonClicked';
}

function evaluateJsonPath(data: unknown, jsonPath: string): string | null {
  // Handle simple JSONPath expressions like "$.gitSha" or "$.foo.bar"
  // Strip leading "$." if present
  const path = jsonPath.startsWith('$.') ? jsonPath.slice(2) : jsonPath;
  const parts = path.split('.');

  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : null;
}

function inspectPageForVersion(metaTagSelector: string | null, jsonPath: string | null): VersionInfo {
  let version: string | null = null;
  let source: 'json' | 'meta' | null = null;

  // Try JSON first
  try {
    const bodyText = document.body.innerText.trim();

    if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
      const jsonData = JSON.parse(bodyText);
      source = 'json';

      if (typeof jsonData === 'object' && jsonData !== null) {
        if (jsonPath) {
          // Use configured JSONPath
          version = evaluateJsonPath(jsonData, jsonPath);
        } else {
          // Fall back to default "version" field
          version = typeof jsonData.version === 'string' ? jsonData.version : null;
        }
      }
    }
  } catch {
    // Not valid JSON, continue
  }

  // If no JSON version found and we have a meta tag selector, try that
  if (!version && metaTagSelector) {
    // Try both name and property attributes (some sites use property instead of name)
    const metaTag = document.querySelector(`meta[name="${metaTagSelector}"]`) ||
                    document.querySelector(`meta[property="${metaTagSelector}"]`);
    if (metaTag) {
      const content = metaTag.getAttribute('content');
      if (content) {
        version = content;
        source = 'meta';
      }
    }
  }

  return { version, source };
}

function findConfigForUrl(url: string, mappings: UrlMappings): PatternConfig | null {
  for (const [, patterns] of Object.entries(mappings)) {
    for (const patternConfig of patterns) {
      if (url.includes(patternConfig.pattern)) {
        return patternConfig;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((
  request: ContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: VersionInfo | { success: boolean }) => void
): boolean | undefined => {
  if (request.action === 'getVersionInfo') {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
      const config = findConfigForUrl(window.location.href, mappings);
      const metaTagSelector = config?.sourceType === 'html' ? config.metaTag : null;
      const jsonPath = config?.sourceType === 'json' ? config.jsonPath : null;
      const versionInfo: VersionInfo = inspectPageForVersion(metaTagSelector, jsonPath);
      versionInfo.urlMatched = !!config;
      versionInfo.expectedSource = config ? config.sourceType : null;
      versionInfo.expectedSelector = config
        ? (config.sourceType === 'html' ? config.metaTag : config.jsonPath)
        : null;
      sendResponse(versionInfo);
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'buttonClicked') {
    sendResponse({ success: true });
  }

  return undefined;
});

chrome.storage.sync.get(['urlMappings'], function(result) {
  const mappings = parseUrlMappings(result.urlMappings);
  const config = findConfigForUrl(window.location.href, mappings);
  const metaTagSelector = config?.sourceType === 'html' ? config.metaTag : null;
  const jsonPath = config?.sourceType === 'json' ? config.jsonPath : null;
  const versionInfo = inspectPageForVersion(metaTagSelector, jsonPath);
  if (versionInfo.version) {
    chrome.runtime.sendMessage({
      action: 'versionDetected',
      version: versionInfo.version,
      url: window.location.href
    });
  }
});
