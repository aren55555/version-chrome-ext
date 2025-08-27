document.addEventListener('DOMContentLoaded', function() {
  const statusText = document.getElementById('statusText');
  const githubLinkContainer = document.getElementById('githubLinkContainer');
  const githubLink = document.getElementById('githubLink');
  const settingsButton = document.getElementById('settingsButton');
  
  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'getVersionInfo'}, function(response) {
      if (chrome.runtime.lastError) {
        statusText.textContent = 'Unable to check this page';
        statusText.className = 'no-version';
        return;
      }

      if (response && response.version) {
        displayVersionInfo(response.version, response.source);
      } else if (response && response.source === 'json') {
        statusText.textContent = 'JSON page found, but no "version" field detected';
        statusText.className = 'no-version';
      } else {
        statusText.textContent = 'No version info found on this page';
        statusText.className = 'no-version';
      }
    });
  });

  function displayVersionInfo(version, source) {
    const sourceLabel = source === 'meta' ? 'from meta tag' : 'from JSON';
    statusText.innerHTML = `<span class="version-detected">Version detected ${sourceLabel}:</span><br><code>${version}</code>`;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      
      chrome.storage.sync.get(['urlMappings'], function(result) {
        const mappings = result.urlMappings || {};
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

  function findMatchingRepo(url, mappings) {
    for (const [pattern, repo] of Object.entries(mappings)) {
      if (url.includes(pattern)) {
        return repo;
      }
    }
    return null;
  }
});