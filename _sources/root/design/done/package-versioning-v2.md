# Package Versioning v2

## Problem

Packages have no version concept. The `Packages` table stores one record per package per data context, with bundle files baked directly into it. When a developer rebuilds a package, `syncPeersCoreBundle()` detects the hash change and overwrites the package in every data context — personal and all groups. This means:

- A developer working on a beta feature pushes in-progress code to everyone in their groups
- No way for a group to stay on a known-good version
- No way to roll back to a previous version
- No way to distinguish "published release" from "local dev build"
- No version history — each update overwrites the previous build

## Goals

1. **Groups control their own version** — a group stays on a version until an admin explicitly updates it
2. **Developers can iterate without affecting groups** — local builds only update the developer's personal context by default
3. **Version tags/channels** — packages can be tagged (e.g., `stable`, `beta`, `dev`) so groups can follow a channel
4. **Rollback** — groups can revert to a previous version
5. **Version identity** — a composite hash lets you answer "is this the exact same code?" regardless of version strings

## Design

### Two Tables

Split the current `Packages` table into two: `Packages` (identity + install state) and `PackageVersions` (version-specific build data).

#### `Packages` (slimmed down)

Keeps the same `packageId` primary key and per-data-context semantics. A record's presence still means "this package is installed in this data context." Bundle fields move out; version control fields move in.

```typescript
const packagesSchema = z.object({
  packageId: zodPeerId,
  name: z.string(),
  description: z.string(),
  createdBy: zodPeerId.describe('The user who created the package'),
  localPath: z.string().describe('The local path where the package source lives (device-specific)'),
  remoteRepo: z.string().optional().describe('The remote repository URL'),
  disabled: z.boolean().optional().describe('Whether the package is loaded at runtime'),

  // Version control (new)
  activePackageVersionId: zodPeerId.optional()
    .describe('FK → PackageVersions. The version currently active in this data context'),
  versionPinned: z.boolean().optional()
    .describe('If true, auto-update will never change the active version'),
  followVersionTag: z.string().optional()
    .describe('Auto-update to new versions with this tag (e.g., "stable", "beta")'),

  signature: z.string().describe('Signed hash of this record (excluding signature itself)'),
});
```

**Removed fields** (moved to `PackageVersions`):
- `packageBundleFileId`, `packageBundleFileHash`
- `routesBundleFileId`, `routesBundleFileHash`
- `uiBundleFileId`, `uiBundleFileHash`
- `appNavs`

#### `PackageVersions` (new)

Multiple records per package. Each record represents a specific build with its bundle files.

```typescript
const packageVersionsSchema = z.object({
  packageVersionId: zodPeerId.describe('Primary key'),
  packageId: zodPeerId.describe('FK → Packages'),
  version: z.string().default('0.0.1').describe('Semver version string (e.g., "1.2.3")'),
  versionTag: z.string().default('stable').describe('Channel tag: "stable", "beta", "dev"'),
  packageVersionHash: z.string()
    .describe('SHA-256 hash of the three bundle hashes combined — single value for "is this the same code?"'),

  // Bundle files (moved from Packages)
  packageBundleFileId: zodPeerId.describe('File ID of the package bundle'),
  packageBundleFileHash: z.string().describe('Hash of the package bundle file'),
  routesBundleFileId: zodPeerId.optional().describe('File ID of the routes bundle'),
  routesBundleFileHash: z.string().optional().describe('Hash of the routes bundle'),
  uiBundleFileId: zodPeerId.optional().describe('File ID of the UI bundle'),
  uiBundleFileHash: z.string().optional().describe('Hash of the UI bundle'),
  appNavs: appNavSchema.array().optional().describe('Navigation items extracted from this version'),

  signature: z.string().describe('Signed hash of this record (excluding signature itself)'),
  createdBy: zodPeerId.optional().describe('The user who published this version'),
  createdAt: z.string().describe('ISO timestamp of when this version was created'),
});
```

### `packageVersionHash`

