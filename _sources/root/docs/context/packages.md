# Packages System

This document explains how Peers packages work: the state transitions during install and update, the data model, three-bundle architecture, and how apps appear in the UI.

For bundle-level debugging (webpack externals, evaluating bundles, hash mismatches), see [package-loading.md](package-loading.md).

## State Transitions: Install and Update Scenarios

Peers-core is the primary package. Its bundles ship embedded in both the Electron app and the PWA static assets. On startup, the system compares the **bundled version on disk/server** against the **active version in the DB** and decides what to do.

### Electron

On startup, two things happen:
1. `syncPeersCoreBundle()` runs from `peers-electron/src/server/peers-init.ts` -- compares on-disk bundles to the DB
2. The UI calls `addOrUpdatePackage('updateAll')` from `peers-ui/src/globals.tsx` -- triggers `updatePackageBundle()` for each locally-linked package

#### Fresh install (no peers-core in DB)

`syncPeersCoreBundle` sees no `IPackage` record -> calls `installPeersCoreFromBundles()` which:
1. Saves the three bundles to the `Files` table
2. Creates a `PackageVersions` record (tag: beta)
3. Creates the `IPackage` record with `activePackageVersionId` set
4. Calls `installPackageIntoDataContext` (saves assistants, workflows, events)

**Known issue:** `installPeersCoreFromBundles` does not load the package bundle to extract `appNavs`. The `IPackage` record is created with `appNavs: null`, which means peers-core apps (Tasks, Voice Hub, etc.) are invisible in the Apps launcher.

#### App update ships a NEWER peers-core

`syncPeersCoreBundle` reads bundles from disk and compares:

```
diskVersion > activePvVersion  ->  isNewer = true
tagMatches (beta -> beta)      ->  true
shouldActivate                 ->  true
```

New PV is created, activated on the `IPackage`, bundle is loaded, and `appNavs` is refreshed from the package instance. Everything works correctly.

#### App update ships an OLDER peers-core

This can happen when a user has received a newer version via sync from another peer, then installs an older Electron build.

```
diskVersion < activePvVersion  ->  isNewer = false
shouldActivate                 ->  false
```

A new PV is created for the disk bundle, but it is **not** activated. The DB's newer version stays active. The appNavs refresh block at the end of `syncPeersCoreBundle` loads from the **active** (newer) version, so appNavs stay correct. This is the right behavior -- the system protects against downgrades.

However, if the older bundle happens to match an existing PV (same hash), the code takes the `matchingPv` shortcut and `continue`s, skipping the appNavs refresh entirely. If appNavs were already null, they stay null.

#### Local dev build (same version number)

When `dev-all.sh` rebuilds peers-core with the same semver (common during development), `updatePackageBundle` runs:

```
isNewer(activePvVersion, version)  ->  false  (same version)
shouldActivate                     ->  false
```

The beta PV is updated in-place with the new bundle hashes, but `appNavs` is set to `pkg.appNavs` (copied from the existing package record, which may be null). Since `shouldActivate` is false, the activation block that does `pkg.appNavs = packageInstance.appNavs` never runs.

**Known issue:** This is the primary cause of the "missing apps" bug. During local development, appNavs are never refreshed because the version doesn't increment.

#### Manual "Activate" from the UI

When a user clicks "Activate" on a version in the Packages screen (`peers-ui/src/screens/packages/package-versions.tsx`):

1. Sets `activePackageVersionId` on the `IPackage` record
2. Saves the package

That's all. It does **not** load the package bundle, call `installPackageIntoDataContext`, or refresh `appNavs`. If `appNavs` was already null on the package record, it stays null.

### PWA

The PWA has a separate, simpler package installer at `peers-pwa/src/package-installer.ts`. On page load, if `reloadPackagesOnPageRefresh` is true, the UI calls `addOrUpdatePackage('updateAll')` which calls `installPeersCoreFromBundles()`.

#### Fresh visit (no peers-core in DB)

Same as the first-time Electron flow but fetches bundles from `/peers-core/*.bundle.js` (static web assets). The PWA version **does** correctly set `appNavs` after loading the package instance (unlike the Electron version).

#### PWA update ships a NEWER peers-core

The service worker delivers new static assets. On next page load, `installPeersCoreFromBundles` runs:

1. Fetches and saves the new bundles
2. Creates or reuses a PV (deduped by hash)
3. **Unconditionally overwrites** the `IPackage` record with `activePackageVersionId` pointing to the new PV
4. Loads the bundle and sets `appNavs`

This works correctly for the upgrade case.

#### PWA update ships an OLDER peers-core

