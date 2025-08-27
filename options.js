document.addEventListener('DOMContentLoaded', function() {
  const urlPatternInput = document.getElementById('urlPattern');
  const githubRepoInput = document.getElementById('githubRepo');
  const addMappingButton = document.getElementById('addMapping');
  const mappingsDiv = document.getElementById('mappings');
  const statusDiv = document.getElementById('status');
  const metaTagInput = document.getElementById('metaTagSelector');
  const saveMetaTagButton = document.getElementById('saveMetaTag');

  loadMappings();
  loadMetaTagSelector();

  saveMetaTagButton.addEventListener('click', function() {
    const selector = metaTagInput.value.trim();
    chrome.storage.sync.set({ metaTagSelector: selector }, function() {
      showStatus(selector ? 'Meta tag selector saved!' : 'Meta tag selector cleared!', true);
    });
  });

  addMappingButton.addEventListener('click', function() {
    const urlPattern = urlPatternInput.value.trim();
    const githubRepo = githubRepoInput.value.trim();
    
    if (!urlPattern) {
      showStatus('Please enter a URL pattern', false);
      return;
    }

    if (!githubRepo) {
      showStatus('Please enter a GitHub repository URL', false);
      return;
    }

    if (!isValidGitHubUrl(githubRepo)) {
      showStatus('Please enter a valid GitHub repository URL', false);
      return;
    }

    addMapping(urlPattern, githubRepo);
  });

  function loadMappings() {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = result.urlMappings || {};
      displayMappings(mappings);
    });
  }

  function loadMetaTagSelector() {
    chrome.storage.sync.get(['metaTagSelector'], function(result) {
      if (result.metaTagSelector) {
        metaTagInput.value = result.metaTagSelector;
      }
    });
  }

  function displayMappings(mappings) {
    mappingsDiv.innerHTML = '';
    
    if (Object.keys(mappings).length === 0) {
      mappingsDiv.innerHTML = '<p style="color: #666; font-style: italic;">No mappings configured yet.</p>';
      return;
    }

    for (const [pattern, repo] of Object.entries(mappings)) {
      const mappingDiv = document.createElement('div');
      mappingDiv.className = 'mapping-item';
      mappingDiv.innerHTML = `
        <div class="mapping-info">
          <div class="mapping-pattern">${pattern}</div>
          <div class="mapping-repo">${repo}</div>
        </div>
        <button class="delete-mapping" data-pattern="${pattern}">Delete</button>
      `;
      mappingsDiv.appendChild(mappingDiv);
    }

    // Add delete event listeners
    document.querySelectorAll('.delete-mapping').forEach(button => {
      button.addEventListener('click', function() {
        const pattern = this.getAttribute('data-pattern');
        deleteMapping(pattern);
      });
    });
  }

  function addMapping(urlPattern, githubRepo) {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = result.urlMappings || {};
      mappings[urlPattern] = githubRepo;
      
      chrome.storage.sync.set({
        urlMappings: mappings
      }, function() {
        showStatus('Mapping added successfully!', true);
        loadMappings();
        urlPatternInput.value = '';
        githubRepoInput.value = '';
      });
    });
  }

  function deleteMapping(pattern) {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = result.urlMappings || {};
      delete mappings[pattern];
      
      chrome.storage.sync.set({
        urlMappings: mappings
      }, function() {
        showStatus('Mapping deleted successfully!', true);
        loadMappings();
      });
    });
  }

  function isValidGitHubUrl(url) {
    const githubRegex = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
    return githubRegex.test(url);
  }

  function showStatus(message, isSuccess) {
    statusDiv.textContent = message;
    statusDiv.className = isSuccess ? 'status success' : 'status error';
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});