---
sidebar_position: 2
title: Package contracts
---

# Package contracts

**Package contracts** define **stable, versioned interfaces** (tables, tools, observables) that packages can depend on instead of hard-coded table or tool IDs. Multiple packages can **provide** the same contract; a group picks an **active provider**. Consumers declare what they **consume**; the runtime resolves those declarations to the active implementation.

The implementation lives in **`@peers-app/peers-sdk`** under `src/contracts/` and is integrated into the package install flow. Packages use `definePackage()` to declare contracts, and the `PackageLoader` and `installContractPackage` functions handle registration at install time.

## Core components

| Piece | Role |
| --- | --- |
| **`definePackage` / `PackageBuilder` / `ContractBuilder`** | Authoring API: declare **zero or more** contracts per package via `pkg.contract(contractId, version, name)`. Assign tables, tools, observables, `alsoImplements` declarations, and `consumes` dependencies on each `ContractBuilder`. |
| **Shape extraction** | Builds pure-data contract shapes from `IField[]` (derived from Zod schemas via `schemaToFields`). |
| **Validation** | Checks that a provider's shape is a **superset** of a contract (field names, types, optionality, arrays, tools, observables), validates **immutability** rules, and validates **`alsoImplements`** against stored contract definitions. |
| **`ContractRegistry`** | In-memory registry: register providers, resolve the active definition, swap providers, unregister, finalize contracts, and check consumer dependencies. |

## Contract lifecycle and promotion

Contract maturity is **coupled to the package lifecycle**. Developers do not set `devTag` in code — the platform manages it:

- **Dev package versions**: new contracts are registered with `devTag: "dev"` (shape can change freely). Previously-frozen contracts are preserved as stable.
- **Beta package versions**: same as dev — contracts can still evolve during testing.
- **Stable package versions**: all remaining dev contracts are **finalized** (devTag removed, shape frozen). This happens automatically when a package version is promoted to stable.

The lifecycle is one-way: once a contract version is frozen (stable), it **cannot** be re-registered as dev. The registry rejects such attempts.

### Evolving stable contracts with `alsoImplements`

When you need to extend a frozen contract, **increment the version number** and use `alsoImplements` to declare backward compatibility:

```typescript
const main = pkg.contract(contractId, 2, "My App");
// Add new optional fields, tools, etc.
main.alsoImplements(contractId, 1); // v2 satisfies v1
```

The system validates that v2 is a structural superset of v1 — all v1 tables, tools, and observables must exist in v2 with compatible shapes. Consumers of v1 continue to work with any provider of v2.

`alsoImplements` supports single versions or inclusive ranges:

```typescript
main.alsoImplements(contractId, { from: 1, to: 3 }); // v4 satisfies v1, v2, and v3
```

## Tools in contracts

Tools are a core part of a contract's public interface — they are effectively **API calls between packages**. When you declare tools on a contract via `ContractBuilder.tools(...)`, `extractToolShape` reads `ITool.inputSchema.fields` and `ITool.outputSchema.fields` to produce an `IContractTool` with `inputFields` and `outputFields`.

**Always derive `IField[]` from Zod using `schemaToFields()`** rather than writing field arrays by hand. This ensures:

1. The TypeScript types (inferred from Zod) match the contract-facing metadata exactly.
2. No silent drift between what the `toolFn` accepts and what the contract advertises to consumers.
3. A single place to update when adding or changing a field.

```typescript
const inputSchema = z.object({
  name: z.string().describe("Item name"),
});

const myTool: ITool = {
  // ...
  inputSchema: {
    type: IOSchemaType.complex,
    fields: schemaToFields(inputSchema), // derived, not hand-written
  },
};
```

Contract validation (`validateProviderSatisfiesContract`) checks field-level compatibility — field names, types, optionality, and array flags — between a provider's tools and the contract it claims to implement via `alsoImplements`. If the `IField[]` on your `ITool` doesn't match the target contract's tool signature, registration will fail.

See **[System: Tools](../System/Tools)** for the full tool authoring guide.

## Related topics

- **[Getting started](./getting-started)** — package system overview and lifecycle.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — full design for the three-phase dev/beta/stable lifecycle.
- **[System: Tools](../System/Tools)** — tool authoring, `schemaToFields`, and how tool schemas flow into contracts.
- **[System: Tables](../System/Tables)** — field-level shapes today use `IField` / Zod-derived metadata.
