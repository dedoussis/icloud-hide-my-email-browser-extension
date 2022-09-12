# iCloud Hide My Email Chrome Extension

[![Tests Status](https://github.com/dedoussis/icloud-hide-my-email-chrome-extension/workflows/tests/badge.svg)](https://github.com/dedoussis/icloud-hide-my-email-chrome-extension/actions/workflows/tests.yml)

This extension enables the use of [iCloud's Hide My Email](https://support.apple.com/en-us/HT210425) feature on any Chromium based browser such as Google Chrome, Brave, Opera, and Microsoft Edge.

Hide My Email is natively supported in Safari. This extension aims to bring a similar UX to the Chromium ecosystem.

![Extension popup demo](./src/assets/img/demo-popup.gif)

![Extension content demo](./src/assets/img/demo-content.gif)

## Features

- Simple pop-up UI for generating and reserving new Hide My Email addresses
- Ability to manage existing Hide My Email addresses (including deactivation, reactivation, and deletion)
- Autofilling on any HTML input element that is relevant to email
- Quick configuration of Hide My Email settings, such as the Forward-To address, through the Options page of the extension.

_Disclaimer: This extension is not endorsed by, directly affiliated with, maintained, authorized, or sponsored by Apple._

## Develop

The entirety of the extension is writen in TypeScript.

All UI elements of the extension use TailwindCSS.

Both of the Pop-Up and Options pages are React apps.

```console
$ npm run start
```

### TODOs

- [ ] Ability to search in existing HME addresses
- [ ] Ability to modify the label and note of an existing HME address