A composite hash of the three bundle hashes, computed as:

```typescript
const hash = SHA256([packageBundleFileHash, routesBundleFileHash ?? '', uiBundleFileHash ?? ''].join(':'))
```

This is the **primary identity** for version content. The hash — not the semver string — determines whether two builds are the same code.

### Version Mutability Rules

Version records are **immutable by default**, with one exception: beta tags.

**Stable versions** (`versionTag` is absent or does not start with `"beta"`):
- When a new build arrives, compute its `packageVersionHash`
- If a record with that hash already exists for this package → **skip**, already have it
- If the hash is different (even if the semver string is the same) → **create a new record**
- Existing records are never modified or deleted automatically
- Users choose which version to activate via UI

**Beta versions** (`versionTag?.startsWith('beta')` — matches `"beta"`, `"betatest"`, `"beta-1.2.3"`, etc.):
- When a new build arrives, find the existing record with the same `packageId` and `versionTag`
- **Update it in-place** with the new bundle files and hash
- This keeps the version list clean during rapid iteration — no clutter from dozens of dev builds
- The `packageVersionId` stays the same, so any `activePackageVersionId` pointers still resolve

**Promoting beta to stable**: When a developer removes the beta tag and rebuilds, that creates a new stable record (different tag = different record). The old beta record remains unless manually cleaned up.

**No automatic cleanup**: Version records (beta or stable) are never automatically deleted. Cleanup is left to users, with possible future config for retention policies.

### Version Sources

A package version originates from the developer's `package.json`:

```json
{
  "name": "peers-core",
  "version": "1.3.0",
  "peers": {
    "packageId": "00mh0wlipkdbeaw...",
    "versionTag": "stable"
  }
}
```

`getPackageInfoFromDir()` already reads `package.json` — extend it to also read `version` and `peers.versionTag`.

### How Operations Change

| Operation | Current | New |
|-----------|---------|-----|
| Build (beta) | Overwrite bundle fields on Packages | Update existing PackageVersions record in-place |
| Build (stable) | Overwrite bundle fields on Packages | Create new PackageVersions record if hash is new; skip if already exists |
| Install in group | Copy Packages record + bundle files | Copy Packages + relevant PackageVersions records + bundle files |
| Activate a version | N/A | Set `activePackageVersionId` to chosen version |
| Rollback | Not possible | Set `activePackageVersionId` to a previous version |
| Check if up-to-date | Compare single bundle hash | Compare active version's `packageVersionHash` |

### How `syncPeersCoreBundle()` Changes

```
for each dataContext:
  pkg = get peers-core Packages record
  activeVersion = get PackageVersions(pkg.activePackageVersionId)

  if pkg is null:
    install from bundled files (unchanged)
    continue

  if pkg.versionPinned:
    skip (group has explicitly pinned)
    continue

  if dataContext is userDataContext (personal):
    always update (developer's own space)
    continue

  // For group contexts:
  if pkg.followVersionTag and diskVersionTag and pkg.followVersionTag == diskVersionTag:
    update (group follows this tag and it matches)
  else:
    skip (different tag or no tag preference)
```

"Update" means: call `updatePackageBundle()`, which applies the beta/stable logic (beta → update in-place, stable → create new record only if hash is new).

### How `updatePackageBundle()` Changes

Instead of overwriting bundle fields on the Packages record:

1. Read bundle files from disk
2. Compute `packageVersionHash` from the three file hashes
3. Read `version` and `versionTag` from `package.json`. If `versionTag` is absent, normalize to `"stable"`
4. **If beta** (`versionTag?.startsWith('beta')`):
   - Find existing PackageVersions record with same `packageId` and `versionTag`
   - If found, update it in-place with new bundle files and hash
   - If not found, create a new record
   - Set as active
5. **If stable** (not beta):
   - Check if a PackageVersions record with this `packageVersionHash` already exists for this package
   - If yes → skip (already have this exact build)
   - If no → create a new PackageVersions record
   - Do NOT automatically set as active (user chooses via UI) — except for personal context where it auto-activates
