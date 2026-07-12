---
sidebar_position: 3
title: Package contracts
---

# Package contracts

**Package contracts** define **stable, versioned interfaces** (tables, tools, observables, and events) that packages can depend on instead of hard-coded table or tool IDs. Multiple packages can **provide** the same contract; a group picks an **active provider**. Consumers declare what they **consume**; the runtime resolves those declarations to the active implementation.

The implementation lives in **`@peers-app/peers-sdk`** under `src/contracts/` and is integrated into the package install flow. Packages use `definePackage()` to declare contracts, and the `PackageLoader` and `installContractPackage` functions handle registration at install time.

## Core components

| Piece | Role |
| --- | --- |
| **`definePackage` / `PackageBuilder` / `ContractBuilder`** | Authoring API: declare **zero or more** contracts per package via `pkg.contract(contractId, version, name)`. Assign tables, tools, observables, events, `alsoImplements` declarations, and `consumes` dependencies on each `ContractBuilder`. |
| **Shape extraction** | Builds pure-data contract shapes from `IField[]` (derived from Zod schemas via `schemaToFields`). |
| **Validation** | Checks that a provider's shape is a **superset** of a contract (field names, types, optionality, arrays, tools, observables, and event payloads), validates **immutability** rules, and validates **`alsoImplements`** against stored contract definitions. |
| **`ContractRegistry`** | In-memory registry: register providers, resolve the active definition, swap providers, unregister, finalize contracts, and check consumer dependencies. |
| **Contract proxies** | `createContractConsumer`, `createContractProvider`, and `createContractProviderSession` turn the same contract into transport-independent calls, observable mirrors, and subscriptions. |

## Contract lifecycle and promotion

Contract maturity is **coupled to the package lifecycle**. Developers do not set `devTag` in code — the platform manages it:

- **Dev package versions**: new contracts are registered with `devTag: "dev"` (shape can change freely). Previously-frozen contracts are preserved as stable.
- **Beta package versions**: same as dev — contracts can still evolve during testing.
- **Stable package versions**: remaining dev contracts are **designed to be finalized** (devTag removed, shape frozen) when a package version is promoted to stable. Full automatic finalization on promote is still on the roadmap; see [Package lifecycle design](../Roadmap/package-lifecycle).

The lifecycle is one-way: once a contract version is frozen (stable), it **cannot** be re-registered as dev. The registry rejects such attempts.

### Evolving stable contracts with `alsoImplements`

When you need to extend a frozen contract, **increment the version number** and use `alsoImplements` to declare backward compatibility:

```typescript
const main = pkg.contract(contractId, 2, "My App");
// Add new optional fields, tools, etc.
main.alsoImplements(contractId, 1); // v2 satisfies v1
```

The system validates that v2 is a structural superset of v1 — all v1 tables, tools, observables, and events must exist in v2 with compatible shapes. Consumers of v1 continue to work with any provider of v2.

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

## Consuming a contract through a proxy

`createContractConsumer(definition, transport, { dataContextId? })` returns a live proxy with:

- `tables[name].method(...args)` for asynchronous table calls;
- `tools[name](...args)` for tool calls;
- `observables[name]()` for synchronous mirrored reads and `observables[name](value)` for writes;
- `events[name].subscribe(handler)` and `tables[name].dataChanged.subscribe(handler)` for provider pushes;
- `loadingPromise`, which waits for observable snapshots and queued writes;
- `dispose()`, which releases every subscription and transport listener owned by that consumer.

For in-process wiring, pair the consumer with a stateful provider session:

```typescript
const [consumerTransport, providerTransport] = inProcessTransportPair();
const session = createContractProviderSession(resolution, providerTransport, {
  permissionCheck,
});
const consumer = createContractConsumer(definition, consumerTransport, {
  dataContextId,
});

try {
  await consumer.loadingPromise;
  const rows = await consumer.tables.Items.list({}, { pageSize: 20 });
} finally {
  consumer.dispose();
  session.dispose();
}
```

Always dispose both sides. Consumer disposal is idempotent, unsubscribes generic events, table events, and observable streams, and removes only that consumer's notify handler. New remote calls and subscriptions reject after disposal. Cached observable reads remain available, but writes throw.

### Table-call boundary

Contract table proxies accept the standard serializable data operations:

`get`, `list`, `count`, `findOne`, `save`, `insert`, `update`, and `delete`.

Custom remotely callable methods must use `@ProxyClientTableMethodCalls()`. The provider uses that marker and calls the method's `__original` implementation when a client proxy exists. Internal/private helpers, prototype and event properties, cursors, and document helpers are rejected.

Table property reads and synchronous return values are not transparent across the proxy boundary: supported method calls return promises.

### Observables and events

Contract observables are always mirrored so consumers can read them synchronously. Await `consumer.loadingPromise` before the first read. Writable values update optimistically and send ordered, fire-and-forget `set` calls; awaiting the current `loadingPromise` waits for those writes. A failed set is logged and the next provider push reconciles the mirror.

Writability is enforced twice:

- a consumer write to an observable declared `writable: false` throws before changing the mirror or sending traffic;
- the provider accepts `set` only when `IContractResolution.observableWritability[name]` is explicitly `true`.

Events and table `dataChanged` differ from observables: they are subscription-gated. The provider attaches to the live source only while at least one consumer subscription exists and detaches after the last unsubscribe.

## Permission and transport limits

The current cross-device permission function, `sameUserContractPermissionCheck`, is a conspicuous placeholder: it permits calls only when the verified remote user ID equals the local user ID. Cross-user access is denied. Do not treat it as a complete authorization model; per-contract/member/device policy and user approval still need design work.

The production device `contractCall` handler is live on verified connections but passive until a consumer emits a call. The current production proof supports request/response access to the built-in System Logs table. Device-connection subscriptions and reverse `contractNotify` routing are not wired yet.

`connectionContractTransport` supports multiple consumer notify listeners without one consumer removing another. Its request channel intentionally has one owner: a future connection-wide provider router must multiplex contract/version/data-context calls. The socket.io adapter is tested groundwork but is not yet wired between the Electron UI and server.

## Related topics

- **[Getting started](./getting-started)** — package system overview.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run package versions.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design rationale and shipped vs planned work.
- **[System: Tools](../System/Tools)** — tool authoring, `schemaToFields`, and how tool schemas flow into contracts.
- **[System: Tables](../System/Tables)** — field-level shapes today use `IField` / Zod-derived metadata.
