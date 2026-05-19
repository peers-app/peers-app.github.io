---
sidebar_position: 3
title: "Package lifecycle"
---

# Package lifecycle: unified three-phase development process

**Status:** Partially implemented

**How to use the lifecycle today:** [Package lifecycle](../Packages/package-lifecycle) (user-facing guide).

## Shipped vs planned

| Area | Status |
|------|--------|
| Device-local version prefs (`packagePrefs` `groupDeviceVar`) | Shipped |
| `resolveDevicePackageVersion` (pinned guard, tag match, auto-upgrade, install on upgrade) | Shipped |
| Dev versions never auto-activate on other devices | Shipped |
| UI: effective active version, pin, follow range/tags (Package Info / Versions) | Shipped |
| Routes/UI bundle reload when device prefs change | Shipped |
| `PackageVersions` sync triggers re-resolve | Shipped |
| Promotion UI (dev → beta → stable), `history` on PV records | Shipped |
| `promote-package-version` / `set-active-package-version` tools | Planned |
| Contract finalization on stable promotion | Planned |
| Full removal of `versionTag` / `devTag` from all package sources | Partial / ongoing |

## Background (original motivation)

The package system migrated from a legacy `IPeersPackage` export model to `definePackage()` + contracts. Early gaps included:

1. **App discovery** — `appNavs` from `definePackage()` not reaching the UI (e.g. Tasks missing from launcher). Addressed via PV-backed `appNavs` and loader enrichment.
2. **Competing tag conventions** — tags set in code vs installer vs follow policy. Platform-assigned `versionTag` on promotion is the target model.
3. **No isolation for dev versions** — local disk changes affected other devices. Addressed with device prefs and resolver policy (dev excluded from default follow).
4. **Admin-only dev creation** — Writers can create dev versions per permission design (verify in your group’s policy).

## Design

### Three phases

```
dev ──▶ beta ──▶ stable
```

| Phase | Created by | Syncs to group? | Auto-activates on other devices? |
|-------|-----------|-----------------|----------------------------------|
| **dev** | Disk update (automatic) | Yes (records sync) | Never — excluded from all follow policies unless a device explicitly opts in |
| **beta** | Promote via UI or tool | Yes | Only on devices following `stable+beta` or `*` |
| **stable** | Promote via UI or tool | Yes | On all devices (default follow policy) |

### Rules

1. **Disk updates always create dev versions.** `updatePackageBundle()` assigns `versionTag: "dev"`. The tag is never set in code.
2. **Dev versions never auto-activate on other devices.** `doesTagMatch()` excludes `"dev"` from every follow policy except an explicit `deviceVersionTag: "dev"` override.
3. **Promotion is a platform operation, not a code operation.** `versionTag` and contract `devTag` are removed from the `definePackage()` API. The platform determines the tag based on the promotion state.
4. **Contract devTag is coupled to package promotion.** When a package version is promoted to stable, all its contracts are finalized (devTag removed, shape frozen). Previously-frozen contracts remain frozen in dev builds.
5. **Non-admins (Writers) can create dev versions.** Only promoting to beta or stable requires Admin role.

### Contract evolution via `alsoImplements`

Strict immutability is maintained on frozen contracts. When a developer needs to extend a stable contract shape, they:

1. Increment the contract version (e.g., v1 → v2).
2. Add the new fields/tools/observables (new fields must be optional for backward compat).
3. Declare `alsoImplements(contractId, previousVersion)`.
4. The system validates that v2 is a structural superset of v1 (`validateProviderSatisfiesContract`).
5. Consumers of v1 continue to work with any provider of v2, because v2 satisfies v1's shape.

This keeps contracts frozen once released while making backward-compatible evolution trivial. The `alsoImplements` declaration can target a single version or an inclusive range (`{ from: 1, to: 3 }`).

**Re-registration of frozen contracts:** When a dev build includes a contract version that was previously frozen (promoted to stable in an earlier release), the installer re-registers it as stable (no devTag). The `validateImmutability` check correctly rejects attempts to register a dev version of a stable contract, so the installer must preserve the frozen state rather than trying to mark it dev.

### Content hash vs promotion signature

`computePackageVersionHash` is computed from **code content only** (bundle file hashes). The same code promoted from dev to beta to stable has the same content hash throughout. Promoting a version is a metadata change, not a code change.

The `signature` field on the `PackageVersions` record signs **contentHash + versionTag + identity fields**, so admins attest to "this exact code at this exact promotion level." Anyone can verify the signature to confirm an admin authorized the promotion.

### Audit trail

`PackageVersions` records carry a `history` array. Each significant action appends an entry:

```json
{
  "action": "created | promoted:beta | promoted:stable | activated",
  "by": "<peerId>",
  "at": "<ISO 8601>",
  "signature": "<actor's signature>"
}
```

The signature in each entry is signed by the actor (Writer for dev creation, Admin for promotions). This provides a verifiable audit trail without creating a new table.

### Promotion and activation tools

Promotion and activation are first-class **tools**, not just UI buttons:

| Tool | Purpose | Required role |
|------|---------|--------------|
| `promote-package-version` | Promote dev→beta or beta→stable | Admin |
| `set-active-package-version` | Set the active version for a package | Admin |

Both tools are callable by AI assistants and CI pipelines. The UI promote/activate buttons call these same tools, ensuring a single code path.

