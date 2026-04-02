# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (MV3) that detects version/git-sha strings in JSON pages or HTML meta tags, then provides a one-click link to the corresponding GitHub commit. Users configure URL pattern → GitHub repo mappings via the options page.

## Development

**Build system**: TypeScript + Vite. Source files are in `src/`, compiled output goes to `dist/`.

```
npm run build          # compile src/ → dist/
npm run watch          # compile with file watching
npm run build:release  # build + zip for Chrome Web Store upload
```

### Loading the Extension

1. Run `npm run build` to produce `dist/`
2. Navigate to `chrome://extensions/`, enable Developer mode
3. Click "Load unpacked", select this directory

After modifying `src/` files, run `npm run build` then click the refresh icon on the extension card.

## Architecture

```
src/
  content.ts    → Injected into all pages; extracts version from JSON or HTML meta tags
  popup.ts      → Extension popup UI; queries content script, resolves GitHub link
  options.ts    → Settings page; manages URL pattern → repo mappings via CRUD UI
  background.ts → Service worker; manages toolbar badge (✓ indicator)
  schemas.ts    → Zod schemas and types shared across all scripts
```

`popup.html` and `options.html` are static HTML files that load the corresponding compiled scripts from `dist/`.

### Data Flow

1. **content.ts** runs on page load: reads storage, finds a matching `PatternConfig` for the current URL, extracts the version string (from JSON body or HTML `<meta>` tag), and sends a `versionDetected` message to the background worker to set the badge.
2. **popup.ts** on open: sends `getVersionInfo` to the content script, which re-reads storage and returns `VersionInfo`. The popup then looks up the GitHub repo URL from storage and constructs `{repo}/commit/{version}`.
3. **background.ts** listens for `versionDetected` messages and sets a green ✓ badge on the tab. Clears the badge on tab navigation.

### Storage Schema

Defined in `src/schemas.ts` using Zod. The storage key is `urlMappings`:

```typescript
// Storage root
{ urlMappings: UrlMappings }

// UrlMappings: repo URL → array of PatternConfig
{ "https://github.com/org/repo": PatternConfig[] }

// PatternConfig is a discriminated union on sourceType:
{ pattern: string, sourceType: 'json', jsonPath: string }  // e.g. jsonPath: "$.version"
{ pattern: string, sourceType: 'html', metaTag: string }   // e.g. metaTag: "git-sha"
```

URL matching uses simple substring matching (`url.includes(pattern)`). JSONPath supports simple dot-notation (`$.version`, `$.git.commit`).

### Chrome Messaging

- `getVersionInfo` (popup → content): returns `VersionInfo` — version string, source type, whether the URL matched a configured pattern, and which selector was expected
- `versionDetected` (content → background): triggers badge update
