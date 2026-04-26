# Voice Service in Production Builds - Agent Context

The Picovoice native modules (`@picovoice/porcupine-node`, `@picovoice/pvrecorder-node`) require special handling in packaged Electron builds. This doc covers the problems that arose and how they were solved.

## Problem 1: macOS Hardened Runtime Blocks Microphone

When the app is notarized (`notarize: true` in electron-builder), Apple enforces **hardened runtime** which silently denies microphone access unless explicit entitlements are declared. Dev builds are not notarized so they aren't affected.

### Fix

**`peers-electron/entitlements.mac.plist`** declares:

| Entitlement | Why |
|---|---|
| `com.apple.security.cs.allow-jit` | Required by Electron's V8 engine |
| `com.apple.security.cs.allow-unsigned-executable-memory` | Required by Electron and native Node modules |
| `com.apple.security.cs.disable-library-validation` | Required to load native `.node` addons (Picovoice, better-sqlite3) |
| `com.apple.security.device.audio-input` | **Microphone access** for PvRecorder |

**`electron-builder.js`** references the entitlements and adds the user-facing permission string:

```javascript
mac: {
  entitlements: "entitlements.mac.plist",
  entitlementsInherit: "entitlements.mac.plist",
  extendInfo: {
    NSMicrophoneUsageDescription: "Peers uses the microphone for voice commands and speech-to-text input.",
  },
}
```

## Problem 2: Picovoice Native Code Can't Read Files from Asar

Picovoice's native C library reads `.pv` (model) and `.ppn` (keyword) files using standard `fopen()`. Electron's `.asar` archive is a virtual filesystem — `fopen()` can't open files inside it.

### How Picovoice Loads Files

The Porcupine constructor (`new Porcupine(accessKey, keywords, sensitivities, modelPath?, libraryPath?)`) does three things that interact with the filesystem:

1. **`require(libraryPath)`** — loads `pv_porcupine.node`. Electron patches `require()` to handle asar, so this works with `asarUnpack`.
2. **`fs.existsSync(modelPath)`** — validation check. Electron patches `fs`, so this also works.
3. **`pvPorcupine.init(accessKey, modelPath, keywordPaths, ...)`** — passes file paths to **native C code** which uses `fopen()`. This **fails** because the C code can't read from inside `.asar`.

### Fix

Two parts:

#### 1. Unpack Picovoice from asar (`electron-builder.js`)

```javascript
asarUnpack: [
  "**/node_modules/@picovoice/**/*"
]
```

This extracts all Picovoice files to `<resources>/app.asar.unpacked/node_modules/@picovoice/...` on the real filesystem.

#### 2. Compute real filesystem paths (`wake-word-detector.ts`)

Instead of letting Picovoice's internal code resolve paths (which uses `__dirname` pointing into `.asar`), we compute them ourselves and pass explicit paths to the Porcupine constructor.

**In packaged builds**, we use `process.resourcesPath` (Electron-guaranteed, correct on all OSes):

```typescript
function getPorcupinePackageRoot(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,          // <install>/resources
      'app.asar.unpacked',
      'node_modules', '@picovoice', 'porcupine-node',
    );
  }
  // Dev mode – normal module resolution
  return path.dirname(require.resolve('@picovoice/porcupine-node/package.json'));
}
```

Then pass explicit paths to the constructor:

```typescript
const { modelPath, libraryPath, keywordPath } = getPorcupinePaths(builtinKeyword);
new Porcupine(accessKey, [keywordPath], [sensitivity], modelPath, libraryPath);
```

**Why `process.resourcesPath` instead of `require.resolve` + regex?**

An earlier approach used `require.resolve()` to find the package, then regex-replaced `.asar/` with `.asar.unpacked/`. This worked on macOS but failed on Windows and Linux — `require.resolve()` in Electron can return paths that don't translate cleanly across platforms. `process.resourcesPath` is a direct Electron API that gives the correct real-filesystem path on every OS.

## Problem 3: Opaque Picovoice Error `00000136` on Windows

After deploying the asar fix, Windows production builds still failed with:

```
Error: Porcupine failed to initialize:
  [0] Picovoice Error (code `00000136`)
  [1] Picovoice Error (code `00000136`)
  [2] Picovoice Error (code `00000136`)
```

This error was misleading — it looked like a file I/O problem but was actually a **Picovoice access key device activation limit**.

### Root Cause

