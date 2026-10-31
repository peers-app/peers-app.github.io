---
sidebar_position: 3
title: Package contracts
---

# Package contracts

**Package contracts** define **stable, versioned interfaces** (tables, tools, observables, and events) that packages can depend on instead of hard-coded table or tool IDs. Multiple packages can **provide** the same contract; a group picks an **active provider**. Consumers declare what they **consume**; the runtime resolves those declarations to the active implementation.

Declare packages with `definePackage` from `@peers-app/peers-sdk/define` and build them
with `peers-package build`. Peers reads the generated declarations at install time, so
contracts are discoverable before the package's worker starts. See
[Declaring a package](./declaring-a-package) for the complete authoring guide.

Built-in system contracts are available alongside package contracts. [System Local
Folders](../System/Local-Folders.md) is local-only; [System Packages](../System/Packages.md)
provides package administration, including from another device when this device trusts it
as Self.

## Core components

| Piece | Role |
| --- | --- |
| **`definePackage`** | Lists the contracts the package provides and consumes, plus navigation, network access, and lifecycle hooks. |
| **`defineContract`** | Groups tables, tools, observables, and events into a versioned interface. Provide it with `pkg.provides(...)`. |
| **`declareContract` / `implementContract`** | Declare an interface other packages implement, then supply its handlers and observable sources. |
| **`contractRef`** | Gives provider code a typed client for a contract, bound to a handler's `ctx`. |
| **`hostContract`** | Gives a screen or widget a typed client, with subscriptions and reconnect handling. |
| **`peers-package`** | Builds the manifest and worker code, validates declarations, and checks frozen contract versions. |

## Declaring a consumed contract

Create a reference to the contract and list it with `pkg.consumes(...)`. Use the reference
from a handler with that call's `ctx`:

```ts
import { contractRef, definePackage } from "@peers-app/peers-sdk/define";
import type { Tasks } from "./contracts/tasks";

const TasksRef = contractRef<typeof Tasks>(tasksContractId, 1);

export default definePackage((pkg) => {
  // Package identity and provided contracts …
  pkg.consumes(TasksRef, {
    providerPackageIds: [preferredTasksPackageId],
    fallbackToDefaultProvider: true,
  });
});

// Inside a tool handler:
const rows = await TasksRef(ctx).tables.Tasks.list({}, { pageSize: 20 });
```

