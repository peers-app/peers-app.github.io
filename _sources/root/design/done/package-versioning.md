# Package Versioning

## Problem

Today, packages have no version concept. When a developer rebuilds peers-core (or any package) locally, `syncPeersCoreBundle()` detects the hash change on startup and overwrites the package in **every** data context — personal and all groups. Those changes then sync to every other group member. This means:

- A developer working on a beta feature pushes their in-progress code to everyone in their groups
- There's no way for a group to stay on a known-good version
- There's no way to roll back to a previous version
- No way to distinguish "published release" from "local dev build"

## Goals

1. **Groups control their own version** — a group stays on a version until an admin explicitly updates it
2. **Developers can work on packages without affecting groups** — local builds only update the developer's personal context by default
3. **Version tags/channels** — packages can be tagged (e.g., `stable`, `beta`, `dev`) so groups can follow a channel
4. **Minimal schema change** — build on the existing package model, don't over-engineer

## Design

### Schema Changes

Add three fields to `IPackage` (in `peers-sdk/src/data/packages.ts`):

```typescript
const schema = z.object({
  // ... existing fields ...
  version: z.string().optional()
    .describe('Semver version string (e.g., "1.2.3"). Undefined for unversioned/legacy packages'),
  versionTag: z.string().optional()
    .describe('Channel tag (e.g., "stable", "beta", "dev"). Groups can follow a tag to auto-update'),
  versionPinned: z.boolean().optional()
    .describe('If true, this package will not be auto-updated by syncPeersCoreBundle or similar mechanisms'),
});
```

**Why these fields:**
- `version` — human-readable semver string. Used to compare versions and display in UI. Package developers set this explicitly when publishing.
- `versionTag` — a channel label. Groups can be configured to follow a tag. When a new version is published with tag `stable`, all groups following `stable` for that package auto-update.
- `versionPinned` — simple override. If true, no auto-update happens regardless of tag. The group admin must manually update.

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

### How `syncPeersCoreBundle()` Changes

Current behavior: updates peers-core in ALL data contexts if hash changed.

New behavior:

```
for each dataContext:
  pkg = get peers-core package from dataContext

  if pkg is null:
    install from bundled files (unchanged)
    continue

  if pkg.versionPinned:
    skip (group has explicitly pinned their version)
    continue

  if dataContext is userDataContext (personal):
    always update (developer's own space)
    continue

  // For group contexts:
  if pkg.versionTag and diskVersionTag and pkg.versionTag == diskVersionTag:
    update (group follows this tag and the tag matches)
  else:
    skip (group is on a different tag or has no tag preference)
```

This means:
- **Personal context**: always gets the latest local build (developer needs their own latest code)
- **Groups with `versionPinned: true`**: never auto-updated
- **Groups following a tag**: only updated when the local build's tag matches
- **Groups with no tag**: not auto-updated (safe default for existing groups after migration)

### How `updatePackageBundle()` Changes

Same gating logic. When called for a specific package in a specific data context, check `versionPinned` and `versionTag` before proceeding. The function already takes `(dataContext, pkg)` so this is straightforward.

After updating, set `pkg.version` and `pkg.versionTag` from the freshly-read package info.

### Publishing a Version

No new RPC needed initially. The existing `addOrUpdatePackage` flow handles it:

1. Developer bumps `version` in `package.json`, sets `peers.versionTag` to `"stable"`
2. Runs `npm run build`
3. Runs `peers package update <packageId>` (existing CLI command)
4. The update flow reads the new version/tag from `package.json` and saves it to the package record
5. The package record syncs to group members via existing P2P sync
6. On peer devices, the new bundle is received and loaded

For peers-core specifically, the flow is:
1. Developer bumps version in `peers-core/package.json`
2. Rebuilds peers-electron (which bundles peers-core)
3. On next startup, `syncPeersCoreBundle()` applies the gating logic above

### Group Admin Controls

Group admins can manage package versions through:

1. **Pin a version**: Set `versionPinned = true` on the group's package record — prevents any auto-updates
2. **Follow a tag**: Set `versionTag = "stable"` (or `"beta"`) — auto-updates when a matching version arrives
3. **Manual update**: Explicitly call `addOrUpdatePackage(packageId, { update: true, dataContextId: groupId })` — forces an update regardless of pin/tag

These can be exposed in UI later (package management screen). For now, they work via the existing RPC/CLI.

### `copyPackageToAnotherDataContext()` Changes

When copying a package to a new group, preserve `version` and `versionTag`. Set `versionPinned = false` by default so the group follows the tag. No other changes needed — the function already copies all IPackage fields.

### Migration

Existing packages will have `version: undefined`, `versionTag: undefined`, `versionPinned: undefined`.

Behavior for undefined values:
- `version: undefined` — treated as "unversioned" (no version comparison possible, display as "unknown")
- `versionTag: undefined` — treated as "no channel" — `syncPeersCoreBundle()` will **not** auto-update groups with no tag (safe default)
- `versionPinned: undefined` — treated as `false` (same as current behavior, but now gated by tag matching)

This means after deploying this change, existing groups will stop getting auto-updated (since they have no `versionTag` and the new logic requires tag matching for groups). Developers can then explicitly set tags on groups that should auto-update.

For peers-core specifically, we should set the bundled version's tag to `"stable"` so that groups can opt into auto-updates by setting their peers-core `versionTag` to `"stable"`.

## Files to Modify

| File | Change |
|------|--------|
| `peers-sdk/src/data/packages.ts` | Add `version`, `versionTag`, `versionPinned` to schema |
| `peers-electron/src/server/package-installer.ts` | Update `syncPeersCoreBundle()`, `updatePackageBundle()`, `getPackageInfoFromDir()` to read/respect version fields |
| `peers-sdk/src/data/packages.utils.ts` | No changes needed (copies all fields already) |
| `peers-core/package.json` | Add `version` and `peers.versionTag` fields |

## What This Doesn't Cover (Future Work)

- **Version history browsing** — storing multiple versions of a package for rollback. Currently only the current version is stored per-context. A `PackageVersions` table could be added later.
- **Version comparison / upgrade prompts** — UI to show "version 1.3.0 available, you're on 1.2.0"
- **Dependency versioning** — packages depending on specific versions of other packages
- **Signed releases** — cryptographic proof that a version was published by the package author (the signature system exists but doesn't cover version integrity across the publish flow)
