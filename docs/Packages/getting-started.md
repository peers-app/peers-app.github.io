---
sidebar_position: 1
title: Getting started
---

# Packages

Peers **packages** are how the app loads extensible behavior: **tables** and **tools** (and related metadata) on the server/runtime side, **routes** for URL mapping in the browser, and **UI bundles** for React screens. The desktop app and PWA install package versions from bundled assets or synced updates, then each **device** chooses which version to run within a group (or personal space), using group-level defaults on `IPackage` when the device has no override.

When a **package version record** syncs to a device, Peers also downloads that version’s **package, routes, and UI bundle files** into the local content-addressed cache. Downloading those bytes does **not** activate the version — activation still follows group defaults and this device’s pin / follow settings.

At a high level, a package contributes:

- **Runtime manifest and provider** — isolated table, contract, tool, and navigation declarations,
  plus provider source that Electron and headless can run in a supervised container.
- **Routes** — small bundle that registers URL paths before UI loads.
- **UI** — lazy-loaded React components registered by `peersUIId`.

## Package lifecycle

Packages follow a **three-phase lifecycle**: `dev` → `beta` → `stable`. Disk updates create **dev** versions; promotion to beta or stable is explicit in the **Versions** UI. Dev records sync to the group but **never auto-activate on other devices** unless those devices opt in.

When you **activate** a different version on this device, routes and UI bundles reload without a full page refresh.

See **[Package lifecycle](./package-lifecycle)** for development workflow, per-device pin/follow settings, and releasing to the group. See [Package lifecycle design](../Roadmap/package-lifecycle) for design rationale and remaining roadmap work.

## Creating a new package

