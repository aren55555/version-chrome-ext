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
    const selector = `meta[name="${metaTagSelector}"]`;
    const metaTag = document.querySelector(selector);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVersionInfo') {
    chrome.storage.sync.get(['metaTagSelector'], function(result) {
      const versionInfo = inspectPageForVersion(result.metaTagSelector);
      sendResponse(versionInfo);
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'buttonClicked') {
    sendResponse({ success: true });
  }
});

chrome.storage.sync.get(['metaTagSelector'], function(result) {
  const versionInfo = inspectPageForVersion(result.metaTagSelector);
  if (versionInfo.version) {
    chrome.runtime.sendMessage({
      action: 'versionDetected',
      version: versionInfo.version,
      url: window.location.href
    });
  }
});