---
sidebar_position: 1
title: Getting started
---

# Packages

Peers **packages** are how the app loads extensible behavior: **tables** and **tools** (and related metadata) on the server/runtime side, **routes** for URL mapping in the browser, and **UI bundles** for React screens. The desktop app and PWA install package versions from bundled assets or synced updates, then each **device** chooses which version to run within a group (or personal space), using group-level defaults on `IPackage` when the device has no override.

At a high level, a package contributes:

- **Runtime (Node / Electron main, or PWA runtime)** — table definitions, tool instances, assistants, workflows, and navigation metadata (`appNavs`).
- **Routes** — small bundle that registers URL paths before UI loads.
- **UI** — lazy-loaded React components registered by `peersUIId`.

## Package lifecycle

Packages follow a **three-phase lifecycle**: `dev` → `beta` → `stable`. Disk updates create **dev** versions; promotion to beta or stable is explicit in the **Versions** UI. Dev records sync to the group but **never auto-activate on other devices** unless those devices opt in.

When you **activate** a different version on this device, routes and UI bundles reload without a full page refresh.

See **[Package lifecycle](./package-lifecycle)** for development workflow, per-device pin/follow settings, and releasing to the group. See [Package lifecycle design](../Roadmap/package-lifecycle) for design rationale and remaining roadmap work.

## Defining a package

Use `definePackage()` from `@peers-app/peers-sdk` to declare a package:

```typescript
import { definePackage } from "@peers-app/peers-sdk";
import { version } from "../package.json";

const packageDefinition = definePackage((pkg) => {
  pkg.packageId = packageId;
  pkg.version = version;

  const main = pkg.contract(contractId, 1, "My App");
  main.tables = [/* table definitions */];
  main.tools = [/* tool instances */];
  main.toolInstances = [/* executable tool instances */];
  main.tableDefinitions = [/* runtime table definitions */];

  pkg.appNavs = [{
    name: "My App",
    iconClassName: "bi bi-app",
    navigationPath: "app",
  }];
});

(exports as any).packageDefinition = packageDefinition;
```

Note: `versionTag` and contract `devTag` are **not** set in code. The platform assigns these based on the package's promotion state.

## Related topics

- **[Package lifecycle](./package-lifecycle)** — develop, release, and run versions (dev / beta / stable).
- **[Package contracts](./contracts)** — versioned interfaces between packages (`definePackage`, validation, registry).
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design doc and shipped vs planned work.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