Creating or cloning a package from the desktop app requires **git**, **Node.js**, and **npm** on your machine. Peers looks them up through your login shell so tools installed via nvm, Homebrew, or fnm work even when the app was opened from Finder or the Dock. If those tools are truly missing, the create dialog explains how to install Node.js from [nodejs.org](https://nodejs.org) and restart Peers.

The fastest way to start a new package is from the Peers app
(**Packages → Create**), which clones the
[peers-package-template](https://github.com/peers-app/peers-package-template),
patches IDs, builds bundles, registers the `Packages` record, and provisions a
per-package author signing key in your personal space.

You can also scaffold on disk and import:

```bash
cp -r peers-package-template ~/peers/packages/my-app
cd ~/peers/packages/my-app
# replace placeholders in src/ids.json and peers.packageId, then:
npm install && npm run build
```

Then open **Packages → Create** in Peers and select the existing package
directory to import it.

### Importing an existing package directory

If the target directory already exists and contains a valid `package.json` with `peers.packageId`, create/import **does not** re-clone the template. It:

1. Validates the manifest package ID
2. Recovers the signing public key before saving the package. The target `Packages` row takes precedence; if it is absent, Peers searches your personal context, then groups, for the same package ID's first nonblank `publishPublicKey`. It can also recover the key from metadata cached alongside your personal signing secret, or through host decryption of an older encrypted secret. A new keypair is created only when both the public key and signing secret are missing; established keys are never silently rotated.
3. Creates or updates the `Packages` row (name, description, optional `remoteRepo`)
4. Persists `packageLocalPath_<packageId>` for that data context
5. Installs the on-disk `dev` bundles

This is the supported path for monorepo apps under `official-packages/` (for example Groceries).

Importing the same local package by name into Personal or another group reuses its publisher identity. Deleting the package leaves your personal signing secret and its cached public key intact, so re-importing after uninstall also preserves that identity. Import fails without changing keys if the available public keys disagree, or if an existing secret has no recoverable public key.

### Project structure

The template provides a standard package layout:

```
my-app/
├── build-package.mjs     # Builds the isolated manifest/provider artifact
├── src/
│   ├── ids.json           # Package, contract, and screen IDs
│   ├── consts.ts          # Typed renderer exports from ids.json
│   ├── contract.ts        # Renderer-facing contract shape
│   ├── provider-source.js # Code that may run only in the isolated worker
│   ├── routes.ts          # URL path registrations (eager)
│   ├── uis.ts             # React component registry (lazy)
│   └── ui/
│       └── app.tsx        # Your first screen component
├── webpack.routes.config.js
├── webpack.uis.config.js
└── package.json
```

The build produces three output bundles:

| Bundle | Built from | Purpose |
|--------|-----------|---------|
| `package.bundle.js` | `build-package.mjs` + `src/provider-source.js` | Isolated runtime manifest and provider source |
| `routes.bundle.js` | `src/routes.ts` | URL path mappings (loaded eagerly at startup) |
| `uis.bundle.js` | `src/uis.ts` | React components (loaded lazily on navigation) |

New packages use an **isolated** `PEERS_ISOLATED_PACKAGE_V1` JSON envelope for
`package.bundle.js`. Electron and headless run that provider source in a supervised sandbox
worker by default, or a separate privileged Node process when explicitly declared. Existing legacy `definePackage()` bundles remain supported.
Every package-owned table schema belongs once at
`manifest.tables`. Authors declare a package-local name, primary key, fields, and
optional schema version; they do not provide a table ID or physical name. The host
stores each table as `${logicalTableName}_${packageId}`, and guest code reads or
writes copied records through `getOwnedTableRecord`, `saveOwnedTableRecord`,
`listOwnedTableRecords`, and `deleteOwnedTableRecord` during an active tool invocation. A
provided contract can expose selected schemas using name-only table references;
unreferenced schemas stay private. Contracts can also expose typed, optionally
writable observables backed by package-prefixed pvars. Normal contract consumers
get standard table CRUD and observable get/set/subscription, while isolated
consumer workers use the corresponding consumed-state helpers. Routes and UI
bundles stay in the renderer. Upgrade every peer that syncs a group before using
isolated package tables there; older hosts derive a different physical table name.
See
**[Package contracts](./contracts#isolated-contract-packages-electron)** for the
artifact boundary, Electron-only status, and legacy compatibility.

See **[Routes and UI](./routes-and-ui)** for how these bundles are loaded and why they are split.

### Set up IDs

The template ships with placeholder IDs in `src/ids.json`:

```json
{
  "packageId": "<package-id>",
  "contractId": "<contract-id>",
  "screenId": "<app-screen-id>",
  "packageName": "<package-name>",
  "stateObservableName": "state"
}
```

Replace each placeholder with a value generated by `newid()` from `@peers-app/peers-sdk`. All Peers IDs must be exactly 25 alphanumeric characters. You can generate IDs with the CLI:

```bash
peers tools run new-id
```

Update `packageName` to your package's display name and set `peers.packageId` in
`package.json` to match. The desktop creator performs these replacements automatically.

### Build and run

```bash
npm install
npm run build
```

This produces `dist/package.bundle.js`, `dist/routes.bundle.js`, and `dist/uis.bundle.js`. After building, reload the UI to pick up the new package:

```bash
peers ui reload
```

During development, `npm run dev` watches the renderer routes and UI. Run
`npm run build:package` after changing the manifest, IDs, or provider source, then restart
Electron or reinstall the package so the isolated artifact is reloaded.

### Webpack externals

The renderer provides `React` and `@peers-app/peers-sdk` as globals. The route and UI webpack
configs list them as **externals** so they are not bundled. Provider source is not a webpack
entry and cannot import these modules.

## Defining an isolated package

`build-package.mjs` combines a pure-data manifest with the text from
`src/provider-source.js`:

```javascript
const artifact = {
  manifest: {
    packageId: ids.packageId,
    version: packageJson.version,
    tables: [],
    provides: [{
      contractId: ids.contractId,
      version: 1,
      name: ids.packageName,
      tools: [],
      observables: [{
        name: "state",
        description: "Shared application state.",
        valueType: "object",
        writable: true,
        persistentVar: {
          scope: "group",
          name: "state",
          defaultValue: {},
        },
      }],
    }],
    consumes: [],
    appNavs: [{
      name: ids.packageName,
      iconClassName: "bi bi-app",
      navigationPath: "app",
    }],
  },
  providerSource,
};
```

Every isolated package provides at least one contract, and each provided contract has at least
one tool, table, or observable. The starter's writable observable gives UI-first packages a
small reactive persistence path without starting a worker. Prefer declared tables for
record-oriented data.

`provider-source.js` is JavaScript stored inside the artifact. In the default sandbox it
cannot import Node modules or the host SDK. Declare tools in the manifest and register matching
handlers with the guest API `registerContractTool`. Privileged providers can use Node built-ins
as described below.

`appNavs` declares the navigation items that appear in the Apps launcher. The
`navigationPath` corresponds to the route path registered in `src/routes.ts`.
Omit `appNavs` when the package should appear only as a widget, which is how Weather stays out of
the Apps list.

Optional `manifest.network` names the HTTPS hosts an isolated package may call through
[System HTTP](../System/HTTP.md). [System Scheduler](../System/Scheduler.md) wakes one of the
package's own tools on this device. Packages that want Voice Hub to call them provide the shared
[Voice Skill](./voice-skills) contract instead of being linked into Voice Hub at build time.

Legacy packages may still build a CommonJS `src/package.ts` with `definePackage()`. That format
is supported for compatibility but is no longer the default scaffold.

Note: `versionTag` and contract `devTag` are **not** set in code. The platform assigns these based on the package's promotion state.

### Provider execution modes

`manifest.executionMode` accepts exactly `"sandbox"` or `"privileged"`. Omission keeps the
SES sandbox: no ambient `process`, `require`, filesystem, or subprocess access. The field
applies only to provider code; routes and UI do not gain Node access. Privileged providers
are supported in Electron and headless. Browser/PWA provider execution remains unsupported.

A privileged provider is **trusted device code**. It runs in its own Node process as the same
OS account as Peers, without root/admin elevation. It inherits Peers' environment and working
directory and can access the filesystem, network, and subprocesses directly. Existing host
bridge checks still apply to ordinary contract, table, pvar, and event calls, but direct OS
access bypasses sandbox and network-policy confinement. There are no granular permissions or
additional consent gate in this mode.

To use a Node built-in, bundle a provider as CommonJS with `platform: "node"`:

```js
// src/provider-source.js — use your existing generated contract ID.
import { platform } from "node:os";
import ids from "./ids.json";

registerContractTool(ids.contractId, 1, "platform", () => ({ platform: platform() }));
```

```js
// In build-package.mjs, after creating your normal manifest (including the platform tool):
import { build } from "esbuild";
import { serializeIsolatedPackageArtifact } from "@peers-app/peers-sdk";
import { mkdir, writeFile } from "node:fs/promises";

const built = await build({
  entryPoints: ["src/provider-source.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  write: false,
});
manifest.executionMode = "privileged";
await mkdir("dist", { recursive: true });
await writeFile("dist/package.bundle.js", serializeIsolatedPackageArtifact({
  manifest,
  providerSource: built.outputFiles[0].text,
}));
```

Both IIFE and bundled CommonJS providers work, including bundles whose entrypoint has a
leading `#!/usr/bin/env node` shebang. Node provides `require`, `module`, `exports`,
`__filename`, and `__dirname`; the synthetic filename is `.peers-isolate-provider.cjs` under
Peers' inherited working directory. It is not the author's package directory. Bundle dependencies
into the source: the artifact format does not distribute package-directory assets or
`node_modules`. Native modules and external files are not automatically installed on devices.
The provider uses the Node version shipped with its host (Electron's embedded Node on desktop).
Standard output and standard error go to the host's output streams; bridge traffic uses a
separate IPC channel, so provider logging does not interfere with contract replies.

Startup stays lazy, with one session per package/data context. Normal deadlines still apply:
Electron and headless allow 30 seconds for startup/evaluation and, by default, each tool call;
a tool can declare `timeoutMs` up to 120 seconds. A timeout or crash terminates the session,
and the next invocation starts a fresh one. Switching modes requires normal version
replacement, which stops the previous session. Invalid replacements retain the old registration.

Activation follows existing device/group version selection, pin, and follow rules. A version
that becomes active on several devices can therefore run privileged code on each of them.
Downloading a version does not activate it. Termination kills only the provider process and
cannot undo filesystem, network, or other OS side effects. Any spawned descendants, including
ordinary subprocesses created without `detached: true`, may survive timeouts, replacement, or
shutdown. Providers must manage descendant cleanup; the runtime does not guarantee it.

## Author signing keys

Each package has an Ed25519 **author** keypair used to sign non-dev publish artifacts:

- **Public key** — stored on the `Packages.publishPublicKey` field (TOFU anchor for verifiers), with a recovery copy in the signing pvar's description. The versioned `peers-package-signing-key:v1:<packageId>:<publicKey>` marker is bound to that package ID and validated before use; the human-readable description is retained.
- **Secret key** — stored as a secret user pvar named `packageSigningKey_<packageId>` in your personal data context. Do not commit it or paste it into chat/logs.

Keys are created when a package is first registered (create or import) if both the established public key and signing secret are missing. Re-importing the same directory reuses the target's established public key. When the target `Packages` row is absent, importing reuses the same package ID's first nonblank public key from your personal context or groups.

Uninstalling from any or all contexts leaves the personal signing pvar intact. Its cached public key lets a later import restore the same publisher identity even when every `Packages` row has been deleted. Imports lazily add this metadata to older pvars without changing or re-encrypting their stored secret value.

For legacy encrypted secrets without metadata, Node hosts (Electron and headless) use their existing user-secret decryption to recover only the public key for the importer. SDK hosts can supply the optional `resolveSigningPublicKey(encryptedSecret)` create/import callback for this recovery. If decryption is unavailable or fails, an established or cached public key can still be reused. A disagreement between established, cached, or recovered keys fails the import before any signing-key or package writes. An existing unreadable secret is never replaced automatically; if no public key is recoverable, restore `publishPublicKey` or unlock the secret before importing.

Explicitly deleting `packageSigningKey_<packageId>` removes your local author signing secret. If every installed copy of the package is also deleted, the next import generates a **new publisher identity** and restores the pvar's deterministic ID even if it was previously deleted. If an established public key remains in another context, Peers retains that identity without generating replacement keys; restore the matching secret to publish under it.

## Related topics

- **[Routes and UI](./routes-and-ui)** — how routes and UI bundles work, how to author them, and why to prefer route-based rendering.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run versions (dev / beta / stable).
- **[Package contracts](./contracts)** — versioned interfaces, isolated manifests, validation, and the registry.
- **[Voice skills](./voice-skills)** — how a package becomes voice-addressable and contributes a widget.
- **[System HTTP](../System/HTTP)** — host-mediated HTTPS, allowlists, and credential refs.
- **[System Scheduler](../System/Scheduler)** — device-local wake-ups of a package's own tool.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design doc and shipped vs planned work.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
