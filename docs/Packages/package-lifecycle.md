---
sidebar_position: 2
title: Package lifecycle
---

# Package lifecycle

This guide covers how to **develop**, **test**, **release**, and **run** package versions in a group. Each device chooses which version to run; the group shares version records and defaults, but dev work does not automatically switch everyone else.

For the underlying design rationale and remaining roadmap items, see [Package lifecycle design](../Roadmap/package-lifecycle).

## Overview

Packages move through three promotion levels:

```
dev ──▶ beta ──▶ stable
```

| Phase | How it is created | Syncs to the group? | Auto-activates on other devices? |
|-------|-------------------|---------------------|----------------------------------|
| **dev** | Automatically when code is loaded from disk | Yes (version records sync) | **Never**: each device must activate it, then follows its rebuilds until it switches back to a release |
| **beta** | Promote in the package Versions UI or with `peers packages promote` | Yes | Only on devices following `stable,beta` or `*` |
| **stable** | Promote in the package Versions UI or with `peers packages promote` | Yes | On devices using the default follow policy (`stable`) |

The platform assigns `versionTag` (dev / beta / stable). Do not set it in
`definePackage()` or contract definitions.

**Metadata vs bundle bytes:** `PackageVersions` (and related `Files` records) sync as group data. As soon as a version record arrives, this device also downloads that version’s package, routes, and UI bundles into the local chunk cache so later activation or UI load does not wait on a peer. A downloaded version is **not** automatically activated. The device waits until the current sync has applied every page and saved its watermark, then evaluates the final package state once using its pin, follow, and device-override rules. An incompatible bundle can fail to load without blocking metadata sync or preventing a newer version from arriving. If a peer cannot provide a bundle yet, metadata sync still succeeds and the missing chunks retry when another peer becomes available.

## Legacy bundle compatibility

