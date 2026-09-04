---
sidebar_position: 3
title: Package contracts
---

# Package contracts

**Package contracts** define **stable, versioned interfaces** (tables, tools, observables, and events) that packages can depend on instead of hard-coded table or tool IDs. Multiple packages can **provide** the same contract; a group picks an **active provider**. Consumers declare what they **consume**; the runtime resolves those declarations to the active implementation.

The implementation lives in **`@peers-app/peers-sdk`** under `src/contracts/` and is integrated into the package install flow. Newly scaffolded packages declare contracts in an isolated pure-data manifest; legacy packages can still use `definePackage()`. The `PackageLoader` handles registration at install time — including registering each package’s provided contracts into that data context’s in-memory `ContractRegistry` and settling dependencies afterward. Built-in **system contracts** (Logs, Device Operations, …) self-register via `registerSystemContract` and are installed into every loader registry at construction; adding another system contract is one self-registration call, with no loader changes.

## Core components

| Piece | Role |
| --- | --- |
| **`definePackage` / `PackageBuilder` / `ContractBuilder`** | Authoring API: declare **zero or more** contracts per package via `pkg.contract(contractId, version, name)`. Assign tables, tools, observables, events, and `alsoImplements` on each `ContractBuilder`. Declare dependencies with `pkg.consumes(...)` on `PackageBuilder`. |
| **Shape extraction** | Builds pure-data contract shapes from `IField[]` (derived from Zod schemas via `schemaToFields`). |
| **Validation** | Checks that a provider's shape is a **superset** of a contract (field names, types, optionality, arrays, tools, observables, and event payloads), validates **immutability** rules, and validates **`alsoImplements`** against stored contract definitions. |
| **`ContractRegistry`** | In-memory registry: register providers, resolve the active definition, select a provider for a `consumes` declaration (`providerPackageIds` / `fallbackToDefaultProvider`), swap providers, unregister, finalize contracts, and check consumer dependencies. Each data context’s `PackageLoader` owns one, seeds it with built-in **system contracts** at construction, and registers package providers when contract packages are installed. SQLite persistence of the registry is still a follow-up. |
| **Contract proxies** | `createContractConsumer`, `createContractProvider`, `createContractProviderEndpoint`, and `createContractProviderSession` turn the same contract into transport-independent calls, observable mirrors, and subscriptions. |
| **Provider router** | `createContractProviderRouter` owns one connection's request channel, authorizes before resolution, multiplexes contracts and data contexts, and disposes cached provider endpoints. |

## Declaring a consumed contract

Call `pkg.consumes(contractId, version, opts?)` on **`PackageBuilder`** (not on `ContractBuilder`). It returns a deferred handle immediately:

```typescript
const tasks = pkg.consumes(TASKS_CONTRACT_ID, 1, {
  providerPackageIds: [preferredTasksPackageId],
  fallbackToDefaultProvider: true,
});

// Later, outside definePackage — do not await inside the define callback:
const consumer = await tasks.consumer;
await consumer.tables.Tasks.list({}, { pageSize: 20 });
```

Pass a type argument to narrow the resolved proxy beyond the default `IContractConsumer`.
Typed consumers only need to extend `IContractConsumerBase` and may omit empty
`tools` / `events` / `observables` bags. Table members should use `ITableProxy<TTable>`
(the remotely callable Table method surface + `dataChanged`) — not a literal `Table`
instance. Built-in contracts may export a ready-made consumer type (hand-maintained for now):

```typescript
import { type ILogsConsumer, logsContractId } from "@peers-app/peers-sdk";

const logs = pkg.consumes<ILogsConsumer>(logsContractId, 1, { optional: true });
logs.consumer.then(async (consumer) => {
  if (!consumer) return;
  // Autocomplete: contractId, version, tables, loadingPromise, dispose — no empty bags
  await consumer.tables.ConsoleLogs.list({ level: "error" });
  await consumer.tables.ConsoleLogs.deleteOldLogs();
});
```

