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
| **dev** | Automatically when code is loaded from disk | Yes (version records sync) | **Never** — unless a device explicitly opts in |
| **beta** | Promote in the package Versions UI | Yes | Only on devices following `stable,beta` or `*` |
| **stable** | Promote in the package Versions UI | Yes | On devices using the default follow policy (`stable`) |

The platform assigns `versionTag` (dev / beta / stable). Do not set it in `definePackage()` or in contract definitions.

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
- Automatic non-dev upgrades advance the group active version only when the device is following group settings and the current user is a group Admin or higher. Otherwise the upgrade remains local to the device.

## Day-to-day development

1. **Edit your package on disk** (local path in Package settings).
2. **Reload or restart** the app (or use your usual dev workflow). The installer creates or updates a **dev** package version from the bundle on disk.
3. **Dev versions sync** to the group as `PackageVersions` records, but **other devices do not auto-switch** to dev.
4. Open **Packages → your package → Versions** to see versions, hashes, and tags. Use **Activate** on a dev version to run it on **this device** without changing the group active version.

Routes and UI bundles reload when you change the active version on this device (no full page refresh required).

## Releasing to the group

1. In **Versions**, use **Promote** on a dev version: **dev → beta** or **dev → stable** (or **beta → stable**).
2. Promotion updates the version’s `versionTag` and appends to the version’s signed `history` audit trail.
3. Activating a promoted beta or stable release with device override off sets the group `activePackageVersionId`; devices following the group pick it up on their next resolve/sync according to their follow policy.

**Today:** promotion and activation are done in the **package Versions UI**.

**Planned:** `promote-package-version` and `set-active-package-version` tools for CI and AI assistants (same behavior as the UI, single code path). See [Package lifecycle design](../Roadmap/package-lifecycle).

### Permissions

| Action | Typical role |
|--------|----------------|
| Create / update dev versions (disk reload) | Writer |
| Promote to beta or stable | Admin |
| Activate beta/stable for the group | Admin |
| Activate dev or use device override | Local device choice |
| Pin a device | Local device choice |

Personal space (no group) bypasses group role checks for your own packages.

## Package Info Settings

On the package **Info** tab, **Auto-update range** and **Following** edit group settings by default. Enable **Override on this device** to make those controls local to the current device.

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

Contract maturity is tied to package promotion. New contract shapes can evolve freely in **dev** builds. The platform is designed to **finalize** contracts (remove dev tag, freeze shape) when a package version is promoted to **stable**.

If you need to extend a **frozen** contract after stable, increment the contract version and use **`alsoImplements`** so providers remain compatible with older consumers. See [Package contracts](./contracts).

## Related

- [Getting started](./getting-started) — what packages contain and `definePackage()` basics
- [Package contracts](./contracts) — versioned interfaces, validation, `alsoImplements`
- [Package lifecycle design](../Roadmap/package-lifecycle) — design doc, shipped vs planned work
- [Variables (pvars)](../System/Variables) — `groupDeviceVar` and other persistent variable scopes
