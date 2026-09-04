---
sidebar_position: 1
title: Getting started
---

# Packages

Peers **packages** are how the app loads extensible behavior: **tables** and **tools** (and related metadata) on the server/runtime side, **routes** for URL mapping in the browser, and **UI bundles** for React screens. The desktop app and PWA install package versions from bundled assets or synced updates, then each **device** chooses which version to run within a group (or personal space), using group-level defaults on `IPackage` when the device has no override.

When a **package version record** syncs to a device, Peers also downloads that version’s **package, routes, and UI bundle files** into the local content-addressed cache. Downloading those bytes does **not** activate the version — activation still follows group defaults and this device’s pin / follow settings.

At a high level, a package contributes:

- **Runtime manifest and provider** — isolated table, contract, tool, and navigation declarations,
  plus provider source that Electron can run in a supervised worker.
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
2. Creates or updates the `Packages` row (name, description, optional `remoteRepo`)
3. Persists `packageLocalPath_<packageId>` for that data context
4. Provisions a signing keypair **only when** `publishPublicKey` is missing (never silently rotates an established key; a readable secret that disagrees with `publishPublicKey` fails clearly)
5. Installs the on-disk `dev` bundles

This is the supported path for monorepo apps under `official-packages/` (for example Groceries).

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
`package.bundle.js`. Electron runs that provider source in a supervised worker instead of
evaluating it in the host. Existing legacy `definePackage()` bundles remain supported.
Every package-owned table schema belongs once at
`manifest.tables`. Authors declare a package-local name, primary key, fields, and
optional schema version; they do not provide a table ID or physical name. The host
stores each table as `${logicalTableName}_${packageId}`, and guest code reads or
writes copied records through `getOwnedTableRecord(tableName, recordId)` and
`saveOwnedTableRecord(tableName, record)` during an active tool invocation. A
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

`provider-source.js` is plain JavaScript stored inside the artifact. It cannot import Node
modules or the SDK. Declare tools in the manifest and register matching handlers with the
isolated guest API `registerContractTool`.

`appNavs` declares the navigation items that appear in the Apps launcher. The
`navigationPath` corresponds to the route path registered in `src/routes.ts`.

Legacy packages may still build a CommonJS `src/package.ts` with `definePackage()`. That format
is supported for compatibility but is no longer the default scaffold.

Note: `versionTag` and contract `devTag` are **not** set in code. The platform assigns these based on the package's promotion state.

### Author signing keys

Each package has an Ed25519 **author** keypair used to sign non-dev publish artifacts:

- **Public key** — stored on the `Packages.publishPublicKey` field (TOFU anchor for verifiers).
- **Secret key** — stored as a secret user pvar named `packageSigningKey_<packageId>` in your personal data context. Do not commit it or paste it into chat/logs.

Keys are created when a package is first registered (create or import) if `publishPublicKey` is empty. Re-importing the same directory reuses the established public key.

## Related topics

- **[Routes and UI](./routes-and-ui)** — how routes and UI bundles work, how to author them, and why to prefer route-based rendering.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run versions (dev / beta / stable).
- **[Package contracts](./contracts)** — versioned interfaces, isolated manifests, validation, and the registry.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design doc and shipped vs planned work.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