6. Load the package from the active version and install contents (assistants, workflows, etc.)

### How Package Loader Changes

`PackageLoader.loadPackage(pkg)` currently reads `pkg.packageBundleFileId`. With versioning:

1. Read `pkg.activePackageVersionId`
2. Fetch the `PackageVersions` record
3. Read bundle from `packageVersion.packageBundleFileId`
4. Cache by `packageId` (unchanged)

### How `copyPackageToAnotherDataContext()` Changes

Currently copies the Packages record + bundle files. New behavior:

1. Copy the Packages record (with `activePackageVersionId`)
2. Copy the active PackageVersions record
3. Copy all referenced bundle files

Only the active version is copied by default. Copying full version history for rollback capability is a future enhancement.

### Group Admin Controls

Group admins can manage package versions through:

1. **Pin a version**: Set `versionPinned = true` — prevents any auto-updates
2. **Follow a tag**: Set `followVersionTag = "stable"` — auto-updates when a matching version arrives
3. **Manual update**: Explicitly update regardless of pin/tag settings
4. **Rollback**: Set `activePackageVersionId` to a previous version's ID

These can be exposed in UI later (package management screen). For now, they work via the existing RPC/CLI.

### Migration

Existing `Packages` records have bundle fields but no `PackageVersions` record. On first run after upgrade:

1. For each Packages record that has bundle data:
   - Create a `PackageVersions` record from its bundle fields
   - Compute `packageVersionHash`
   - Set `activePackageVersionId` to point to the new record
2. Bundle fields on Packages become optional during transition
3. `version` defaults to `'0.0.1'` and `versionTag` defaults to `'stable'` for migrated records
4. `versionPinned` defaults to undefined (treated as false)
5. `followVersionTag` defaults to undefined — groups with no tag are NOT auto-updated (safe default)

This means after deploying, existing groups stop getting auto-updated. Developers explicitly set `followVersionTag = "stable"` on groups that should auto-update.

### Security

Both tables need signature verification for group data contexts:

- **Packages signature**: covers install config changes (active version, pin, tag)
- **PackageVersions signature**: covers version content (bundle file references, hashes)

The existing `PackagesTable.signAndSave()` pattern extends to `PackageVersionsTable` with the same signature verification logic.

## Files to Modify

| File | Change |
|------|--------|
| `peers-sdk/src/data/packages.ts` | Remove bundle fields, add `activePackageVersionId`, `versionPinned`, `followVersionTag` |
| `peers-sdk/src/data/package-versions.ts` | **New file** — PackageVersions table definition, schema, factory function |
| `peers-sdk/src/data/packages.utils.ts` | Update `copyPackageToAnotherDataContext` to copy PackageVersions records + files |
| `peers-sdk/src/package-loader/package-loader.ts` | Resolve bundle via `activePackageVersionId` → PackageVersions record |
| `peers-electron/src/server/package-installer.ts` | Update all operations to create PackageVersions records instead of overwriting Packages bundle fields |
| `peers-electron/src/server/peers-init.ts` | Add migration logic for existing packages |
| `peers-core/package.json` | Add `version` and `peers.versionTag` fields |

## Forward Compatibility with Contracts

This design is fully additive for the contract system (see `design/package-contracts-v2.md`). When contracts are implemented, they would add a `PackageContracts` table referencing `PackageVersions` — "this version implements these contracts at these versions." The versioning layer provides exactly what contracts need: a stable version identity to attach contract declarations to.

## Open Questions

- ~~**`versionPinned` + `followVersionTag`** as separate fields, or a single `updatePolicy` enum?~~ **Resolved: keep separate.** They're orthogonal — `versionPinned` is a hard lock, `followVersionTag` is the auto-update policy when not pinned. A single enum would conflate "don't touch this" with "update strategy."
- **Dependencies**: should `PackageVersions` have a `dependencies` field now (for both JS lib deps and Peers package deps), or leave for later?