- Required dependencies resolve to `T` (defaults to `IContractConsumer`).
- `{ optional: true }` may resolve to `undefined` when no matching provider is available.
- Options (`optional`, `providerPackageIds`, `fallbackToDefaultProvider`) are honored when the package-loader settles the handle after install.

After `installContractPackage` registers the package’s provided contracts, `PackageLoader` settles each `consumes` handle: it selects a provider from the registry, looks up a live `ContractResolver`, builds an in-process consumer proxy, and resolves (or rejects) `handle.consumer`. System contracts such as Logs already ship with resolvers; a package-provided contract without a live resolver is treated as missing (optional → `undefined`, required → reject).

```typescript
// Outside definePackage — the promise settles after the package finishes installing:
const consumer = await logs.consumer;
if (consumer) {
  await consumer.tables.ConsoleLogs.list({ level: "error" });
}
```

:::warning Resolvers run during package install
Settling a `consumes` handle **awaits the provider's `ContractResolver`**, and package
install happens inside `initializePeerDevice`. A resolver must therefore only await
things that are already available at that point — `networkManagerPromise` and
`connectionManagerPromise` both resolve before packages load. Awaiting a promise that
is only resolved *after* package loading (such as `peersDeviceInitializedPromise`)
deadlocks device initialization, and the app never leaves its loading screen.
:::

## Contract lifecycle and promotion

Contract maturity is **coupled to the package lifecycle**. Developers do not set `devTag` in code — the platform manages it:

- **Dev package versions**: new contracts are registered with `devTag: "dev"` (shape can change freely). Previously-frozen contracts are preserved as stable.
- **Beta package versions**: same as dev — contracts can still evolve during testing.
- **Stable package versions**: remaining dev contracts are **designed to be finalized** (devTag removed, shape frozen) when a package version is promoted to stable. Full automatic finalization on promote is still on the roadmap; see [Package lifecycle design](../Roadmap/package-lifecycle).

The lifecycle is one-way: once a contract version is frozen (stable), it **cannot** be re-registered as dev. The registry rejects such attempts.

Isolated artifacts follow the same mutable-development rule without trusting
artifact data for maturity. The host reads the active `PackageVersion.versionTag`
when it installs an artifact: `dev` and `beta` definitions receive
`devTag: "dev"`, while stable or untagged definitions are frozen. Reloading a
changed dev/beta artifact restarts its worker and updates its contract shape;
an already-frozen definition cannot be reopened as mutable.

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

### Local UI-to-host contracts

Electron renderers and the PWA can use the same typed contract consumers:

- Electron adapts its authenticated frontend Socket.IO connection with
  `socketIoContractTransport`. The server creates one local-user provider router per socket
  and disposes it on disconnect.
- PWA installs an `inProcessTransportPair` and the same local-user provider router.
- `registerHostContractTransport`, `waitForHostContractTransport`, and
  `subscribeHostContractTransport` expose transport readiness and reconnect lifecycle to UI
  modules. Consumers must be disposed and recreated when the transport changes.

The local router registers its request listener before the user context is ready, then
resolves that context lazily per call. It accepts only the user's personal context and
known local group contexts. The authenticated local UI session is trusted as one authority
today; this is not installed-package renderer isolation.

Today the renderer talks to the host router directly: it waits for
`registerHostContractTransport`, builds `createContractConsumer` proxies over that
transport, and the host router resolves tools from the global `ContractResolver`
registry. There is no package involvement in that path — `pkg.consumes()` settles only
while `package.bundle.js` runs in the host, and its handle does not cross into separately
built renderer bundles.

The intended security model is narrower: UI elements should eventually call only their
own package's contract code through a proxy, and that package code should forward to
other contracts via its `consumes` handle. Direct renderer access to arbitrary system
tools is a temporary seam, not the long-term boundary.

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

Still deferred are installed-package provider resolver registration, precise generic
`createContractConsumer<T>()` typing, granular per-package UI permissions, and payload
quotas/codecs.

## Isolated contract packages (Electron)

The default new-package scaffold uses an **isolated package** artifact so contract providers run
outside the Electron host process. The host never evaluates provider source. Legacy
`definePackage()` artifacts remain supported for existing packages.

