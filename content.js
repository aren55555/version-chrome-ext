function inspectPageForVersion() {
  let version = null;
  let isJson = false;
  
  try {
    const bodyText = document.body.innerText.trim();
    
    if (bodyText.startsWith('{') || bodyText.startsWith('[')) {
      const jsonData = JSON.parse(bodyText);
      isJson = true;
      
      if (typeof jsonData === 'object' && jsonData !== null && jsonData.version) {
        version = jsonData.version;
      }
    }
  } catch (e) {
    // Not valid JSON, continue normally
  }
  
  return { version, isJson };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVersionInfo') {
    const versionInfo = inspectPageForVersion();
    sendResponse(versionInfo);
  }
  
  if (request.action === 'buttonClicked') {
    sendResponse({ success: true });
  }
});

const versionInfo = inspectPageForVersion();
if (versionInfo.version) {
  chrome.runtime.sendMessage({
    action: 'versionDetected',
    version: versionInfo.version,
    url: window.location.href
  });
}