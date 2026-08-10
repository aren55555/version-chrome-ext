# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (MV3) that detects version/git-sha strings in JSON pages or HTML meta tags, then provides a one-click link to the corresponding GitHub commit. Users configure URL pattern → GitHub repo mappings via the options page.

## Development

**Build system**: [WXT](https://wxt.dev/) (TypeScript + Vite under the hood). Entrypoints live in `entrypoints/`, shared code in `utils/`, static assets in `public/`. Compiled output goes to `.output/chrome-mv3/`.

```
bun run dev            # dev mode with auto-reload
bun run build          # compile → .output/chrome-mv3/
bun run build:release  # build + zip for Chrome Web Store upload
                       # (.output/version-chrome-ext-v<version>.zip)
```

### Loading the Extension

1. Run `bun run build` to produce `.output/chrome-mv3/`
2. Navigate to `chrome://extensions/`, enable Developer mode
3. Click "Load unpacked", select the `.output/chrome-mv3/` directory

After modifying source files, re-run `bun run build` (or keep `bun run dev` running), then click the refresh icon on the extension card.

Type checking: `bunx tsc --noEmit` (root `tsconfig.json` extends the generated `.wxt/tsconfig.json`; run `bunx wxt prepare` first if `.wxt/` doesn't exist).

## Architecture

```
entrypoints/
  content.ts        → Injected into all pages; extracts version from JSON or HTML meta tags
  popup/
    index.html      → Popup markup/styles (loads ./main.ts as a module)
    main.ts         → Popup logic; queries content script, resolves GitHub link
  options/
    index.html      → Options page markup/styles (loads ./main.ts as a module)
    main.ts         → Options logic; manages URL pattern → repo mappings via CRUD UI
  background.ts     → Service worker; manages toolbar badge (✓ indicator)
utils/
  schemas.ts        → Zod schemas and types shared across all scripts
public/
  icons/            → Extension icons (copied to output as-is)
wxt.config.ts       → WXT config; the extension manifest is defined here (there is no
                      standalone manifest.json in source anymore)
```

The popup and options entrypoints are auto-registered in the manifest as `action.default_popup` and `options_ui.page` by WXT. The options page uses `<meta name="manifest.open_in_tab" content="true">` so it opens in a full tab. `defineContentScript` / `defineBackground` are auto-imported by WXT (no import statement needed).

### Data Flow

1. **entrypoints/content.ts** runs on page load: reads storage, finds a matching `PatternConfig` for the current URL, extracts the version string (from JSON body or HTML `<meta>` tag), and sends a `versionDetected` message to the background worker to set the badge.
2. **entrypoints/popup/main.ts** on open: sends `getVersionInfo` to the content script, which re-reads storage and returns `VersionInfo`. The popup then looks up the GitHub repo URL from storage and constructs `{repo}/commit/{version}`.
3. **entrypoints/background.ts** listens for `versionDetected` messages and sets a green ✓ badge on the tab. Clears the badge on tab navigation.

### Storage Schema

Defined in `utils/schemas.ts` using Zod. The storage key is `urlMappings`:

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
