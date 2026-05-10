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

Implementation details (install flows, `Packages` / `PackageVersions` tables, three-bundle layout, and how apps appear in the launcher) are still being written up for this site. For now, treat this section as the home for **package-oriented** documentation that applies across the stack.

## Related topics

- **[Package contracts](./contracts)** — versioned interfaces between packages (`definePackage`, validation, registry). SDK-only today; not yet wired into the live installer.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