The Picovoice free-tier access key had been activated on too many devices (`PorcupineActivationLimitReachedError`, `PvStatus.ACTIVATION_LIMIT_REACHED = 9`). Error code `00000136` is Picovoice's internal code for this — it's not a `PvStatus` enum value (those are 0–11) and has no public documentation, which made diagnosis difficult.

### How We Diagnosed It

Added enhanced diagnostics to `wake-word-detector.ts`:

1. **Pre-flight file size logging** — Confirmed all files exist with correct sizes in `app.asar.unpacked` (model 985KB, library 307KB, keyword 4KB).
2. **Error class name logging** — `error.constructor.name` revealed `PorcupineActivationLimitReachedError`, immediately identifying the cause.

### Fix

Updated the access key at [console.picovoice.ai](https://console.picovoice.ai) (deactivate old devices, generate new key, or upgrade plan).

### Error Handling Added

`wake-word-detector.ts` now catches all Picovoice activation errors and logs clear, actionable messages instead of the opaque native error codes:

| Error Class | Log Message |
|---|---|
| `PorcupineActivationLimitReachedError` | `*** PICOVOICE DEVICE LIMIT REACHED ***` with instructions to manage keys |
| `PorcupineActivationError` | `*** PICOVOICE ACCESS KEY INVALID ***` with link to console |
| `PorcupineActivationThrottledError` | `*** PICOVOICE ACTIVATION THROTTLED ***` |
| `PorcupineActivationRefusedError` | `*** PICOVOICE ACTIVATION REFUSED ***` |

### Picovoice File Structure

The `@picovoice/porcupine-node` npm package ships pre-built binaries for all platforms:

```
lib/
├── common/porcupine_params.pv          ← model file (shared)
├── mac/arm64/pv_porcupine.node         ← native library
├── mac/x86_64/pv_porcupine.node
├── windows/amd64/pv_porcupine.node
├── windows/arm64/pv_porcupine.node
├── linux/x86_64/pv_porcupine.node
└── raspberry-pi/...

resources/keyword_files/
├── mac/computer_mac.ppn                ← wake word models (per-platform)
├── windows/computer_windows.ppn
├── linux/computer_linux.ppn
└── ...
```

Platform/arch selection uses `os.platform()` and `os.arch()` mapped to Picovoice's naming:

| `os.platform()` | Picovoice platform | `os.arch()` | Picovoice arch |
|---|---|---|---|
| `darwin` | `mac` | `arm64` | `arm64` |
| `darwin` | `mac` | `x64` | `x86_64` |
| `win32` | `windows` | `x64` | `amd64` |
| `win32` | `windows` | `arm64` | `arm64` |
| `linux` | `linux` | `x64` | `x86_64` |

## Files Changed

| File | What |
|---|---|
| `peers-electron/entitlements.mac.plist` | macOS entitlements (new file) |
| `peers-electron/electron-builder.js` | asarUnpack for @picovoice, mac entitlements + NSMicrophoneUsageDescription |
| `peers-electron/src/server/voice/wake-word-detector.ts` | Explicit path resolution, pre-flight file diagnostics, actionable activation error messages |
| `peers-electron/.github/workflows/build-and-release.yml` | Added **`npm run rebuild:voice`** step to CI |

## Debugging Checklist

If voice fails in a production build:

1. **Check for activation error messages** — `wake-word-detector.ts` logs clear messages for all Picovoice activation errors (`*** PICOVOICE DEVICE LIMIT REACHED ***`, etc.). These are the most common production failures.
2. **Check logs for `[WakeWord] ⚠ ... does not exist:`** — the pre-flight check logs each file's size or reports it missing with the error code.
3. **Check that `asarUnpack` includes `@picovoice`** — without it, files stay inside `.asar` and native code can't read them.
4. **On macOS, check entitlements** — if `com.apple.security.device.audio-input` is missing, mic access is silently denied under hardened runtime.
5. **Verify the packaged app structure** — in the installed app, confirm `resources/app.asar.unpacked/node_modules/@picovoice/porcupine-node/lib/` exists and contains `.node`, `.pv`, and `.ppn` files for the target platform.
6. **Check the error class name** — The `[WakeWord] Failed to start (ClassName):` log reveals the `PvStatus` category. Key mappings: `PorcupineIOError` = can't read files, `PorcupineActivationError` = bad key, `PorcupineActivationLimitReachedError` = too many devices.