**Problem:** The PWA installer has **no version comparison logic** (`shouldActivate`, `isNewer`, etc.). It always overwrites the `IPackage` record. If the user had received a newer peers-core via sync from another peer, the PWA will downgrade it to the older bundled version. This could cause issues if the newer version introduced schema changes or new features.

#### Sync from another peer introduces newer peers-core

On the next page refresh, `installPeersCoreFromBundles` runs and overwrites the package with the bundled version, undoing the sync. This is a known gap in the PWA -- it lacks the `shouldActivate` protection that Electron has.

### Summary of version resolution behavior

| Scenario | Electron | PWA |
|----------|----------|-----|
| Fresh install | Installs bundled version. **appNavs: null (bug)** | Installs bundled version. appNavs set correctly |
| Update with newer bundle | Activates newer, refreshes appNavs | Activates newer, refreshes appNavs |
| Update with older bundle | Keeps DB's newer version active (protected) | **Overwrites with older version (no protection)** |
| Sync introduces newer version | Protected on next startup (isNewer=false) | **Overwritten on next page refresh (no comparison)** |
| Local dev, same version | Beta PV updated. **appNavs not refreshed (bug)** | N/A (no local dev path) |
| Manual UI "Activate" | Changes active PV. **appNavs not refreshed (bug)** | Same |

---

## Data Model

### `Packages` table (`IPackage`)

One row per package per data context (personal space or group). Key fields:

| Field | Purpose |
|-------|---------|
| `packageId` | Primary key (25-char peer ID) |
| `name` | Display name (e.g. "peers-core") |
| `disabled` | If true, package is excluded from loading |
| `activePackageVersionId` | FK to `PackageVersions` -- which version is live |
| `appNavs` | Array of `IAppNav` -- drives the Apps launcher |
| `versionFollowRange` | Auto-update policy: `pinned`, `patch`, `minor`, or `latest` (default) |
| `followVersionTags` | Tag policy: undefined = follow current tag, `*` = any, or CSV like `"stable,beta"` |
| `remoteRepo` | Git URL for the package source |

**File:** `peers-sdk/src/data/packages.ts`

### `PackageVersions` table (`IPackageVersion`)

Immutable build snapshots. Each version points to three bundle files stored in the `Files` table:

| Field | Purpose |
|-------|---------|
| `packageVersionId` | Primary key |
| `packageId` | FK to `Packages` |
| `version` | Semver string (e.g. "0.13.0") |
| `versionTag` | `"stable"`, `"beta"`, etc. |
| `packageVersionHash` | Hash of (version + tag + bundle hashes) |
| `packageBundleFileId` | Server-side bundle (tools, tables, appNavs) |
| `routesBundleFileId` | URL routing bundle |
| `uiBundleFileId` | React UI components bundle |
| `appNavs` | Snapshot of appNavs at the time the version was created |

**File:** `peers-sdk/src/data/package-versions.ts`

### `IAppNav`

```typescript
{ name: string, displayName?: string, iconClassName: string, navigationPath: string }
```

Stored on both `IPackage.appNavs` (the live/active set used by the UI) and `IPackageVersion.appNavs` (snapshot). The **`IPackage.appNavs`** is what the Apps launcher reads.

**File:** `peers-sdk/src/types/app-nav.ts`

## Three-Bundle Architecture

Each package produces three webpack bundles, each with a distinct role:

### 1. `package.bundle.js` -- Server/runtime

Evaluated by `PackageLoader` on the main process (Node.js/Electron) or in the browser (PWA). Contains:
- Tool instances (registered with the tool runtime)
- Table definitions (registered with the table container)
- Assistants, workflows, events
- `appNavs` (extracted during activation and saved to `IPackage`)

Export pattern: `(exports as any).exports = peersPackage;`

**Webpack config:** `webpack.package.config.js`

### 2. `routes.bundle.js` -- URL routing (browser)

Lightweight bundle loaded early in the browser before any UI renders. Maps URL paths to `peersUIId` values. Must stay small -- no component imports.

Export pattern: `exportRoutes(routes)` where `exportRoutes` is injected by the loader.

Each route specifies: `{ packageId, peersUIId, path, uiCategory }`.

For example, `package-nav/<packageId>/app` maps to the Tasks screen.

**Webpack config:** `webpack.routes.config.js`

### 3. `uis.bundle.js` -- React components (browser)

Lazy-loaded when a user navigates to a package screen. Contains React components registered by `peersUIId`.

Export pattern: `exportUIs(uis)` where `exportUIs` is injected by the loader.

**Webpack config:** `webpack.uis.config.js`

## The `shouldActivate` Decision

When a new version is created, the system decides whether to automatically activate it:

```
shouldActivate = tagMatches && rangeMatches && isNewer
```

