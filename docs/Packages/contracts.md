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
| **Contract proxies** | `createContractConsumer`, `createContractProvider`, `createContractProviderEndpoint`, and `createContractProviderSession` turn the same contract into transport-independent calls, observable mirrors, and subscriptions. |
| **Provider router** | `createContractProviderRouter` owns one connection's request channel, authorizes before resolution, multiplexes contracts and data contexts, and disposes cached provider endpoints. |

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

### Device connections

Verified device connections use one provider router per connection. A consumer wraps its `Connection` with `connectionContractTransport`; the remote `ConnectionManager` routes all `contractCall` requests through the router. The router:

- invokes a trusted host authorization/data-context hook before any contract resolver;
- derives caller context only from trusted connection/session state and ignores extra wire arguments;
- verifies that connection keys match a valid self-signed `Users` record known in the provider's personal or shared-group data;
- requires the caller to have exact `TrustLevel.Self` in the provider's personal data context;
- normalizes omitted personal context and an explicitly named personal context to the same route;
- lazily caches stateful provider endpoints by contract id, version, and authorized data context;
- sends event, table `dataChanged`, and observable notifications back on `contractNotify` over the same duplex connection;
- tracks subscription ownership so unsubscribe is idempotent and does not need a second authorization decision;
- disposes every endpoint and live provider subscription when the connection closes or the caller's personal trust assignment changes.

No separate notify RPC registration is required. The consumer's existing notify listener receives reverse traffic through the symmetric transport. Multiple consumers may share a connection and keep independent subscription IDs and listeners.

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

The production cross-device policy is an identity-equivalent **Self** grant. Authorization
uses the provider's personal `UserTrustLevels` table, not a trust row supplied by the caller
or a shared group. The provider's own account is implicitly Self. A different account must
have an explicit personal-context row whose value is exactly `TrustLevel.Self`; `Trusted`
and every lower level are denied.

User ID alone is insufficient. The verified connection's signing and box keys must match a
valid self-signed `Users` record in data already known to the provider. Missing identities,
unsigned discovery stubs, malformed signatures, and key mismatches fail closed. A known
user's key mismatch is also rejected during the connection trust handshake even when the
device itself is new.

**Self grants full remote contract access.** After authorization, an omitted data context
selects the provider user's personal context and an explicit `dataContextId` retains its
existing behavior. Therefore Self can reach every contract and data context available to
the provider process; it is not limited to the context containing the trust row. Assign it
only to an identity that should have the same control as the local user. Lowering the trust
level resets every provider route for that connection, disposes live subscriptions, and
causes subsequent calls to re-evaluate and fail.

`sameUserContractPermissionCheck` remains exported only as a deprecated compatibility
helper for isolated providers. Production connection routing does not use it.

`connectionContractTransport` supports multiple consumer notify listeners without one consumer removing another. Its request channel intentionally has one owner: the connection-wide provider router.

Still deferred are production Socket.IO contract wiring between the Electron UI and server, installed-package provider resolver registration, precise generic `createContractConsumer<T>()` typing, granular permissions and data-context membership policy, payload quotas/codecs, and QuickJS provider isolation. The endpoint resolver seam allows later sandbox-backed providers without replacing the router.

## Related topics

- **[Getting started](./getting-started)** — package system overview.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run package versions.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design rationale and shipped vs planned work.
- **[System: Tools](../System/Tools)** — tool authoring, `schemaToFields`, and how tool schemas flow into contracts.
- **[System: Tables](../System/Tables)** — field-level shapes today use `IField` / Zod-derived metadata.