A declaration from `declareContract` is already a reference. If you don't have one, use
[`peers-package contract add`](./declaring-a-package#getting-a-declaration-you-dont-have)
to generate it from the provider.

- `{ optional: true }` marks a dependency your package can work without.
- Peers reports missing dependencies but currently doesn't block installation, even for a
  required one. Calls fail until a matching provider is available.
- `providerPackageIds` selects the first listed package registered for that contract version.
  `fallbackToDefaultProvider: true` permits the active provider when none of those packages
  provides it. Without a provider list, calls use the active provider.
- Calls to a contract the package itself provides use that package.
- Supported calls can select a `providerPackageId`, which must be in `providerPackageIds`
  when that list is nonempty, even if fallback is enabled.
  See [Calling every provider](./declaring-a-package#calling-every-provider-of-a-contract).

### Declaring a remote contract

Declare a contract with `pkg.consumes(...)` when calling another package's tools on another
device. Use `{ optional: true }` if it need not have a provider on this device. Your own
provided contracts are available too. From a handler, call
`ctx.callRemoteTool(contractId, version, deviceId, toolName, args)`; the target device
selects its provider and authorizes the call. See
[Remote tool calls across devices](#remote-tool-calls-across-devices).

## Contract lifecycle and promotion

Contract maturity is **coupled to the package lifecycle**. Developers do not set `devTag` in code — the platform manages it:

- **Dev package versions**: new contracts are mutable. A version already frozen in the registry cannot be reopened as dev; use a new contract version for a changed shape.
- **Beta package versions**: same as dev — contracts can still evolve during testing.
- **Stable package versions**: packages freeze every contract version they provide when loaded. Run the [build-time guard](./package-lifecycle#freeze-your-contracts-before-a-stable-release) before releasing them too.

The lifecycle is one-way: once a contract version is frozen (stable), it **cannot** be re-registered as dev. The registry rejects such attempts.

A frozen version's shape can't change, but its descriptions can: reword a tool's `usageDescription` or any `description` to clarify usage or point callers at a newer version. A tool's `remoteAccessLevel` is policy, not shape, so it can change too. Run `npx peers-package contract freeze` before a stable release, so your build refuses a change to a frozen version ([Package lifecycle](./package-lifecycle#freeze-your-contracts-before-a-stable-release)). Reordering members or fields doesn't need a new contract version either, though a table still raises its own `versionNumber` whenever its field list changes, order included. Adding the [richer schema keys](./declaring-a-package#schemas-in-the-manifest) when rebuilding a provider preserves compatibility with the same frozen version. A rebuild that also changes a field's type or whether it is optional needs a new version: for example, a field declared `.optional().nullable()`, which SDKs before this release marked required.

Reloading a changed dev/beta build restarts its worker and updates its contract shape.
An already-frozen definition cannot be reopened as mutable.

### Evolving stable contracts with `alsoImplements`

When a frozen contract needs a backwards-compatible change, such as a new optional input,
**increment the version number** and list the older versions it still serves in
`alsoImplements`. One set of handlers then answers every one of them:

```ts
export const Notes = defineContract({
  contractId,
  version: 3,
  name: "Notes",
  tools: [add, list],
  alsoImplements: [1, 2], // v1's and v2's consumers are served by v3's handlers
});
```

- An older version is named by its number. The build reads its shape from the package's
  `frozen-contracts.json`, so it has to have been frozen by a stable release
  ([Package lifecycle](./package-lifecycle#freeze-your-contracts-before-a-stable-release)). A
  version that was never released stable can simply change.
- The new version has to satisfy each one, which the build checks. Every older tool, table,
  observable, and event exists with a compatible shape: an input may become optional or gain
  optional fields, and an output or event may gain fields. Required outputs and event payload
  fields stay required; table fields keep their optionality. Nested fields and enum values
  aren't checked for compatibility yet, so keep those compatible yourself.
- The list doesn't chain: v3 names every older version it still serves. Drop a number to stop
  serving it.
- An older version's callers run the new version's tools under the new version's policy: its
  `accessLevel` and `remoteAccessLevel` decide who may call each tool, whichever version the
  caller names. The older release's settings no longer apply.
- The manifest carries each older version's shape, so a device can serve its consumers after a
  restart, even when nothing else provides that version.
- `implementContract(declaration, { ..., alsoImplements: [1] })` works the same way, and another
  contract can be named by its declaration (from `declareContract` or `peers-package contract
  add`) instead of a number.
- Hosts released before `alsoImplements` came to `/define` don't install a package that uses it.

When an older version needs different behavior, or the change isn't backwards compatible, provide
the older version as its own contract with `pkg.provides`, with handlers that call shared code.

### Exposing contracts through a hub's contract

When a package implements a hub's contract, its `implementContract` declaration can list
other contracts it provides in `exposes`. Consumers of the hub's contract can then call
those contracts' tools on that provider. Each tool still checks the caller's access.
See [Exposing your contracts through a hub's
contract](./declaring-a-package#exposing-your-contracts-through-a-hubs-contract).

## Tools in contracts

Define each tool with `defineTool` from `@peers-app/peers-sdk/define`: its name, description,
access level, input and output schemas, and handler. List it in `defineContract`'s `tools`
and provide that contract with `pkg.provides(...)`. The build derives the manifest's fields
from your schemas; the handler and its public shape stay together.

The Runtime checks input fields before a call reaches your code, and the package parses the
input with its Zod schema before invoking the handler. A rejected call reports the invalid
fields to the caller. Keep the schemas compatible with every contract version the package
serves. See [Tools](./declaring-a-package#tools) for authoring and
[Tools and access](../System/Tools) for permissions.

### Context-bound tool providers

A tool handler receives `(args, ctx)`. Use that `ctx` with the package's table and contract
handles, so each operation stays bound to the current call and data context. Keep it with
that call; don't save one caller's context for use by another. The same package installed
in two groups has separate workers and group data.

For a contract declared elsewhere, supply handlers with
[`implementContract`](./declaring-a-package#declaring-a-contract-other-packages-implement).
The build checks that every declared member is implemented.

### Runtime-owned tool identity

Peers adds public contract tools to its permanent `Tools` catalog from their declarations,
without starting package workers. Authors name contract members; they don't allocate tool
catalog IDs. Each `(contractId, version, toolName)` has a deterministic ID or reviewed
historical aliases. Provider selection does not change those IDs. Generate new contract
IDs once with `newid()` and keep them in source.

`alsoImplements` keeps older versions' catalog identities, without exposing newer-only
members through the older version. Catalog rows survive uninstall and member removal;
a row can remain discoverable while its tool is unavailable. The selected provider's
current policy decides whether a caller may run it. See
[Tools identity protocol](../System/Tools#permanent-runtime-catalog).

### Migrating from toolInstances

Replace executable builder assignments with a context-bound resolver. The old API
is a warning-only compatibility setter; TypeScript assignments are rejected.

Before (old SDK):

```ts
const items = pkg.contract(contractId, 1, "Items");
items.tools = [{ tool: addItemTool }];
items.toolInstances = [{ tool: addItemTool, toolFn: addItem }];
```

After:

```ts
const items = pkg.contract(contractId, 1, "Items");
items.tools = [{ tool: addItemTool }]; // Includes runner/config metadata if present.
registerContractResolver(contractId, 1, ({ dataContext }) => ({
  contractId,
  version: 1,
  tools: {
    "add-item": {
      tool: addItemTool,
      toolFn: (args) => addItem(dataContext, args),
    },
  },
}), { providerPackageId: packageId });
```

Use the exact public member name and the supplied data context. Keep shipped IDs
in the reviewed alias inventory; arbitrary shape `toolId` values cannot allocate
catalog identities. `IToolInstance` remains deprecated for source compatibility;
it is never registered or dispatched.

Legacy-format bundles carrying a non-empty `toolInstances` array fail to load.
Rebuild them with `definePackage()` and resolvers. Older `definePackage()` bundles
still load tables and UI, discard executable assignments with a warning, and expose
unimplemented members as unavailable. See [Legacy execution removed](../System/Tools.md#legacy-execution-removed).

## Consuming a contract through a proxy

In provider code, use a [contract reference](./declaring-a-package#calling-contracts)
with the current `ctx`. In a screen or widget, use
[`hostContract`](./declaring-a-package#using-the-contract-from-a-ui). Both call the selected
provider's implementation; consumers don't import its handlers or storage.

### Remote tool calls across devices

From a tool handler, call a tool on a contract your package consumes or provides:

```ts
await ctx.callRemoteTool(
  sessionContractId, 1, otherDeviceId, "join", { sessionId },
);
```

The target device selects its active provider. It can be reached through the Peers mesh
without a direct connection. Only tools cross devices through this API; tables, observables,
and event subscriptions remain local. Remote calls have a 30-second round-trip deadline,
even if the target tool declares a longer `timeoutMs`. A timeout or dropped connection
doesn't prove the tool made no changes; calls that may already have run aren't automatically
retried.

**Opting a tool in.** Set `remoteAccessLevel` in `defineTool` to allow callers from other
accounts in a shared group. Both it and the tool's ordinary `accessLevel` must admit the
caller. For example, `accessLevel: AccessLevel.Reader` and
`remoteAccessLevel: AccessLevel.Writer` let group Writers call from another device.
Omit `remoteAccessLevel` to deny other accounts unless they are Self-trusted.

**Who may call.** The receiving device verifies the caller's identity and authorizes every call:

1. The caller's signing and box keys must match a valid, known, self-signed user record.
2. The provider's own account, or an account granted exact `TrustLevel.Self` in its personal
   context, keeps full access. `remoteAccessLevel` does not restrict Self.
3. Other verified callers must name a shared group. Their role must be above None and meet
   both access levels on the selected provider's tool. The package must be loaded in that group.

Packages cannot call system contracts on another device. The user's own UI and CLI calls
can reach remote system contracts where those contracts permit it. Forwarded package calls
currently arrive as the sending user; package identity and consume limits do not cross
devices. See [Trust](../System/Trust.md) for that limitation.

### Local UI-to-host contracts

Use `hostContract<typeof Contract>(contractId, version)` from `@peers-app/peers-sdk` in a
screen or widget. Import the contract with `import type` so its handlers stay out of the UI
bundle. The client follows the active group, waits for a connection, and reattaches
subscriptions after reconnecting. `useRows` and `useTool` from `@peers-app/peers-ui` keep
React views current. Tests can use `mockHostContract` from `@peers-app/peers-sdk/testing`.

UI calls act as the signed-in user. Provider-side `pkg.consumes(...)` declarations do not
yet restrict UI calls; keep the UI's dependencies declared anyway. See
[Using the contract from a UI](./declaring-a-package#using-the-contract-from-a-ui).

### Device connections

Peers verifies device identities and applies the receiving device's trust and group roles
before running a contract call. Lowering trust ends affected subscriptions and causes
later calls to be checked again. An unavailable device produces an error; a connection
failure does not prove that a tool made no changes, so check its result before retrying
an operation with side effects.

### Table-call boundary

Package contracts expose `get`, `list`, `count`, `findOne`, `save`, and `delete`, plus
`dataChanged` subscriptions. Each call runs through the providing package's table class.
Custom methods and private tables aren't exposed. Use a contract tool for operations that
don't fit the standard table methods. See
[Overriding table methods](./declaring-a-package#overriding-table-methods).

### Observables and events

Define observables with `defineObservable`, backed by a package variable or an in-memory
source. Consumer reads, writes, and subscriptions go through the provider's worker;
only observables declared `writable` accept consumer writes. In a UI, use `useObservable`
and wait for the observable's `loadingPromise` when the initial value matters. Provider
code reads or writes through `Contract(ctx).observables.name.get()` or `.set(value)`.

Define events with `defineEvent` and emit them with the event's `emit(payload)`. Events
have no replay: subscribers receive only events emitted while subscribed. Store durable
state in a table or variable. Table `dataChanged` reports writes made through the contract,
by the package itself, or by device sync. Events and table notifications remain local to
the device; remote tool calls do not carry subscriptions.

## Permission and transport limits

Cross-device access has two tiers. The broad tier is an identity-equivalent **Self**
grant: authorization uses the provider's personal `UserTrustLevels` table, not a trust row
supplied by the caller or a shared group. The provider's own account is implicitly Self. A
different account must have an explicit personal-context row whose value is exactly
`TrustLevel.Self`; `Trusted` and every lower level get no Self access. The narrow tier is
per-tool: a verified member of a shared group may run a tool that the provider's contract
marks with `remoteAccessLevel` at or below the member's role, and nothing else. See
[Remote tool calls](#remote-tool-calls-across-devices).

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

Granular per-package UI permissions and remote subscriptions remain deferred. Desktop and
headless limit values crossing a package's worker boundary to 16 MB. PWA provider execution
is not supported yet.

## Isolated contract packages (Electron and headless) {#isolated-contract-packages-electron}

Packages declared with `definePackage` and built with `peers-package build` run in supervised
workers on Electron and headless. Peers reads the generated manifest without executing the
package, then starts its code when a contract is first used. The build selects guest API 3;
authors don't set a guest API version.

:::note Older package formats
Older raw bundles, isolated packages without a guest API version, and guest API 2 packages
are deprecated. An upcoming release stops loading them with “Rebuild it with peers-package”.
Move them to `definePackage` from `@peers-app/peers-sdk/define` and rebuild with `peers-package`.
:::

- **Isolation.** The default `pkg.executionMode` is `"sandbox"`: no ambient filesystem,
  subprocess, or network access. Use declared contracts such as [System HTTP](../System/HTTP)
  for those capabilities. `"privileged"` runs trusted package code in its own Node process
  with the user's OS access. It keeps contract permission checks, but direct OS access
  bypasses sandbox confinement. See [Provider execution modes](./getting-started#provider-execution-modes).
  Routes and UI gain no Node access. PWA devices can receive package data but cannot run
  package providers yet.
- **Lazy startup.** Installation registers contracts, tables, and tool catalog entries
  without starting a worker. The first tool call, table read or write, observable access,
  or subscription starts it. Each package has a separate worker per data context.
  Loading a screen alone doesn't start its provider; a contract call from that screen does.
  A package with only screens and no runtime work runs no worker.
- **Every member goes through the package.** Consumer table calls run the table's class,
  observables use their declared sources, and subscriptions and notifications pass through
  the provider. If its worker cannot start, those calls fail. The package's own storage
  operations and device sync don't invoke consumer table overrides. See
  [Every call goes through the package](./declaring-a-package#every-call-goes-through-the-package).
- **Concurrent calls.** Calls and event callbacks can overlap. Serialize changes that read
  shared state and then write it back, using a queue per record or per package. Time in the
  queue counts against the tool's deadline. Don't hold a queue while calling a contract
  that may call back into the same queue.
- **Deadlines and restarts.** Startup has a 30-second deadline; tool calls default to
  30 seconds and can declare `timeoutMs` up to 120 seconds. A timed-out call fails while its
  handler, timers, and module state can keep running. Later calls to other contracts from
  that expired call are denied, but writes to the package's own state can continue. A stuck
  or crashed worker is stopped, and a later call starts a fresh one. For longer work, return
  a job ID, record progress in a table, and provide a cancel tool.
- **Owned state.** Use `defineTable` for tables and the `/define` variable helpers for
  persistent values. Tables stay private unless listed on a provided contract. Package
  variables are private; expose an observable to share a value. `localOnly: true` on a
  table keeps its rows on each device ([Local-only tables](../System/Tables#local-only-tables)).
  In-memory observable values reset when the worker restarts; stored values survive.
- **Background work.** Use `pkg.onStart` for startup and `pkg.onStop` for cleanup. Startup
  hooks finish before calls run, so handle optional failures and don't await long-running
  work. Timers can use owned tables, variables, and events while the worker runs. Calls to
  other contracts need an active invocation; use [System Scheduler](../System/Scheduler)
  when a periodic job needs them. A stored-value change alone doesn't start a dormant
  worker to run a variable watcher. See [Background work](./declaring-a-package#background-work).
- **Subscriptions.** A running package subscribes with `ctx.subscribeConsumedEvent` or
  `ctx.subscribeConsumedTableEvent` for table `dataChanged`, including during `pkg.onStart`.
  Each callback gets
  that delivery's own `ctx`; return its asynchronous work so consumed calls finish within
  the delivery. Subscriptions don't replay earlier changes. Set them up again on startup
  after a consumer worker stops. Provider-side subscriptions to other contracts'
  observables aren't supported yet; UI clients can subscribe to them.
- **Permissions.** Declare every consumed contract and any provider restrictions with
  `pkg.consumes`. Set tool admission with `accessLevel`; declaring a dependency does not
  grant authority above the caller's limits. Owned-state access stays within the package
  and its data context. Secret variables aren't readable by package code; System HTTP can
  inject a declared credential without returning its value. Use `pkg.network` to declare
  allowed HTTPS hosts. See [Tools and access](../System/Tools).
- **Boundary values.** Plain data, `Date`, and `Uint8Array` can cross the worker boundary.
  Functions, unsupported objects, cycles, non-finite numbers, oversized values, and
  excessive nesting are rejected. Observable values must be JSON-compatible.
- **Replacement.** A successful update stops the old worker; a failed replacement keeps
  the previous version running. Package removal and shutdown also stop it. Cleanup hooks
  don't run after a crash or forced kill, so recover persistent jobs on startup if needed.

For declarations and build options, see [Declaring a package](./declaring-a-package).

### Observing lazy worker startup

The `official-packages/isolation-smoke` and `isolation-consumer` packages are e2e
and runtime-test fixtures. Both declare their members in `src/package.ts` with
`@peers-app/peers-sdk/define`; `npm run build` runs `peers-package build` and builds
their renderer bundles.

Isolation Smoke provides contract versions 2–5 under the same contract id.
v4 provides `observeWorker`, backed by a package-private `IsolationSmokeState` table and
`invocationCount` device pvar, plus a public `IsolationSmokeSharedState` table
and writable `sharedInvocationCount` device-variable observable. The private
table and `invocationCount` are reachable only through the tool. v3/v2 remain
tool-only contracts; v5 adds `probeGrant`, `watchGrant`, and `lastFolderEvent`,
consuming System Local Folders v1 through `contractRef`. v4/v5's `observeWorker`
allows remote group Writers (access level 40); the other tools remain local-only.
Both fixture screens use `hostContract` in the selected context; Smoke's screen calls v5.
To check them manually in a test context:

1. Build and import the package, then select its context. Registration leaves
   its worker dormant until a contract call needs it.
2. Open the package screen. This loads its renderer bundle but does not start its
   provider worker.
3. Click **Call isolated tool**. The host logs `Starting worker …` and
   `Worker ready …`.
4. Click again. The table-persisted, pvar-persisted, and worker-local counts
   increment, showing that the existing worker handled the second call.
5. After a worker restart or package reload, the worker-local count resets to
   one while both persisted counts continue.
6. Click **Increment public state** to update the public table and observable
   through the provider worker. This action also starts the worker if needed:
   table and observable calls run through the package.
7. Import `official-packages/isolation-consumer`; its worker consumes v4 and
   increments the same public values. Private names, guessed physical/system
   names, and undeclared members fail closed.

Isolated public tools are indexed in `Tools` while their workers remain dormant.
The screen uses a contract consumer; local `peers tools run <toolId>` also invokes
these tools through the [System Tool Catalog](../System/Tools.md#system-tool-catalog).
The catalog validates the requested version and selects the current provider
without granting additional caller authority.

## Related topics

- **[Getting started](./getting-started)** — package system overview.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run package versions.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design rationale and shipped vs planned work.
- **[System: Tools](../System/Tools)** — tool catalog, access levels, and authority propagation.
- **[System: Tables](../System/Tables)** — storage, local-only tables, and sync.