- **`tagMatches`**: Does the incoming version's tag match what this package is configured to follow? Default: incoming tag must equal the active version's tag. Can be overridden per-device or by setting `followVersionTags` on the package.
- **`rangeMatches`**: Is the incoming version within the auto-update range? `latest` (default) always matches. `pinned` never matches. `patch`/`minor` check semver boundaries.
- **`isNewer`**: Is the incoming version **strictly** newer? Same version returns false.

If `shouldActivate` is false, the PV record is saved but the package's `activePackageVersionId` is unchanged, and `appNavs` are not refreshed from the bundle.

**Note:** The PWA does not use `shouldActivate` at all -- it always overwrites.

### Tag matching details (`doesTagMatch`)

- No `followVersionTags` set (default): incoming tag must match active tag
- `followVersionTags: '*'`: accept any tag
- `followVersionTags: 'stable,beta'`: accept any listed tag
- `deviceVersionTag` override: per-device setting that takes precedence over everything

### Beta version handling

Beta versions (`versionTag.startsWith('beta')`) are updated **in-place** (same `packageVersionId`) rather than creating new PV records. This avoids accumulating many beta PV records during development. Stable versions are deduplicated by hash instead.

## How Apps Appear in the UI

### App Launcher (`AppLauncherTab`)

**File:** `peers-ui/src/tabs-layout/tabs-layout.tsx`

1. `loadAllRoutes()` queries `Packages().list({ disabled: { $ne: true }, activePackageVersionId: { $exists: true } })` and stores results in the `allPackages` observable
2. `AppLauncherTab` reads `allPackages` plus `systemPackage` (virtual package for built-in system apps)
3. Filters to packages where `!p.disabled && p.appNavs && p.appNavs.length > 0`
4. For each `appNav`, constructs a navigation path:
   - System apps: direct path (e.g. `search`)
   - Package apps: `package-nav/<packageId>/<navigationPath>`
5. Displays in "System Apps" and user apps sections, with a "Recently Used" section

If `appNavs` is null or empty on the `IPackage`, the package is silently excluded from the launcher.

### Route resolution

**File:** `peers-ui/src/ui-router/routes-loader.ts`

On page load, `loadAllRoutes()` fetches and evaluates each package's `routes.bundle.js`, which calls `registerPeersUIRoute()` for each route.

### Screen rendering

**File:** `peers-ui/src/ui-router/ui-loader.tsx`

When a tab with a package path is selected:
1. `UIRouter` matches the path against registered routes to find a `peersUIId`
2. `UILoader` checks if the component is already in memory
3. If not, `UIAsyncLoader` calls `loadUIBundle()` which fetches and evaluates `uis.bundle.js`
4. The React component registered for that `peersUIId` renders

### System Apps vs Package Apps

System apps (Search, Threads, Settings, etc.) are defined in `peers-ui/src/system-apps/index.ts` as a virtual `systemPackage` with `packageId: 'system-apps'`. They use the built-in `Router` component. Package apps use `UIRouter` which loads from the package's bundle.

## Key Files

| File | Role |
|------|------|
| `peers-electron/src/server/package-installer.ts` | All Electron install/update/sync logic |
| `peers-pwa/src/package-installer.ts` | PWA install logic |
| `peers-sdk/src/package-loader/package-loader.ts` | Bundle evaluation (shared) |
| `peers-sdk/src/data/packages.ts` | `Packages` table + `IPackage` schema |
| `peers-sdk/src/data/package-versions.ts` | `PackageVersions` table + version comparison functions |
| `peers-sdk/src/types/peers-package.ts` | `IPeersPackage` interface (what a bundle exports) |
| `peers-ui/src/ui-router/routes-loader.ts` | Route bundle loading in browser |
| `peers-ui/src/ui-router/ui-loader.tsx` | UI bundle loading + `UIRouter` |
| `peers-ui/src/tabs-layout/tabs-layout.tsx` | `AppLauncherTab` + tab rendering |
| `peers-ui/src/system-apps/index.ts` | Virtual system package |
| `peers-ui/src/screens/packages/package-versions.tsx` | Manual activate/promote/delete UI |

## Debugging

```bash
# Check if appNavs is set on the package
peers db query "SELECT packageId, name, appNavs FROM Packages" -c personal --json

# Check appNavs on package versions
peers db query "SELECT packageVersionId, version, versionTag, appNavs FROM PackageVersions WHERE packageId = '<id>'" -c personal --json

# Check which version is active
peers db query "SELECT p.name, p.activePackageVersionId, pv.version, pv.versionTag FROM Packages p LEFT JOIN PackageVersions pv ON p.activePackageVersionId = pv.packageVersionId" -c personal --json
```
