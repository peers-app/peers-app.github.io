---
sidebar_position: 1
title: Getting started
---

# Packages

Peers **packages** are how the app loads extensible behavior: **tables** and **tools** (and related metadata) on the server/runtime side, **routes** for URL mapping in the browser, and **UI bundles** for React screens. The desktop app and PWA install package versions from bundled assets or synced updates, then activate a version per data context (personal space or group).

At a high level, a package contributes:

- **Runtime (Node / Electron main, or PWA runtime)** — table definitions, tool instances, assistants, workflows, and navigation metadata (`appNavs`).
- **Routes** — small bundle that registers URL paths before UI loads.
- **UI** — lazy-loaded React components registered by `peersUIId`.

## Package lifecycle

Packages follow a **three-phase lifecycle**: `dev` → `beta` → `stable`.

| Phase | How it's created | Who sees it |
|-------|-----------------|-------------|
| **dev** | Automatically when code is loaded from disk | Only the local device — never auto-activates on other devices |
| **beta** | Promoted via the UI or `promote-package-version` tool | Devices following `stable+beta` |
| **stable** | Promoted via the UI or `promote-package-version` tool | All devices (default follow policy) |

Key points:

- **Disk updates always create dev versions.** The `versionTag` is determined by the platform, not set in code.
- **Dev versions are device-local.** They sync to the group but never auto-activate on other devices unless a device explicitly opts in.
- **Promotion is explicit.** Use the promote button in the package versions UI, or call the `promote-package-version` tool from a CI pipeline or AI assistant.
- **Writers can create dev versions.** Only Admins can promote to beta or stable.
- **Contracts are finalized on stable promotion.** When a package version is promoted to stable, all its dev contracts are frozen (immutable).

See [Package lifecycle design](../Roadmap/package-lifecycle) for the full design rationale and implementation details.

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

- **[Package contracts](./contracts)** — versioned interfaces between packages (`definePackage`, validation, registry).
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — full design for the three-phase dev/beta/stable lifecycle.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
