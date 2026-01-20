function inspectPageForVersion(metaTagSelector) {
  let version = null;
  let source = null;

  // Try JSON first
  try {
    const bodyText = document.body.innerText.trim();

    if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
      const jsonData = JSON.parse(bodyText);
      source = 'json';

      if (typeof jsonData === 'object' && jsonData !== null && jsonData.version) {
        version = jsonData.version;
      }
    }
  } catch (e) {
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

function findConfigForUrl(url, mappings) {
  // Handle new format: repo -> array of patterns
  for (const [repo, patterns] of Object.entries(mappings)) {
    if (Array.isArray(patterns)) {
      for (const patternConfig of patterns) {
        if (url.includes(patternConfig.pattern)) {
          return patternConfig;
        }
      }
    } else {
      // Handle old format for backwards compatibility
      if (url.includes(repo)) {
        return typeof patterns === 'object' ? patterns : null;
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVersionInfo') {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = result.urlMappings || {};
      const config = findConfigForUrl(window.location.href, mappings);
      const metaTagSelector = config ? config.metaTag : null;
      const versionInfo = inspectPageForVersion(metaTagSelector);
      sendResponse(versionInfo);
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'buttonClicked') {
    sendResponse({ success: true });
  }
});

chrome.storage.sync.get(['urlMappings'], function(result) {
  const mappings = result.urlMappings || {};
  const config = findConfigForUrl(window.location.href, mappings);
  const metaTagSelector = config ? config.metaTag : null;
  const versionInfo = inspectPageForVersion(metaTagSelector);
  if (versionInfo.version) {
    chrome.runtime.sendMessage({
      action: 'versionDetected',
      version: versionInfo.version,
      url: window.location.href
    });
  }
});