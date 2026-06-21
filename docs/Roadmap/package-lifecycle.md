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

`peers-core` must always be present, so both the Electron app and PWA bundle a copy and also know its S3 `updateUrl`. Install is handled by a single orchestrator, `ensurePeersCore()` (`peers-sdk/src/package-installer/peers-core-installer.ts`), which applies a layered strategy and is a no-op when the context already has a peers-core version:

1. **Copy from another context** that already has peers-core (used for new groups — see below).
2. **Remote install** from the S3 `updateUrl` (`checkAndInstallPackageRemoteVersion`, after creating the `Packages` record).
3. **Bundled fallback** — seed the copy shipped with the app via `seedPackageInContext()` (used when offline).

**New users (personal context):** at startup `ensurePeersCore` installs from the S3 `updateUrl` first and falls back to the bundled copy when offline, so a new user always gets the latest stable peers-core immediately. In **dev (unpackaged) Electron** the bundled `"dev"` copy is preferred first to preserve the local dev loop. In a **packaged** app the bundled copy is tagged `"stable"` for GA releases / `"beta"` for beta releases (the one case where the tag is set at build time).

**New groups:** group creation (both the Group Switcher and the Groups screen) calls the `seedBundledPeersCore` RPC, which runs `ensurePeersCore` with `copyFromContexts` set to the personal context plus the user's other groups. peers-core is copied from the first context that already has it, falling back to the remote `updateUrl`, then the bundle. Copying is preferred because the bundle already exists locally and avoids a network round-trip.

After install, remote updates continue to be checked via the package's `updateUrl` (admin-only, after a 60-second delay). Downloaded versions carry a `packageAuthorSignature` verified against the package's `publishPublicKey` (TOFU). Signed versions propagate automatically across groups via `PackageVersions.dataChanged` watchers.

### Publishing packages

Packages are published using the `publish-package` system tool (desktop only):

```bash
peers tools run publish-package '{"name":"peers-core"}'
```

This produces a signed `.peers-pkg.tar.gz` tarball and a `latest-<tag>.json` pointer file in the package's `dist/publish/` directory. Upload these files to the package's `updateUrl` host (e.g. S3) for remote distribution. The tool does not upload — artifact hosting is a separate concern.

If `publishPublicKey` is not set on the package record, the tool derives it from the Ed25519 public key implied by the personal `packageSigningKey_<packageId>` secret persistent variable, then backfills the package record when publish succeeds.

#### CORS is required for PWA clients

The remote update check is a plain `fetch()` against `<updateUrl>/latest-<tag>.json` (and the tarball). In the **PWA** (running in a browser at `peers.app`) this is a cross-origin request, so the host serving the `updateUrl` must return `Access-Control-Allow-Origin` headers — otherwise the browser blocks the response and the check fails with `TypeError: Failed to fetch`. **Electron is unaffected** (Node's fetch does not enforce CORS), so a self-hosted package can appear to work in the desktop app while silently failing for PWA users.

If you self-host a package's `updateUrl`, configure CORS on that host to allow `GET`/`HEAD` from the PWA origin (or `*` for public artifacts). Distribution is primarily peer-to-peer, so this only affects browser-based remote update checks against your own host.

#### peers-core: published automatically during full-release

`peers-core` is published to S3 as the **last step of `full-release.js`**, with no running Peers app required. The release calls `scripts/publish-peers-core.mjs --version-tag stable --skip-build`, which signs the freshly built bundles in-process using the pure peers-sdk signing functions, verifies the artifact against `peersCorePublishPublicKey`, and uploads the tarball + pointer to S3.

Standalone signing reads the signing key from `PEERS_CORE_SIGNING_KEY` (in the environment or `peers-electron/.env`, alongside the AWS credentials). The key's public key must match `peersCorePublishPublicKey` or the script aborts (devices would otherwise reject the tarball under TOFU). If `PEERS_CORE_SIGNING_KEY` is not set, the script falls back to invoking the `publish-package` tool over RPC, which does require the Peers app to be running.

The publish script also ensures the S3 bucket has a CORS policy (allowing `GET`/`HEAD` from any origin) on every upload so PWA clients can fetch the pointer and tarball. Run `node scripts/publish-peers-core.mjs --setup-cors` to (re)apply the policy without publishing. Applying CORS requires `s3:PutBucketCors`; if the publishing credentials lack it, the script warns (non-fatal) and prints the manual `aws s3api put-bucket-cors` command.

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
