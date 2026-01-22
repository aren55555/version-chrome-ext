import { z } from 'zod';
import { parseUrlMappings, STORAGE_DATA_SCHEMA, UrlMappings, PatternConfig } from './schemas';

document.addEventListener('DOMContentLoaded', function() {
  const addRepoBtn = document.getElementById('addRepoBtn')!;
  const addRepoForm = document.getElementById('addRepoForm')!;
  const newRepoUrlInput = document.getElementById('newRepoUrl') as HTMLInputElement;
  const saveRepoBtn = document.getElementById('saveRepoBtn')!;
  const cancelRepoBtn = document.getElementById('cancelRepoBtn')!;
  const repoList = document.getElementById('repoList')!;
  const statusDiv = document.getElementById('status')!;
  const exportButton = document.getElementById('exportConfig')!;
  const importButton = document.getElementById('importConfig')!;
  const importFileInput = document.getElementById('importFile') as HTMLInputElement;

  let currentEditingMatcher: { repo: string; pattern: string } | null = null;

  exportButton.addEventListener('click', exportConfiguration);
  importButton.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importConfiguration);

  addRepoBtn.addEventListener('click', () => {
    addRepoForm.classList.add('visible');
    newRepoUrlInput.focus();
  });

  cancelRepoBtn.addEventListener('click', () => {
    addRepoForm.classList.remove('visible');
    newRepoUrlInput.value = '';
  });

  saveRepoBtn.addEventListener('click', () => {
    const repoUrl = normalizeGitHubUrl(newRepoUrlInput.value.trim());
    if (!repoUrl) {
      showStatus('Please enter a GitHub repository URL', false);
      return;
    }
    if (!isValidGitHubUrl(repoUrl)) {
      showStatus('Please enter a valid GitHub repository URL', false);
      return;
    }
    addRepository(repoUrl);
  });

  loadMappings();

  function loadMappings(): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        displayMappings(mappings);
      });
    });
  }

  function displayMappings(mappings: UrlMappings): void {
    repoList.innerHTML = '';

    if (Object.keys(mappings).length === 0) {
      repoList.innerHTML = '<div class="empty-state">No repositories configured yet. Click "Add Repository" to get started.</div>';
      return;
    }

    for (const [repo, patterns] of Object.entries(mappings)) {
      const repoCard = createRepoCard(repo, patterns);
      repoList.appendChild(repoCard);
    }
  }

  function createRepoCard(repo: string, patterns: PatternConfig[]): HTMLElement {
    const card = document.createElement('div');
    card.className = 'repo-card';
    card.dataset.repo = repo;

    const header = document.createElement('div');
    header.className = 'repo-header';
    header.innerHTML = `
      <a href="${repo}" target="_blank" class="repo-url">${repo}</a>
      <div class="repo-actions">
        <button class="btn btn-secondary add-matcher-btn">+ Add Matcher</button>
        <button class="btn btn-danger delete-repo-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete</button>
      </div>
    `;
    card.appendChild(header);

    const matcherList = document.createElement('div');
    matcherList.className = 'matcher-list';

    if (patterns.length === 0) {
      matcherList.innerHTML = '<div style="padding: 12px; color: #888; font-size: 13px;">No matchers yet. Add a matcher to start detecting versions.</div>';
    } else {
      for (const pattern of patterns) {
        const matcherItem = createMatcherItem(repo, pattern);
        matcherList.appendChild(matcherItem);
      }
    }

    card.appendChild(matcherList);

    // Add matcher form (hidden)
    const addMatcherForm = createMatcherForm(repo, null);
    card.appendChild(addMatcherForm);

    // Event listeners
    header.querySelector('.add-matcher-btn')!.addEventListener('click', () => {
      closeAllForms();
      addMatcherForm.classList.add('visible');
      (addMatcherForm.querySelector('.pattern-input') as HTMLInputElement).focus();
    });

    header.querySelector('.delete-repo-btn')!.addEventListener('click', () => {
      deleteRepo(repo);
    });

    return card;
  }

  function createMatcherItem(repo: string, pattern: PatternConfig): HTMLElement {
    const item = document.createElement('div');
    item.className = 'matcher-item';
    item.dataset.pattern = pattern.pattern;

    const sourceInfo = pattern.sourceType === 'html'
      ? `HTML meta: <span class="matcher-source-value">${pattern.metaTag}</span>`
      : `JSONPath: <span class="matcher-source-value">${pattern.jsonPath}</span>`;

    item.innerHTML = `
      <div class="matcher-info">
        <div class="matcher-pattern">${pattern.pattern}</div>
        <div class="matcher-source">${sourceInfo}</div>
      </div>
      <div class="matcher-actions">
        <button class="btn btn-icon delete-matcher-btn" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.delete-matcher-btn')) {
        return;
      }
      openEditForm(repo, pattern);
    });

    item.querySelector('.delete-matcher-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePattern(repo, pattern.pattern);
    });

    return item;
  }

  function createMatcherForm(repo: string, existingPattern: PatternConfig | null): HTMLElement {
    const form = document.createElement('div');
    form.className = 'edit-form';
    const isEdit = existingPattern !== null;
    const formId = isEdit ? `edit-${repo}-${existingPattern.pattern}` : `add-${repo}`;

    const sourceType = existingPattern?.sourceType || 'json';
    const jsonPath = existingPattern?.sourceType === 'json' ? existingPattern.jsonPath : '$.version';
    const metaTag = existingPattern?.sourceType === 'html' ? existingPattern.metaTag : '';

    form.innerHTML = `
      <div class="form-group">
        <label>URL Pattern <span class="required">*</span></label>
        <input type="text" class="pattern-input" placeholder="api.example.com" value="${existingPattern?.pattern || ''}">
        <div class="hint">Match URLs containing this text</div>
      </div>
      <div class="form-group">
        <label>Source Type <span class="required">*</span></label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="sourceType-${formId}" value="json" ${sourceType === 'json' ? 'checked' : ''}>
            JSON
          </label>
          <label class="radio-label">
            <input type="radio" name="sourceType-${formId}" value="html" ${sourceType === 'html' ? 'checked' : ''}>
            HTML
          </label>
        </div>
      </div>
      <div class="form-group json-options" ${sourceType === 'html' ? 'style="display:none"' : ''}>
        <label>JSONPath <span class="required">*</span></label>
        <input type="text" class="jsonpath-input" value="${jsonPath}">
        <div class="hint">Path to the git SHA field (e.g., $.version or $.git.commit)</div>
      </div>
      <div class="form-group html-options" ${sourceType === 'json' ? 'style="display:none"' : ''}>
        <label>Meta Tag Name <span class="required">*</span></label>
        <input type="text" class="metatag-input" placeholder="git-sha" value="${metaTag}">
        <div class="hint">Looks for &lt;meta name="..." content="abc123..."&gt;</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary save-matcher-btn">${isEdit ? 'Update' : 'Add'} Matcher</button>
        <button class="btn btn-secondary cancel-matcher-btn">Cancel</button>
      </div>
    `;

    const jsonOpts = form.querySelector('.json-options') as HTMLElement;
    const htmlOpts = form.querySelector('.html-options') as HTMLElement;
    const radios = form.querySelectorAll<HTMLInputElement>(`input[name="sourceType-${formId}"]`);

    radios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.value === 'json') {
          jsonOpts.style.display = '';
          htmlOpts.style.display = 'none';
        } else {
          jsonOpts.style.display = 'none';
          htmlOpts.style.display = '';
        }
      });
    });

    form.querySelector('.save-matcher-btn')!.addEventListener('click', () => {
      const patternInput = form.querySelector('.pattern-input') as HTMLInputElement;
      const jsonPathInput = form.querySelector('.jsonpath-input') as HTMLInputElement;
      const metaTagInput = form.querySelector('.metatag-input') as HTMLInputElement;
      const selectedType = (form.querySelector(`input[name="sourceType-${formId}"]:checked`) as HTMLInputElement).value as 'json' | 'html';

      const pattern = patternInput.value.trim();
      const jsonPathVal = jsonPathInput.value.trim();
      const metaTagVal = metaTagInput.value.trim();

      if (!pattern) {
        showStatus('Please enter a URL pattern', false);
        return;
      }

      if (selectedType === 'json' && !jsonPathVal) {
        showStatus('Please enter a JSONPath', false);
        return;
      }

      if (selectedType === 'html' && !metaTagVal) {
        showStatus('Please enter a Meta Tag Name', false);
        return;
      }

      if (isEdit) {
        updateMatcher(repo, existingPattern.pattern, pattern, selectedType, jsonPathVal, metaTagVal);
      } else {
        addMatcher(repo, pattern, selectedType, jsonPathVal, metaTagVal);
      }
    });

    form.querySelector('.cancel-matcher-btn')!.addEventListener('click', () => {
      form.classList.remove('visible');
      currentEditingMatcher = null;
      document.querySelectorAll('.matcher-item.editing').forEach(el => el.classList.remove('editing'));
    });

    return form;
  }

  function openEditForm(repo: string, pattern: PatternConfig): void {
    closeAllForms();

    const repoCard = document.querySelector(`.repo-card[data-repo="${CSS.escape(repo)}"]`);
    if (!repoCard) return;

    const matcherItem = repoCard.querySelector(`.matcher-item[data-pattern="${CSS.escape(pattern.pattern)}"]`);
    if (matcherItem) {
      matcherItem.classList.add('editing');
    }

    // Remove any existing edit form for this pattern
    const existingEditForm = repoCard.querySelector('.edit-form.pattern-edit');
    if (existingEditForm) {
      existingEditForm.remove();
    }

    const editForm = createMatcherForm(repo, pattern);
    editForm.classList.add('visible', 'pattern-edit');

    // Insert after the matcher list
    const matcherList = repoCard.querySelector('.matcher-list');
    if (matcherList && matcherList.nextSibling) {
      repoCard.insertBefore(editForm, matcherList.nextSibling);
    } else {
      repoCard.appendChild(editForm);
    }

    currentEditingMatcher = { repo, pattern: pattern.pattern };
  }

  function closeAllForms(): void {
    document.querySelectorAll('.edit-form.visible').forEach(form => {
      form.classList.remove('visible');
    });
    document.querySelectorAll('.edit-form.pattern-edit').forEach(form => {
      form.remove();
    });
    document.querySelectorAll('.matcher-item.editing').forEach(el => {
      el.classList.remove('editing');
    });
    currentEditingMatcher = null;
  }

  function addRepository(repoUrl: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

      if (mappings[repoUrl]) {
        showStatus('This repository already exists', false);
        return;
      }

      mappings[repoUrl] = [];

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Repository added!', true);
        addRepoForm.classList.remove('visible');
        newRepoUrlInput.value = '';
        loadMappings();
      });
    });
  }

  function addMatcher(repo: string, pattern: string, sourceType: 'json' | 'html', jsonPath: string, metaTag: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

      if (!mappings[repo]) {
        mappings[repo] = [];
      }

      const exists = mappings[repo].find(p => p.pattern === pattern);
      if (exists) {
        showStatus('This URL pattern already exists for this repository', false);
        return;
      }

      const newPattern: PatternConfig = sourceType === 'json'
        ? { pattern, sourceType: 'json', jsonPath }
        : { pattern, sourceType: 'html', metaTag };

      mappings[repo].push(newPattern);

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Matcher added!', true);
        closeAllForms();
        loadMappings();
      });
    });
  }

  function updateMatcher(repo: string, oldPattern: string, newPattern: string, sourceType: 'json' | 'html', jsonPath: string, metaTag: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

      if (!mappings[repo]) {
        showStatus('Repository not found', false);
        return;
      }

      const index = mappings[repo].findIndex(p => p.pattern === oldPattern);
      if (index === -1) {
        showStatus('Matcher not found', false);
        return;
      }

      // Check if new pattern already exists (if pattern changed)
      if (oldPattern !== newPattern) {
        const exists = mappings[repo].find(p => p.pattern === newPattern);
        if (exists) {
          showStatus('This URL pattern already exists for this repository', false);
          return;
        }
      }

      const updatedPattern: PatternConfig = sourceType === 'json'
        ? { pattern: newPattern, sourceType: 'json', jsonPath }
        : { pattern: newPattern, sourceType: 'html', metaTag };

      mappings[repo][index] = updatedPattern;

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Matcher updated!', true);
        closeAllForms();
        loadMappings();
      });
    });
  }

  function deleteRepo(repo: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);
      delete mappings[repo];

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Repository deleted!', true);
        loadMappings();
      });
    });
  }

  function deletePattern(repo: string, pattern: string): void {
    chrome.storage.sync.get(['urlMappings'], function(result) {
      const mappings = parseUrlMappings(result.urlMappings);

      if (mappings[repo]) {
        mappings[repo] = mappings[repo].filter(p => p.pattern !== pattern);

        if (mappings[repo].length === 0) {
          delete mappings[repo];
        }
      }

      chrome.storage.sync.set({ urlMappings: mappings }, function() {
        showStatus('Matcher deleted!', true);
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
        const validated = STORAGE_DATA_SCHEMA.parse(data);
        chrome.storage.sync.set({ urlMappings: validated.urlMappings }, function() {
          showStatus('Configuration imported!', true);
          loadMappings();
        });
      } catch (err) {
        if (err instanceof SyntaxError) {
          showStatus('Invalid JSON file', false);
        } else if (err instanceof z.ZodError) {
          const messages = err.issues.map(issue => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          });
          showStatus(`Validation errors: ${messages.join('; ')}`, false);
        } else {
          showStatus('Invalid configuration file format', false);
        }
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  }
});
