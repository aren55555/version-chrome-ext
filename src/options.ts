import { parseUrlMappings, parseStorageData, UrlMappings, PatternConfig } from './schemas';

document.addEventListener('DOMContentLoaded', function() {
  const urlPatternInput = document.getElementById('urlPattern') as HTMLInputElement;
  const githubRepoInput = document.getElementById('githubRepo') as HTMLInputElement;
  const metaTagInput = document.getElementById('metaTagName') as HTMLInputElement;
  const jsonPathInput = document.getElementById('jsonPath') as HTMLInputElement;
  const addMappingButton = document.getElementById('addMapping')!;
  const mappingsDiv = document.getElementById('mappings')!;
  const statusDiv = document.getElementById('status')!;
  const sourceTypeRadios = document.querySelectorAll<HTMLInputElement>('input[name="sourceType"]');
  const jsonOptions = document.getElementById('jsonOptions')!;
  const htmlOptions = document.getElementById('htmlOptions')!;
  const exportButton = document.getElementById('exportConfig')!;
  const importButton = document.getElementById('importConfig')!;
  const importFileInput = document.getElementById('importFile') as HTMLInputElement;

  exportButton.addEventListener('click', exportConfiguration);
  importButton.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importConfiguration);

  sourceTypeRadios.forEach(radio => {
    radio.addEventListener('change', function(this: HTMLInputElement) {
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
    const sourceType = (document.querySelector('input[name="sourceType"]:checked') as HTMLInputElement).value as 'json' | 'html';
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

  function loadMappings(): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        displayMappings(mappings);
      });
    });
  }

  function displayMappings(mappings: UrlMappings): void {
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
        if (patternConfig.sourceType === 'html') {
          sourceInfo = `<span class="source-info">HTML meta tag name: <span class="source-value">${patternConfig.metaTag}</span></span>`;
        } else {
          sourceInfo = `<span class="source-info">JSONPath: <span class="source-value">${patternConfig.jsonPath}</span></span>`;
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
      button.addEventListener('click', function(this: HTMLElement) {
        const repo = this.getAttribute('data-repo')!;
        deleteRepo(repo);
      });
    });

    // Add delete pattern event listeners
    document.querySelectorAll('.delete-pattern').forEach(button => {
      button.addEventListener('click', function(this: HTMLElement) {
        const repo = this.getAttribute('data-repo')!;
        const pattern = this.getAttribute('data-pattern')!;
        deletePattern(repo, pattern);
      });
    });
  }

  function addMapping(githubRepo: string, urlPattern: string, sourceType: 'json' | 'html', jsonPath: string, metaTag: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

      if (!mappings[githubRepo]) {
        mappings[githubRepo] = [];
      }

      // Check for duplicate pattern
      const existingPattern = mappings[githubRepo].find(p => p.pattern === urlPattern);
      if (existingPattern) {
        showStatus('This URL pattern already exists for this repository', false);
        return;
      }

      const newPattern: PatternConfig = sourceType === 'json'
        ? { pattern: urlPattern, sourceType: 'json', jsonPath }
        : { pattern: urlPattern, sourceType: 'html', metaTag };

      mappings[githubRepo].push(newPattern);

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Mapping added successfully!', true);
        loadMappings();
        urlPatternInput.value = '';
        jsonPathInput.value = '$.version';
        metaTagInput.value = '';
        // Reset to JSON option
        (document.querySelector('input[name="sourceType"][value="json"]') as HTMLInputElement).checked = true;
        jsonOptions.style.display = 'block';
        htmlOptions.style.display = 'none';
      });
    });
  }

  function deleteRepo(repo: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
      delete mappings[repo];

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Repository removed successfully!', true);
        loadMappings();
      });
    });
  }

  function deletePattern(repo: string, pattern: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

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

  function normalizeGitHubUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  function isValidGitHubUrl(url: string): boolean {
    const githubRegex = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
    return githubRegex.test(url);
  }

  function showStatus(message: string, isSuccess: boolean): void {
    statusDiv.textContent = message;
    statusDiv.className = isSuccess ? 'status success' : 'status error';
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function exportConfiguration(): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
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

  function importConfiguration(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target?.result as string);
        const validated = parseStorageData(data);
        chrome.storage.sync.set({ urlMappings: validated.urlMappings }, function() {
          showStatus('Configuration imported!', true);
          loadMappings();
        });
      } catch {
        showStatus('Invalid configuration file format', false);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  }
});