- **Format.** The existing `package.bundle.js` slot starts with
  `PEERS_ISOLATED_PACKAGE_V1` followed by a JSON envelope: package/version identity,
  provided contracts, optional package-owned `manifest.tables`, declared
  consumes, optional `appNavs`, and `providerSource`. Provided contracts can
  expose selected tables with name-only references and expose package pvars as
  typed observables. A recognized but malformed envelope
  **fails closed** and never falls back to `new Function`. Older table-less
  and tool-only artifacts remain valid. Earlier schema-bearing
  `provides[].tables` entries are rejected rather than migrated.
- **Host.** Electron registers an `IIsolatedPackageRuntime` factory before
  `initializePeerDevice`. `PackageLoader` installs the manifest into the per-data-context
  `ContractRegistry` and stores source for a supervised Node `worker_threads` + SES
  worker. The worker starts lazily on the first tool call. Each data context
  constructs its table container before the package loader so isolated
  package-owned tables receive a host gateway. Local-dev isolated packages
  prefer `dist/package.bundle.js` from the stored checkout path over a stale
  Files bundle so a rebuild can introduce a new contract version. Beta and
  stable versions always load their selected stored artifact; a local checkout
  cannot override them. The artifact package ID and semantic version must match
  the selected `PackageVersion` (with dev-only version correction for a rebuilt
  local artifact).
- **Tables.** Isolated packages declare every package-owned schema once at
  `manifest.tables`.
  Authors provide a package-local name, primary key, fields, and optional schema
  version—never `tableId`, visibility, contract identity, or a physical name. The
  logical name must be unique among that package's tables. The
  host derives an internal 25-character table ID for `TableDefinitions` and stores
  the table as `${logicalTableName}_${packageId}`. Guest code receives copied
  records through `getOwnedTableRecord(tableName, recordId)` and
  `saveOwnedTableRecord(tableName, record)` only during an authorized tool
  invocation. The host binds package identity, route context, and authority;
  guessed physical or system table names are not declarations. A provided
  contract can expose a schema with `{ name }` in `provides[].tables`; the host
  then serves standard table CRUD against the trusted provider package and
  logical table name. Unreferenced tables remain private. Custom methods and
  table `dataChanged` subscriptions are not exposed. These guarantees apply to
  isolated packages; legacy
  host-evaluated packages can still import tables directly.
  The host validates the package's complete declaration batch before publishing
  any new table binding.
  All peers that sync a group must be upgraded before that group uses isolated
  package tables: older hosts derive the physical name from `tableId`, while
  current hosts intentionally use `${logicalTableName}_${packageId}`.
- **Persistent variables.** Isolated provider code can call
  `getOwnedPersistentVar(scope, name)` and
  `setOwnedPersistentVar(scope, name, value)` during an authorized tool
  invocation. The host derives `${packageId}_${name}` from the worker's trusted
  identity before scope handling and deterministic ID generation. It uses the
  existing pvar rows and canonical factories—there is no new persisted package
  column. `device`, `user`, `group`, `groupDevice`, and
  `groupUser` are supported; group-dependent scopes append the trusted route
  context. Guest-supplied package, context, or authority fields cannot redirect
  access. Shared/global pvars, secrets, and owned-pvar subscriptions are
  deliberately deferred.
- **Contract observables.** A provided contract may bind an observable to a
  package-owned pvar by declaring its scope, logical pvar name,
  JSON-compatible default, value type, and `writable` flag. Normal renderer/host
  contract consumers can get, set when writable, and subscribe. Canonical pvar
  changes—including changes applied by device sync—notify subscribers, as do
  writes through either the contract or the provider's owned-pvar helper. The
  pvar binding is host-only and never lets a consumer supply package or physical
  storage identity. Isolated guest subscriptions remain deferred.
- **Routing.** For package-registered contracts,
  `createLocalUserContextContractProviderRouter` resolves an isolated or
  resolver-backed endpoint only for the provider selected by that context's
  `ContractRegistry`. Legacy unscoped resolvers remain available only when no
  registry provider exists. Package-to-package tool, table, and observable
  consumes go back through the trusted host. The caller must declare the exact
  consume and its provider allowlist must accept the resolved package; guest
  payloads cannot choose provider identity or authority. `alsoImplements` aliases
  route older consumer versions to the validated compatible implementation
  version.
