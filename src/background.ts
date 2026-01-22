interface VersionDetectedMessage {
  action: 'versionDetected';
  version: string;
  url: string;
}

chrome.runtime.onMessage.addListener((
  message: VersionDetectedMessage,
  sender: chrome.runtime.MessageSender
) => {
  if (message.action === 'versionDetected' && sender.tab?.id) {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#22c55e' });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});
