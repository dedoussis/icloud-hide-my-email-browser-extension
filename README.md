# iCloud Hide My Email Browser Extension

> Fork of [dedoussis/icloud-hide-my-email-browser-extension](https://github.com/dedoussis/icloud-hide-my-email-browser-extension) with enhanced management features for users with 300+ addresses.

[Hide My Email](https://support.apple.com/en-us/HT210425) is a premium privacy service of iCloud. Safari offers a native integration with Hide My Email, but this extension brings similar UX to other browsers:

- [Chrome](https://chrome.google.com/webstore/detail/icloud-hide-my-email/omiaekblhgfopjkjnenhahfgcgnbohlk) / Brave / Edge (any Chromium-based)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/icloud-hide-my-email/)

*Disclaimer: Not endorsed by, affiliated with, or sponsored by Apple.*

## Features

**Core (upstream)**
- Pop-up UI for generating and reserving new Hide My Email addresses
- Autofill on email input fields (button overlay or right-click context menu)
- Forward-To address configuration via Options page

**Enhanced manager (this fork)**
- Instant load via client-side cache with background refresh
- Search across labels, email addresses, and notes
- Filter by status (active/inactive), origin (Extension/Safari), and tags
- Sort by date, label, or status
- Inline editing of labels, notes, and tags
- Tag system using `#tag` convention in the note field
- CSV/JSON export of filtered results
- Batch select and bulk deactivate
- Full-tab manager mode for heavy management
- Cache age indicator

## Develop

Built with TypeScript, React 19, TailwindCSS 4, and [WXT](https://wxt.dev/) (browser extension framework).

### Prerequisites

- Node.js 25+ (see `.nvmrc`)

### Setup

```sh
nvm use
npm install
```

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server (Chrome, with HMR) |
| `npm run dev:firefox` | Start dev server (Firefox) |
| `npm run build` | Production build for Chrome (`dist/chrome-mv3/`) |
| `npm run build:firefox` | Production build for Firefox (`dist/firefox-mv3/`) |
| `npm run zip` | Build + zip for Chrome Web Store |
| `npm run zip:firefox` | Build + zip for Firefox Add-ons |
| `npm run check` | TypeScript type check |
| `npm run lint` | ESLint |

### Loading the extension

1. `npm run build`
2. Chrome: go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `dist/chrome-mv3/`
3. Firefox: `npm run dev:firefox` (auto-launches) or use `web-ext -s dist/firefox-mv3 run`

### Project structure

```
entrypoints/          # WXT entry points (auto-discovered)
  background.ts       # Service worker: auth sync, message routing, context menu
  content/            # Content script: DOM overlay, autofill buttons
  popup/              # Popup UI: generator + manager
  options/            # Options page: forward-to, autofill settings
  manager/            # Full-tab manager page
  userguide/          # Getting started guide
src/                  # Shared modules
  iCloudClient.ts     # Apple API wrapper (generate, reserve, list, update, etc.)
  storage.ts          # Browser storage schema + helpers
  hmeCache.ts         # Client-side cache for HME list
  tags.ts             # Tag parsing/serialization (#tag convention)
  export.ts           # CSV/JSON export
  messages.ts         # Background <-> content script IPC
  hooks.ts            # React hooks (useBrowserStorageState)
  commonComponents.tsx # Shared UI components
public/               # Static assets (icons, rules.json)
wxt.config.ts         # WXT configuration + manifest
```