- **Boundary values.** Plain values, `Date`, and `Uint8Array` cross the worker
  boundary with collision-safe tags and retain their Peers table/pvar types.
  Functions, unsupported objects, non-finite numbers, cycles, oversized values,
  and excessive nesting are rejected.
- **Access.** Tool suggestions stay **Self** until an administrator approves them.
  Direct user calls use the trusted local `DataContext` access level. Persistent
  approval storage/UI is a later tools-system milestone; the first smoke path runs
  in the personal context.
- **Compatibility.** Legacy `definePackage()` bundles and renderer route/UI bundles
  are unchanged. Isolated packages do not yet expose events, custom table
  methods, table `dataChanged`, isolated-guest subscriptions, owned-pvar
  subscriptions, or global pvar grants. Electron is currently the only isolated
  execution host. PWA safely skips valid isolated provider artifacts instead of
  failing device startup; those providers and their contract tools remain
  unavailable there. PWA browser Workers are a follow-up that can reuse the same
  SDK factory seam. Malformed artifacts and package-ID mismatches still fail
  closed on every host. When a package changes between legacy and isolated
  execution on a supporting host, the replacement becomes active only after it
  is ready; a failed replacement leaves the prior provider active. A device
  without isolation support may temporarily run
  the newest older eligible legacy version and records that choice only in its
  existing device-local package preference; when isolation support becomes
  available, it retries and restores the originally selected version.

The canonical template keeps identity in `src/ids.json`, writes the envelope from
`build-package.mjs`, and keeps plain worker code in `src/provider-source.js`. Its starter
contract exposes a group-scoped writable state observable so renderer-only packages have a
reactive persistence path before they need tools or record tables.

This is not a production security claim. An SES escape still reaches Worker ambient
APIs; `Worker.terminate()` remains the availability path. See
[`peers-isolate/README.md`](https://github.com/peers-app/peers-isolate) for the
runtime surface.

### Observing lazy worker startup

The standalone `official-packages/isolation-smoke` package provides contract v4
with one `observeWorker` tool, a package-private `IsolationSmokeState` table and
`invocationCount` device pvar, plus a public `IsolationSmokeSharedState` table
and writable `sharedInvocationCount` pvar-backed observable. Contract v3/v2
remain tool-only fallbacks. The private table's physical name is
`IsolationSmokeState_00mt4wmj0h50697f5l3zz6mka`; the pvar's physical name is
`00mt4wmj0h50697f5l3zz6mka_invocationCount`. The screen tries the personal
data context first (then the selected group) and falls back through v3/v2/v1 if v4
is not installed yet. It is useful for checking the production lifecycle
without relying on Jest fixtures:

1. Build and import the package. The Electron host logs
   `Registered …; worker dormant until first tool call`.
2. Open the package screen. This loads its renderer bundle but does not start its
   provider worker.
3. Click **Call isolated tool**. The host logs `Starting worker …` and
   `Worker ready …`.
4. Click again. The table-persisted, pvar-persisted, and worker-local counts
   increment, showing that the existing worker handled the second call.
5. After a worker restart or package reload, the worker-local count resets to
   one while both persisted counts continue.
6. Click **Increment public state** to update the public table and observable
   directly through a renderer contract consumer without starting the worker.
7. Import `official-packages/isolation-consumer`; its worker consumes v4 and
   increments the same public values. Private names, guessed physical/system
   names, and undeclared members fail closed.

Isolated contract tools are not yet mirrored into the legacy `Tools` table, so this
smoke package uses a contract consumer on its screen rather than
`peers tools run`.

## Related topics

- **[Getting started](./getting-started)** — package system overview.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run package versions.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design rationale and shipped vs planned work.
- **[System: Tools](../System/Tools)** — tool authoring, `schemaToFields`, and how tool schemas flow into contracts.
- **[System: Tables](../System/Tables)** — field-level shapes today use `IField` / Zod-derived metadata.