Host bundles in the old format with non-empty `toolInstances` are rejected before
activating tables, staged resolvers or package state; an existing active instance
stays intact. Tool-free bundles still load. Older `definePackage()` bundles load
tables and UI but discard executable assignments with a migration warning. Rebuild
with [contract resolvers](./contracts.md#migrating-from-toolinstances) to restore
execution; pinned versions otherwise retain actionable unavailable catalog records.

## Group defaults vs this device

Two layers work together:

| Layer | Where it lives | Purpose |
|-------|----------------|---------|
| **Group settings** | `IPackage` record (synced) | `activePackageVersionId`, `versionFollowRange`, `followVersionTags` for devices that follow the group |
| **Device preferences** | `groupDeviceVar` per package (`packagePrefs_${packageId}`) | Local active version, pin state, and optional per-device follow overrides |

By default, a device follows the group settings. Turning on **Override on this device** in Package Info makes the auto-update range and release channel local to that device.

Activation scope depends on the version and override state:

- Activating a **non-dev** version with device override **off** updates the group active version.
- Activating a **non-dev** version with device override **on** updates only this device.
- Activating a **dev** version updates only this device, even when override is off.
- Promoting the version this device is already running to a tag the group follows (default `stable`) advances the group active version under the same admin / override / not-pinned rules as Activate.
- Automatic non-dev upgrades advance the group active version only when the device is following group settings and the current user is a group Admin or higher. Otherwise the upgrade remains local to the device.

## Day-to-day development

1. **Edit your package on disk** (local path in Package settings). If a beta or stable release already has the version in `package.json`, bump it first, so the dev build is always the next version. `reload` warns, and `promote` refuses, when a dev build reuses a released version number.
2. **Reload** the package (**Reload Package** in its menu, or `peers packages reload <packageId>`), reload the page, or restart the app. The installer creates or updates a **dev** package version from the bundle on disk and loads it. A reload whose new version fails to load reports the error and leaves the previous version running; `peers packages get <packageId>` shows it.
3. **Dev versions sync** to the group as `PackageVersions` records, and other devices **download those version files immediately**, but they **do not auto-switch** to dev. That holds even for a new package whose only version is dev: other devices show it installed but not running ("Only a dev version is selected; activate it on this device to run it") until someone activates it on that device. A device that activates a dev version keeps loading each rebuild of it, until it activates a beta or stable release, follows the group again, or the dev version is promoted.
4. Open **Packages → your package → Versions** to see versions, hashes, and tags. Use **Activate** on a dev version to run it on **this device** without changing the group active version.

:::warning A failed dev reload leaves old code running
The broken build is still saved as the dev version, but this device keeps running the previous code. Your edits are not live until a reload succeeds, and after a restart (or on another device in the group) the broken version is the one that loads. Check after each reload: `peers packages reload` exits 1 and prints the error, and the Packages screen shows **Update failed**. A page refresh or `peers ui reload` reloads package folders too, but only logs a failure to the developer console.
:::

App icons in the apps list come from `appNavs` on the **active PackageVersion** (copied from
the manifest generated from `pkg.appNavs` when bundles are installed). Startup sync
always persists `appNavs` onto new versions, including when the group is currently on a stable
build.

Routes and UI bundles reload when you change the active version on this device (no full page refresh required). Activating a version (**Activate**, **Use Dev**, **Use Release**, or `peers packages activate`) also loads it on this device's Runtime right away; you do not need to restart.

## Releasing to the group

1. In **Versions**, use **Promote** on a dev version: **dev → beta** or **dev → stable** (or **beta → stable**).
2. Promotion updates the version’s `versionTag`, refreshes `packageAuthorSignature` when a package signing key is available (and clears a stale signature if not), and appends to the version’s signed `history` audit trail. The version number itself is not editable. It is the version baked into the built bundle, and changing only the label makes an isolated package fail to load.
3. If you promote the version this device is **already running**, and the new tag matches the group’s follow policy (default: `stable`; `beta` only when the group follows beta), the group `activePackageVersionId` advances automatically (admin, device follow override off, group not pinned) — same rules as **Activate**. Otherwise use **Activate** on the promoted beta/stable release; devices following the group pick it up on their next resolve/sync.

Promotion and activation are also available to agents and scripts, with the same behavior as the UI (one code path on the host): `peers packages promote <packageVersionId> <beta|stable>` and `peers packages activate`. Get version ids from `peers packages get <packageId>`. See [System: Packages](../System/Packages.md).

## Signed publish artifacts (local)

Use the local-only System Desktop Tools v1 member `publish-package` to build distributable files **on disk** after you have a signing key and built bundles:

```bash
peers tools run publish-package '{"name":"Groceries","versionTag":"beta"}'
```

This writes (by default under `<packageLocalPath>/dist/publish/`):

- A signed `.peers-pkg.tar.gz` containing the three bundles plus metadata
- A `latest-<tag>.json` pointer with version, hashes, and author signature

**Verification expectations before you trust an artifact:**

- Bundle file hashes in the pointer/payload match the files inside the tarball
- `packageAuthorSignature` verifies against `Packages.publishPublicKey`
- Semver in the pointer is what you intend to publish (remote auto-activation requires a **newer** semver than the installed follow candidate)

The Electron resolver binds publication to `dataContext.userContext`, uses the
existing Self-level admission, and retains catalog ID `000peers0tool000publishpk`.
Headless hosts list its catalog row but cannot execute it. Its six string inputs
(`packageId`, `name`, `localPath`, `versionTag`, `version`, `outputDir`) are optional
in the public shape; the implementation requires either `packageId` or `name`.

**Upload / hosting is a separate step.** `publish-package` does not push to S3 or your `updateUrl`. Point `Packages.updateUrl` at a host only after you have uploaded the tarball and pointer yourself (or via your release tooling).

### Permissions

| Action | Typical role |
|--------|----------------|
| List packages, read versions and runtime state | Reader |
| Create / update dev versions (disk reload) | Writer |
| Import, create, clone, install, or uninstall a package | Admin |
| Promote to beta or stable | Admin |
| Activate beta/stable for the group | Admin |
| Activate dev or use device override | Local device choice |
| Pin a device | Local device choice |

Personal space (no group) bypasses group role checks for your own packages. These are the
[System Packages](../System/Packages.md#system-packages-contract) access levels; the UI and
`peers packages` both go through them.

## Package Info Settings

On the package **Info** tab, **Auto-update range** and **Following** edit group settings by default. Enable **Override on this device** to make those controls local to the current device.

- **Update URL** — base URL where admin devices check for new signed releases (`<updateUrl>/latest-<tag>.json`). Edit on the Info tab and save with **Save Changes**. See [Package lifecycle design](../Roadmap/package-lifecycle) for publishing and upload details.
- **Auto-update range** - pinned (no auto-updates), patch, minor, or latest.
- **Following** - `stable` or `stable,beta`.
- **Override on this device** - when enabled, auto-upgrades and manual beta/stable activations affect only this device.

Pinned devices keep their active version even when new stable or beta versions sync in.

## Multi-device testing

To test with other devices before a stable release:

1. Promote your build to **beta** in Versions.
2. On each tester device, set **Follow version tags** to `stable,beta` (or `*`) if you want automatic beta upgrades, or **Activate** the beta version manually.
3. Dev versions remain available for manual activation on any device but never auto-activate elsewhere.

## Contracts and stable releases

Contract maturity follows the package channel. New contract shapes can evolve freely in **dev** and **beta** builds. Stable releases freeze their provided contract versions when loaded. Use the source-controlled guard below to catch incompatible changes before releasing them.

If you need to extend a **frozen** contract after stable, increment the contract version and keep
serving the old version's consumers: list it in **`alsoImplements`** when the new shape satisfies
it (`alsoImplements: [1]`), or provide both versions explicitly. See
[Package contracts](./contracts#evolving-stable-contracts-with-alsoimplements).

### Freeze your contracts before a stable release

A stable release freezes every contract version it provides. Record them in your package, so a
later build can't change one by accident. Before you promote a version to stable, run this in the
package:

```bash
npx peers-package contract freeze
```

It writes `frozen-contracts.json` at the package root: each contract version the package
provides, its shape, and the package version that froze it. Commit it with the release. From then
on:

- `peers-package build` fails when the build would change a frozen version's shape, and names the
  table, tool, observable, or event that changed. New descriptions are fine, and so is a tool's
  `remoteAccessLevel`.
- `npx peers-package contract freeze --check` compares against the recorded versions without
  writing anything, for a test or CI. It passes if no file exists; run `freeze` to record a release.
- At the next stable release, `freeze` adds the contract versions that release introduced and
  keeps the rest. If a frozen version changed, it writes nothing and fails.

Malformed contract definitions and duplicate contract identities fail the check and cannot be frozen.
The check also compares shapes carried by `alsoImplements` against previously frozen versions.

To change a frozen contract, declare a new version, with `alsoImplements` naming the frozen one
when the change is backwards compatible. A package may stop serving a frozen version, neither
providing it nor listing it in `alsoImplements`; the check notes it, since that version's
consumers lose this provider. To check the exact artifact you intend to release, build it with
`peers-package build`, then run
`npx peers-package contract freeze --check --bundle dist/package.bundle.js`. The check reads
the generated manifest without running the provider code. Bundle paths are relative to your
current directory, even with `--root`.

## Related

- [Development and production groups](./development-and-production) — separate test data, release propagation, and current setup limits
- [Getting started](./getting-started) — isolated package structure and build basics
- [Package contracts](./contracts) — versioned interfaces, validation, `alsoImplements`
- [Package lifecycle design](../Roadmap/package-lifecycle) — design doc, shipped vs planned work
- [Variables (pvars)](../System/Variables) — `groupDeviceVar` and other persistent variable scopes
