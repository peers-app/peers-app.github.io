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
| **Group defaults** | `IPackage` record (synced) | `activePackageVersionId`, `versionFollowRange`, `followVersionTags` — recommended version and follow policy for **new** devices |
| **Device preferences** | `groupDeviceVar` per package (`packagePrefs_${packageId}`) | Which version **this device** runs, pin state, and per-device follow overrides |

When a device has no package prefs yet, it falls back to the group defaults on `IPackage`. After you activate or pin a version on this device, that choice is stored in device prefs and used for resolution, UI badges, and bundle loading.

Activating a **non-dev** version in the Versions tab also updates the group default `activePackageVersionId` so other devices can discover it as the recommended stable/beta release. Activating a **dev** version updates only this device.

## Day-to-day development

1. **Edit your package on disk** (local path in Package settings).
2. **Reload or restart** the app (or use your usual dev workflow). The installer creates or updates a **dev** package version from the bundle on disk.
3. **Dev versions sync** to the group as `PackageVersions` records, but **other devices do not auto-switch** to dev.
4. Open **Packages → your package → Versions** to see versions, hashes, and tags. Use **Activate** to run a specific version on **this device**, or **Pin** to stop auto-updates on the active version.

Routes and UI bundles reload when you change the active version on this device (no full page refresh required).

## Releasing to the group

1. In **Versions**, use **Promote** on a dev version: **dev → beta** or **dev → stable** (or **beta → stable**).
2. Promotion updates the version’s `versionTag` and appends to the version’s signed `history` audit trail.
3. Promoting to **stable** typically sets the group’s recommended `activePackageVersionId` when you activate that release; devices that follow stable will pick it up on their next resolve/sync according to their follow policy.

**Today:** promotion and activation are done in the **package Versions UI**.

**Planned:** `promote-package-version` and `set-active-package-version` tools for CI and AI assistants (same behavior as the UI, single code path). See [Package lifecycle design](../Roadmap/package-lifecycle).

### Permissions

| Action | Typical role |
|--------|----------------|
| Create / update dev versions (disk reload) | Writer |
| Promote to beta or stable | Admin |
| Activate or pin on a device | Per product rules (often Admin for group default; device prefs for local choice) |

Personal space (no group) bypasses group role checks for your own packages.

## Per-device settings (Package Info)

On the package **Info** tab, settings apply to **this device** unless noted:

- **Auto-update range** — pinned (no auto-updates), patch, minor, or latest. Overrides the group `versionFollowRange` when set.
- **Follow version tags** — e.g. `stable`, `stable,beta`, or `*`. Overrides group `followVersionTags` when set. Empty means use the group default.
- **Active version** — shown from device prefs with fallback to the group default.

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