### Permission model

| Action | Required role |
|--------|-------------|
| Create a dev version (disk update) | Writer |
| Create/update dev package version records | Writer (signed) |
| Promote to beta | Admin (signed) |
| Promote to stable | Admin (signed) |
| Activate a version | Admin (signed) |
| Pin to a version | Admin (signed) |

Personal space (no group context) bypasses role checks entirely — users can do whatever they want with their own packages.

### `doesTagMatch` behavior

| Follow policy | Matches `dev`? | Matches `beta`? | Matches `stable`? |
|--------------|---------------|----------------|-------------------|
| Default (no `followVersionTags`) | No | Only if active is `beta` | Only if active is `stable` |
| `"stable"` | No | No | Yes |
| `"stable,beta"` | No | Yes | Yes |
| `"*"` | Yes | Yes | Yes |
| `deviceVersionTag: "dev"` override | Yes (only dev) | No | No |

### Special case: peers-core

`peers-core` ships bundled with the Electron app and PWA. The `syncPeersCoreBundle()` startup routine creates versions from the bundled files:

- **Development (unpackaged):** Creates `"dev"` versions, matching the general rule.
- **Production (packaged app):** The bundled peers-core is tagged at build/release time — `"stable"` for GA releases, `"beta"` for beta releases. This is the one case where the tag is determined at build time rather than by developer action or UI promotion.

## Implementation phases

### Phase 1: Fix the immediate bug (Tasks not showing)

- In `PackageLoader._evaluateBundle()`, when the contract path runs, construct a proper `IPeersPackage` return value that includes `appNavs` from the `packageDefinition`.
- `await` the `installContractPackage()` call (currently missing `await` on an async function).
- Fix `syncPeersCoreBundle` appNavs refresh to read from `packageDefinition` when present.
- Investigate the broken `peers-pwa/src/peers-init.ts` import of `installPeersCoreFromBundles`.

### Phase 2: Enforce dev tag on disk updates

- Change `updatePackageBundle()` to use `versionTag: "dev"`.
- Update `doesTagMatch()` to exclude `"dev"` unless explicitly opted in.
- Handle the peers-core special case in `syncPeersCoreBundle()`.

### Phase 3: Remove versionTag and devTag from definePackage API

- Remove `versionTag` setter from `PackageBuilder`.
- Remove `versionTag` from `IPackageDefinitionResult`.
- Remove `devTag` parameter from `PackageBuilder.contract()`.
- Remove `correctPackageVersion` from `PackageLoader`.
- Update all packages (peers-core, groceries, timers, frames, voice-hub) to remove `pkg.versionTag` and contract `devTag` arguments.

### Phase 4: Version hash and signature changes

- Remove `versionTag` from `computePackageVersionHash()`.
- Update signature computation to cover contentHash + versionTag + identity fields.
- Add `history` array field to `PackageVersions` schema.
- Each creation/promotion appends a signed history entry.

### Phase 5: Contract devTag tied to promotion

- On promotion to stable, iterate contracts and re-register without `devTag`.
- On re-registration of an already-frozen contract, preserve stable status.
- Persist finalized contracts in the `Contracts` table.

### Phase 6: Promotion and activation tools

- Create `promote-package-version` tool.
- Create `set-active-package-version` tool.
- Wire UI promote/activate buttons to call these tools.

### Phase 7: Permission model for dev versions

- Allow `GroupMemberRole.Writer` for dev version creation/updates (signatures required, lower role threshold).
- Keep Admin requirement for beta/stable promotion.

### Phase 8: UI improvements

- Update promote dropdown for dev → beta → stable path.
- Add "dev" badge style.
- Add "Follow Channel" UI to package settings.

## Files impacted

| File | Change |
|------|--------|
| `peers-sdk/src/contracts/builder.ts` | Remove versionTag setter, remove devTag param from `contract()` |
| `peers-sdk/src/contracts/types.ts` | Remove versionTag from `IPackageDefinitionResult` |
| `peers-sdk/src/package-loader/contract-package-loader.ts` | Handle appNavs propagation |
| `peers-sdk/src/package-loader/package-loader.ts` | Fix `IPeersPackage` construction, `await` contract install |
| `peers-sdk/src/data/package-permissions.ts` | Allow Writer role for dev versions |
| `peers-sdk/src/data/package-version-permissions.ts` | Allow Writer role for dev versions |
| `peers-sdk/src/data/package-versions.ts` | Remove versionTag from hash, update `doesTagMatch`, add history field |
| `peers-electron/src/server/package-installer.ts` | Dev tag for disk updates, contract finalization on promote |
| `peers-core/src/package.ts` | Remove versionTag and devTag |
| `official-packages/*/src/package.ts` | Remove versionTag and devTag |
| `peers-core/src/tools/` | New promote-package-version and set-active-package-version tools |
| `peers-ui/src/screens/packages/package-versions.tsx` | Promotion UI, dev badge, contract finalization |

## Related

- [Package lifecycle](../Packages/package-lifecycle) — how to develop, release, and run versions
- [Package contracts](../Packages/contracts) — versioned interfaces, `definePackage`, validation, registry
- [Getting started](../Packages/getting-started) — package system overview
- [Tools](../System/Tools) — tool authoring, `schemaToFields`, tool schemas in contracts
