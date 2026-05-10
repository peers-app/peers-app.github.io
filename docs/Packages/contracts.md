---
sidebar_position: 2
title: Package contracts
---

# Package contracts

**Package contracts** are a planned way for packages to depend on **stable, versioned interfaces** (tables, tools, observables) instead of hard-coded table or tool IDs. Multiple packages can **provide** the same contract; a group picks an **active provider**. Consumers declare what they **consume**; the runtime resolves those declarations to the active implementation.

A first **V1 implementation** lives in **`@peers-app/peers-sdk`** under `src/contracts/`. It is **standalone**: it does not hook into package install, the database, or the UI yet. It exists so the model can be exercised with unit and integration tests before the rest of the codebase migrates.

## What ships today (V1)

| Piece | Role |
| --- | --- |
| **`definePackage` / `PackageBuilder` / `ContractBuilder`** | Authoring API: declare one or more contracts per package via `pkg.contract(contractId, version, devTag?)`, assign `ITableDefinition`-like tables and tool-shaped instances, optional `alsoImplements`, and `consumes` dependencies. Pass **`"dev"`** as the third argument when the contract shape is still allowed to change between registrations. |
| **Shape extraction** | Builds pure-data contract shapes (using existing `IField[]` via `schemaToFields` where a Zod schema is present). |
| **Validation** | Checks that a provider’s shape is a **superset** of a contract (field names, types, optionality, arrays, tools, observables), validates **stable vs in-development** (`devTag`) immutability rules, and validates **`alsoImplements`** against stored contract definitions. |
| **`ContractRegistry`** | In-memory registry: register providers, resolve the active definition, swap providers, unregister, and **`checkConsumerDependencies`** for install-time-style checks. |

The module is implemented under **`peers-sdk/src/contracts/`** with a barrel file **`index.ts`**. It is **not yet re-exported** from the published `@peers-app/peers-sdk` root (`dist/index.js`); until that lands, monorepo code can import from the source path your TypeScript config already maps for peers-sdk (for example `…/peers-sdk/src/contracts` or a path alias you use for dogfooding).

### Stable vs in-development contracts

Each contract version is keyed only by **`contractId` + `version`** in the registry (`contractKey`). Optional **`devTag: "dev"`** on `IContractDefinition` means the shape is **not frozen yet**: registrations may replace the stored definition with a different tables/tools/observables shape. Omit **`devTag`** for a **stable** contract: its shape must match on every subsequent registration for that key.

Lifecycle is one-way: you can move from **dev** to **stable** by registering without **`devTag`**. After a stable definition exists for that contract version, the registry **rejects** new registrations that use **`devTag`**.

## What is intentionally out of scope (for now)

- Persisting contract definitions or provider choice in SQLite / sync.
- Replacing today’s `IPeersPackage` object export with `definePackage` in `peers-core` or other packages.
- Typed consumer proxies (`peers.contract(id, version)`) and codegen from a richer type IR than `IField[]`.

Those steps are follow-on work once the in-memory behavior and tests are trusted in production-like scenarios.

## Related topics

- **[Getting started](./getting-started)** — where this Packages section fits in the doc set.
- **[System: Tables](../System/Tables)** — field-level shapes today use `IField` / Zod-derived metadata.
