document.addEventListener('DOMContentLoaded', function() {
  const urlPatternInput = document.getElementById('urlPattern');
  const githubRepoInput = document.getElementById('githubRepo');
  const metaTagInput = document.getElementById('metaTagName');
  const jsonPathInput = document.getElementById('jsonPath');
  const addMappingButton = document.getElementById('addMapping');
  const mappingsDiv = document.getElementById('mappings');
  const statusDiv = document.getElementById('status');
  const sourceTypeRadios = document.querySelectorAll('input[name="sourceType"]');
  const jsonOptions = document.getElementById('jsonOptions');
  const htmlOptions = document.getElementById('htmlOptions');
  const exportButton = document.getElementById('exportConfig');
  const importButton = document.getElementById('importConfig');
  const importFileInput = document.getElementById('importFile');

  exportButton.addEventListener('click', exportConfiguration);
  importButton.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importConfiguration);

  sourceTypeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.value === 'json') {
        jsonOptions.style.display = 'block';
        htmlOptions.style.display = 'none';
      } else {
        jsonOptions.style.display = 'none';
        htmlOptions.style.display = 'block';
      }
    });
  });

  loadMappings();

  addMappingButton.addEventListener('click', function() {
    const urlPattern = urlPatternInput.value.trim();
    const githubRepo = normalizeGitHubUrl(githubRepoInput.value.trim());
    const sourceType = document.querySelector('input[name="sourceType"]:checked').value;
    const jsonPath = jsonPathInput.value.trim();
    const metaTag = metaTagInput.value.trim();

    if (!githubRepo) {
      showStatus('Please enter a GitHub repository URL', false);
      return;
    }

    if (!isValidGitHubUrl(githubRepo)) {
      showStatus('Please enter a valid GitHub repository URL', false);
      return;
    }

    if (!urlPattern) {
      showStatus('Please enter a URL pattern', false);
      return;
    }

    if (sourceType === 'json' && !jsonPath) {
      showStatus('Please enter a JSONPath', false);
      return;
    }

    if (sourceType === 'html' && !metaTag) {
      showStatus('Please enter a Meta Tag Name', false);
      return;
    }

    addMapping(githubRepo, urlPattern, sourceType, jsonPath, metaTag);
  });

  function loadMappings() {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = result.urlMappings || {};
      const converted = migrateOldFormat(mappings);
      if (converted !== mappings) {
        chrome.storage.sync.set({ urlMappings: converted }, function() {
          displayMappings(converted);
        });
      } else {
        displayMappings(mappings);
      }
    });
  }

  // Migrate from old pattern-keyed format to new repo-keyed format
  function migrateOldFormat(mappings) {
    if (Object.keys(mappings).length === 0) return mappings;

    // Check if already in new format (values are arrays)
    const firstValue = Object.values(mappings)[0];
    if (Array.isArray(firstValue)) {
      return mappings;
    }

    // Convert old format to new format
    const newMappings = {};
    for (const [pattern, config] of Object.entries(mappings)) {
      const repo = typeof config === 'string' ? config : config.repo;
      const sourceType = typeof config === 'object' ? (config.sourceType || 'json') : 'json';
      const jsonPath = typeof config === 'object' ? (config.jsonPath || '$.version') : '$.version';
      const metaTag = typeof config === 'object' ? (config.metaTag || '') : '';

      if (!newMappings[repo]) {
        newMappings[repo] = [];
      }
      newMappings[repo].push({
        pattern,
        sourceType,
        jsonPath: sourceType === 'json' ? jsonPath : '',
        metaTag: sourceType === 'html' ? metaTag : ''
      });
    }
    return newMappings;
  }

  function displayMappings(mappings) {
    mappingsDiv.innerHTML = '';

    if (Object.keys(mappings).length === 0) {
      mappingsDiv.innerHTML = '<p style="color: #666; font-style: italic;">No mappings configured yet.</p>';
      return;
    }

    for (const [repo, patterns] of Object.entries(mappings)) {
      const repoDiv = document.createElement('div');
      repoDiv.className = 'repo-group';

      const repoHeader = document.createElement('div');
      repoHeader.className = 'repo-header';
      repoHeader.innerHTML = `
        <a href="${repo}" target="_blank" class="repo-url">${repo}</a>
        <button class="delete-repo" data-repo="${repo}">Delete All</button>
      `;
      repoDiv.appendChild(repoHeader);

      const patternsDiv = document.createElement('div');
      patternsDiv.className = 'patterns-list';

      for (const patternConfig of patterns) {
        let sourceInfo = '';
        if (patternConfig.sourceType === 'html' && patternConfig.metaTag) {
          sourceInfo = `<span class="source-info">HTML meta tag name: <span class="source-value">${patternConfig.metaTag}</span></span>`;
        } else {
          sourceInfo = `<span class="source-info">JSONPath: <span class="source-value">${patternConfig.jsonPath || '$.version'}</span></span>`;
        }

        const patternDiv = document.createElement('div');
        patternDiv.className = 'pattern-item';
        patternDiv.innerHTML = `
          <div class="pattern-info">
            <span class="pattern-text">${patternConfig.pattern}</span>
            ${sourceInfo}
          </div>
          <button class="delete-pattern" data-repo="${repo}" data-pattern="${patternConfig.pattern}">×</button>
        `;
        patternsDiv.appendChild(patternDiv);
      }

      repoDiv.appendChild(patternsDiv);
      mappingsDiv.appendChild(repoDiv);
    }

    // Add delete repo event listeners
    document.querySelectorAll('.delete-repo').forEach(button => {
      button.addEventListener('click', function() {
        const repo = this.getAttribute('data-repo');
        deleteRepo(repo);
      });
    });

    // Add delete pattern event listeners
    document.querySelectorAll('.delete-pattern').forEach(button => {
      button.addEventListener('click', function() {
        const repo = this.getAttribute('data-repo');
        const pattern = this.getAttribute('data-pattern');
        deletePattern(repo, pattern);
      });
    });
  }

  function addMapping(githubRepo, urlPattern, sourceType, jsonPath, metaTag) {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = migrateOldFormat(result.urlMappings || {});

      if (!mappings[githubRepo]) {
        mappings[githubRepo] = [];
      }

      // Check for duplicate pattern
      const existingPattern = mappings[githubRepo].find(p => p.pattern === urlPattern);
      if (existingPattern) {
        showStatus('This URL pattern already exists for this repository', false);
        return;
      }

      mappings[githubRepo].push({
        pattern: urlPattern,
        sourceType: sourceType,
        jsonPath: sourceType === 'json' ? jsonPath : '',
        metaTag: sourceType === 'html' ? metaTag : ''
      });

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Mapping added successfully!', true);
        loadMappings();
        urlPatternInput.value = '';
        jsonPathInput.value = '$.version';
        metaTagInput.value = '';
        // Reset to JSON option
        document.querySelector('input[name="sourceType"][value="json"]').checked = true;
        jsonOptions.style.display = 'block';
        htmlOptions.style.display = 'none';
      });
    });
  }

  function deleteRepo(repo) {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = migrateOldFormat(result.urlMappings || {});
      delete mappings[repo];

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Repository removed successfully!', true);
        loadMappings();
      });
    });
  }

  function deletePattern(repo, pattern) {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = migrateOldFormat(result.urlMappings || {});

      if (mappings[repo]) {
        mappings[repo] = mappings[repo].filter(p => p.pattern !== pattern);

        // Remove repo if no patterns left
        if (mappings[repo].length === 0) {
          delete mappings[repo];
        }
      }

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Pattern deleted successfully!', true);
        loadMappings();
      });
    });
  }

  function normalizeGitHubUrl(url) {
    return url.replace(/\/+$/, '');
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

  function exportConfiguration() {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = migrateOldFormat(result.urlMappings || {});
      const json = JSON.stringify({ urlMappings: mappings }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'version-extension-config.json';
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Configuration exported!', true);
    });
  }

  function importConfiguration(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.urlMappings || typeof data.urlMappings !== 'object') {
          showStatus('Invalid configuration file', false);
          return;
        }

        chrome.storage.sync.set({ urlMappings: data.urlMappings }, function() {
          showStatus('Configuration imported!', true);
          loadMappings();
        });
      } catch (err) {
        showStatus('Failed to parse configuration file', false);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  }
});
