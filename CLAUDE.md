# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension that detects `version` fields in JSON pages and creates direct links to GitHub commits. Users configure URL-to-repository mappings, and when visiting a JSON page with a version field, the extension provides a one-click link to view that commit on GitHub.

## Development

**No build system** - This is a zero-dependency Chrome extension using vanilla JavaScript and HTML. Load directly as an unpacked extension.

### Loading the Extension

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this directory

### Testing Changes

After modifying files, click the refresh icon on the extension card in `chrome://extensions/` to reload.

## Architecture

```
content.js      → Runs on all pages, parses JSON for "version" field
popup.html/js   → Extension icon click UI, shows version + GitHub link
options.html/js → Settings page for URL-to-repo mappings
manifest.json   → Chrome extension manifest (v3)
```

### Data Flow

1. **content.js** scans page text as JSON, extracts `version` field
2. **popup.js** queries content script, looks up URL pattern in storage
3. Matches current URL against stored patterns to find GitHub repo
4. Constructs link: `{repo}/commit/{version}`

### Storage

Uses `chrome.storage.sync` with structure:
```javascript
{ urlMappings: { "api.example.com": "https://github.com/org/repo" } }
```

### Communication

Content script and popup communicate via Chrome messaging API:
- `getVersionInfo` action: popup requests version from content script
- Response: `{ version, isJson }`
