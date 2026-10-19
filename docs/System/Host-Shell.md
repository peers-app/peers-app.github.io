---
sidebar_position: 10
title: Host shell
---

# Host shell

**System Host Shell** (`hostShellContractId`, version 1) is the system contract for the app's
window and shell: inspecting, driving, and screenshotting the UI; quitting and restarting the
app; opening links, folders, and the code editor; and copying a variable to the clipboard.
`peers ui` and `peers app quit|restart` use it, and so do the UI's **Open Local**,
**Open Remote**, **Open Packages Directory**, and copy-value buttons.

## From the CLI

```bash
peers ui screenshot                      # save an image of the Peers window; prints its path
peers ui screenshot --max-width 1280 --json
peers ui inspect --elements              # interactive elements and their selectors
peers ui click "#submit-btn"
peers ui set "#search" "hello" --enter
peers ui reload --no-cache
peers app restart
```

- `screenshot` writes `~/peers/screenshots/peers-<time>.png` unless you pass `--out <file>`,
  and prints the path (with `--json`: `{path, width, height, mimeType}`). `--jpeg` and
  `--max-width <pixels>` (a positive integer) make smaller files. A coding agent can open the file to see what
  the UI shows, for example after `peers ui reload`.
- `inspect` lists selectors (`#id`, or a `body > tag.class:nth-of-type(n) > …` path) that `click`,
  `set`, and `scroll` accept.
- A UI action that finds nothing exits 1 with the reason, such as
  `Element not found: #submit-btn`.
- `reload --json` prints `{"reloaded":true}`. Diagnostic and failure messages go to stderr.
- The Peers window must be open. With no window, or a renderer that does not answer within
  10 seconds, the command says so instead of waiting.

See [CLI](./CLI.md) for every option.

## Another of your devices

Add `--device <deviceId>` to any `peers ui` command, or to `peers app restart|quit`, to run it
on another device. The screenshot is still written on this one.

- The target device must trust you as **Self** (see [Trust](./Trust.md)): your own devices,
  or another account's device that you control, such as a kitchen hub. Anyone else is
  refused: "Device … does not trust this account as Self".
- Another account's device is reached over a direct connection, for example on the same
  network.
- `peers app restart|quit --device` also needs the target's **Allow my other devices to update
  and restart this device** setting ([App Updates](./App-Updates.md#settings--updates)).
  With it off, the target refuses: "this device does not allow other devices to restart or
  quit it".

## Tools

| Tool | What it does |
|---|---|
| `getCapabilities` | Which of the groups below this host supports |
| `inspectUI` | URL, route, visible text, and interactive elements with selectors |
| `clickUI`, `setUIText`, `scrollUI` | Click, type into, or scroll the element a selector matches |
| `reloadUI` | Reload the window, optionally bypassing the cache |
| `screenshot` | PNG or JPEG of the window, base64, optionally scaled to `maxWidth` |
| `quitApp`, `restartApp` | Quit or restart after replying |
| `open` | An `http`, `https`, or `mailto` link in the browser, or a local path with the OS; other URL schemes are refused |
| `openInEditor` | A folder in VS Code (`code`) when installed, otherwise with the OS |
| `copyVariableToClipboard` | A variable's value to the clipboard; decrypted on the host, never sent to the UI |

Every tool except `getCapabilities` needs **Self** access: the device's own account, or a
caller the device trusts as Self, in the device's personal context.

- **Not for packages or workflows.** Calls from package code are refused, and a device
  refuses to forward a package's call to it on another device. Workflows and assistants
  cannot call it.
- **Secrets on the clipboard.** On the desktop app a copied secret is cleared from the
  clipboard after 30 seconds if it is still there; the PWA tries the same where the browser
  allows reading the clipboard.

### Host support

Every tool is present on every host. One the host cannot perform fails with
`System Host Shell <tool> is not supported on this host (…)`, and `getCapabilities` reports
support up front.

| Host | Supports |
|---|---|
| Desktop app | Everything |
| Headless | `quitApp`, `restartApp` |
| PWA | `open` (web links), `copyVariableToClipboard` |

## Related

- [Trust](./Trust.md): what Self allows, and what stays on the device.
- [App Updates](./App-Updates.md): update and restart a device remotely.
- [Packages](./Packages.md#administering-your-other-devices): administer another device's packages.
