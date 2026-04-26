# Package Loading System

This document covers how Peers loads package bundles, how to debug package loading failures, and common pitfalls.

## Overview

Peers packages (like Yoke) are webpack-built JS bundles stored in two places:
1. **Local disk** — `<package>/dist/package.bundle.js` (built by the package developer)
2. **Database file store** — saved as a `Files` record and referenced by `Packages.packageBundleFileId`

The app primarily loads from the **database**, not from disk. The local bundle on disk is only read when `updatePackageBundle` runs (triggered by "Update" in the UI or app restart with a local package).

## How Package Bundles Are Loaded

**File:** `peers-sdk/src/package-loader/package-loader.ts`

`PackageLoader.loadPackage()` does the following:
1. Looks up the bundle by `pkg.packageBundleFileId` in the `Files` table
2. Reads the file content from the file store
3. Evaluates it using `new Function('module', 'exports', 'require', bundleCode)`
4. Extracts the package instance from `module.exports?.exports || .package || .default || module.exports`
5. Registers tools and table definitions from the loaded instance

The `customRequire` function passed to the bundle handles:
- `'PeersSDK'` / `'peers-sdk'` → returns the peers-sdk module
- `'zod'` → returns zod
- Everything else → warns and falls back to `_require(moduleId)` (Node.js require)

### Update Flow (Chicken-and-Egg Problem)

**File:** `peers-electron/bin/server/package-installer.js` — `updatePackageBundle()`

The update sequence is:
1. Read new bundle from **local disk**
2. Call `loadPackage(pkg, { force: true })` — which loads from the **stored bundle in DB**
3. If that succeeds → save new local bundle to DB
4. If that fails → throw "package bundle did not return a package instance"

**This creates a deadlock:** if the stored bundle is broken, `loadPackage` fails, so the new bundle is never saved.

**The fix (in `peers-sdk/package-loader.ts`):** When the stored bundle fails to evaluate AND `pkg.localPath` is set, fall back to reading from `pkg.localPath/dist/package.bundle.js`. This breaks the deadlock automatically.

## Webpack External Configuration

**Critical:** Node.js built-ins used in a package MUST be declared as externals in `webpack.package.config.js`. Without them, webpack generates `webpackMissingModule` stubs that throw at runtime.

```js
externals: {
  '@peers-app/peers-sdk': 'PeersSDK',   // ← global var, NOT commonjs
  'zod': 'zod',                           // ← global var
  'child_process': 'commonjs child_process',
  'os': 'commonjs os',
  'path': 'commonjs path',
},
```

**Note:** `@peers-app/peers-sdk` uses the bare global name (no `commonjs` prefix) because the package loader handles `require('PeersSDK')` specially. Other Node built-ins use `commonjs <name>` so webpack generates `module.exports = require("<name>")` which then goes through the custom require fallback.

**Common mistake:** Adding a new file that imports a Node built-in without updating the webpack externals, then building and uploading — the stored bundle in the DB will have `webpackMissingModule` for that module and fail to load.

## Debugging Package Loading Failures

### Step 1: Check logs for the actual error

```bash
# See the error message
peers logs -e --since 30 --full

# See warnings (module require warnings appear even on successful loads)
peers logs -l warn --since 30
```

