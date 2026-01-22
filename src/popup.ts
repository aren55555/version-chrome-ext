import { parseUrlMappings, PatternConfig, UrlMappings } from './schemas';

interface VersionInfo {
  version: string | null;
  source: 'json' | 'meta' | null;
  urlMatched?: boolean;
  expectedSource?: 'json' | 'html' | null;
  expectedSelector?: string | null;
}

document.addEventListener('DOMContentLoaded', function() {
  const statusText = document.getElementById('statusText')!;
  const githubLinkContainer = document.getElementById('githubLinkContainer')!;
  const githubLink = document.getElementById('githubLink') as HTMLAnchorElement;
  const settingsButton = document.getElementById('settingsButton')!;

  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id!, {action: 'getVersionInfo'}, function(response: VersionInfo | undefined) {
      if (chrome.runtime.lastError) {
        statusText.textContent = 'No URL pattern matched for this page';
        statusText.className = 'no-version';
        return;
      }

      if (response && response.version) {
        displayVersionInfo(response.version, response.source);
      } else if (response && response.urlMatched) {
        const sourceHint = response.expectedSource === 'html'
          ? `meta tag: ${response.expectedSelector}`
          : `JSON path: ${response.expectedSelector}`;
        statusText.textContent = `URL matched, but no version found in ${sourceHint}`;
        statusText.className = 'no-version';
      } else if (response && response.source === 'json') {
        statusText.textContent = 'JSON page found, but no "version" field detected';
        statusText.className = 'no-version';
      } else {
        statusText.textContent = 'No URL pattern configured for this page';
        statusText.className = 'no-version';
      }
    });
  });

  function displayVersionInfo(version: string, source: 'json' | 'meta' | null): void {
    const sourceLabel = source === 'meta' ? 'from meta tag' : 'from JSON';
    statusText.innerHTML = `<div class="version">
      <span class="version-detected">Version detected ${sourceLabel}:</span>
      <code>${version}</code>
    </div>`;

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url!;

      chrome.storage.sync.get(['urlMappings'], function(result) {
        const mappings = parseUrlMappings(result.urlMappings);
        const matchingRepo = findMatchingRepo(currentUrl, mappings);

        if (matchingRepo) {
          const commitUrl = `${matchingRepo}/commit/${version}`;
          githubLink.href = commitUrl;
          githubLinkContainer.style.display = 'block';
        } else {
          statusText.innerHTML += '<br><div class="error">No GitHub repository configured for this URL. Add a mapping in settings.</div>';
        }
      });
    });
  }

  function findMatchingRepo(url: string, mappings: UrlMappings): string | null {
    for (const [repo, patterns] of Object.entries(mappings)) {
      for (const patternConfig of patterns) {
        if (url.includes(patternConfig.pattern)) {
          return repo;
        }
      }
    }
    return null;
  }
});