**Key signals:**
- `Error loading package` → `loadPackage` returned null
- `Could not load package bundle for <name>` → exception thrown during evaluation (logged at `debug` level — **won't appear** in normal log queries)
- `Package <name> is requiring a module <x>, which is not provided by the package loader` → warns but still loads via fallback; these are normal and expected
- `Package bundle file not found` → `packageBundleFileId` set but file missing from store
- `[PackageLoader] Stored bundle failed for <name>, trying local path fallback` → fallback triggered

### Step 2: Check if the stored bundle matches the local bundle

```bash
# Get stored bundle hash from DB
peers db query "SELECT packageBundleFileId, packageBundleFileHash FROM Packages WHERE name = 'YourPackage'"

# Compare with local bundle hash
node -e "
const crypto = require('crypto');
const fs = require('fs');
const content = fs.readFileSync('./dist/package.bundle.js');
console.log(crypto.createHash('sha256').update(content).digest('base64url'));
"
```

If hashes differ, the stored bundle is stale. After the fallback fix, the stored bundle will auto-update on the next successful load.

### Step 3: Check file sizes

```bash
peers db query "SELECT fileId, fileSize, fileHash FROM Files WHERE fileId = '<packageBundleFileId>'"
wc -c dist/package.bundle.js
```

If sizes differ significantly, the stored bundle is from a different build.

### Step 4: Test the bundle locally

```js
// Quick test — simulates what PackageLoader does
const fs = require('fs');
const bundleCode = fs.readFileSync('./dist/package.bundle.js', 'utf8');
const moduleExports = {};
const module = { exports: moduleExports };
const customRequire = (id) => {
  if (id === 'PeersSDK') return require('@peers-app/peers-sdk');
  if (id === 'zod') return require('zod');
  return require(id);
};
const fn = new Function('module', 'exports', 'require', bundleCode);
fn(module, moduleExports, customRequire);
const pkg = module.exports?.exports || module.exports;
console.log('packageId:', pkg?.packageId);
```

If this works locally but Peers fails, the stored bundle is the problem (not the local one).

## Database Queries for Package Debugging

```bash
# List all packages
peers db Packages

# Check a specific package's bundle reference
peers db query "SELECT packageId, name, packageBundleFileId, packageBundleFileHash FROM Packages WHERE name = 'Yoke'"

# Check if bundle file exists and its size
peers db query "SELECT fileId, fileSize, fileHash FROM Files WHERE fileId = '<id>'"
```

## Package Export Pattern

Packages must export via `(exports as any).exports = peersPackage` at the end of `package.ts`. The package loader checks `module.exports?.exports` first in its extraction chain.

With `library: { type: 'commonjs2' }` in webpack config, this generates:
```js
exports.exports = peersPackage;  // inside webpack IIFE
// ...
module.exports = __webpack_exports__;  // webpack sets module.exports
```

The net result: `module.exports` = `{ exports: peersPackage }`, so `module.exports?.exports` = `peersPackage`. ✓

## Two Tasks Tables Issue

If you see:
```
Table "Tasks_<id>" has two different definitions with the same versionNumber (1). Skipping update.
```

### Root Cause (False Positive)

This was a false positive caused by a serialization asymmetry in `checkVersionedUpdate` (`peers-sdk/src/data/orm/table-container.ts`):

1. `schemaToFields(taskSchema)` stores Zod `.default()` values as **functions** (e.g., `defaultValue: () => new Date()`)
2. When saved to DB, `serial-json.ts` `toJSON()` serializes functions as `"__FUNCTION ..."` strings (e.g., `"__FUNCTION function(){return new Date}"`)
3. `fromJSON()` does NOT convert `__FUNCTION` strings back to functions (code is commented out) — they stay as strings
4. When `simpleObjectHash` hashes the DB version: the `"__FUNCTION ..."` string IS included in the hash
5. When `simpleObjectHash` hashes the in-memory version: `stableStringify` **drops** function values — no `defaultValue` key
6. Different hashes → false positive error every startup

**Fix (applied in `peers-sdk/src/data/orm/table-container.ts`):** Added `normalizeMetaDataForComparison()` that strips `defaultValue` from all fields before hashing. `defaultValue` is application-level logic, not part of the SQLite column schema, so excluding it from structural comparison is correct.

### Legitimate Version Conflict

If you see this error after actually changing the schema (adding/renaming fields, changing types), the fix is to increment `versionNumber` in the table definition.

## Rebuilding and Reloading a Package

```bash
# 1. Rebuild the package bundle
cd ~/peers-packages/yoke && npm run build

# 2. Trigger update in Peers UI (or restart)
peers app restart

# 3. Verify it loaded
peers logs -e --since 2
peers logs -l warn --since 2 | grep -i "yoke"
```

After the first successful load following the fallback fix, the DB bundle is updated automatically and subsequent loads won't need the fallback.
