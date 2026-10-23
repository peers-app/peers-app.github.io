---
sidebar_position: 1.5
title: Declaring a package
---

# Declaring a package

A package is its **tools**, **events**, **observables**, and **tables**, plus the **contracts**
it consumes and the contracts it provides. Those are the seams the Runtime checks; everything
else is internal to the package. Building a package starts with that list, and so does reading
one.

- **Tools** are calls in.
- **Events** are signals out.
- **Observables** are calls in and signals out for a single value.
- **Tables** are calls in and signals out over a collection of values of one type.
- **Contracts** let packages be built independently without breaking each other.

In code, `src/package.ts` lists those seams with `definePackage` from
`@peers-app/peers-sdk/define`, and the `peers-package` command turns the declaration into the
package's manifest. The manifest is plain JSON in Peers IR, so the Runtime learns what a package
declares without running any of its code. The same declaration is bundled for the sandbox, so
each tool's handler is registered under its declared name.

:::note Where this applies today
The official News package is declared this way. The template and the other isolated official
packages still write their manifest by hand, as described in
[Getting started](./getting-started#defining-an-isolated-package); they move to `definePackage`
next.
:::

## Layout

News, for example:

```
news/src/
  consts.ts                ids
  package.ts               the contract and the declaration
  data/feeds.ts            schema + table
  data/headlines.ts        schema + table
  tools/refresh.tool.ts    definition + handler
  tools/headlines.tool.ts  definition + handler
  logic/feed-xml.ts        parsing (internal)
  voice/news-voice-skill.ts
  ui/news.ts               the UI's client for the contract
  ui/…                     screens and widgets
```

## Tables

A table is defined once, from a zod schema. The manifest carries its fields as Peers IR, and the
package's handlers use the same definition with a call's `ctx`:

```ts
// data/headlines.ts
import { defineTable, z, zodPeerId } from "@peers-app/peers-sdk/define";

export const headlineSchema = z.object({
  headlineId: zodPeerId.describe("Headline id."),
  feedId: z.string().describe("Feed this story came from."),
  title: z.string().describe("Story title."),
  link: z.string().optional().describe("Story URL."),
});
export type IHeadline = z.infer<typeof headlineSchema>;

export const Headlines = defineTable({
  name: "Headlines",
  description: "Latest stories fetched for the saved feeds.",
  primaryKeyName: "headlineId",
  schema: headlineSchema,
});
```

In a handler, `Headlines(ctx)` has `get(id)`, `list(filter?, options?)`, `count(filter?)`,
`findOne(filter?)`, `save(row)`, and `delete(id)`. `list` takes the same filters and paging
options as any Peers table (`Headlines(ctx).list({ feedId }, { pageSize: 20 })`). `save` parses
the row with the schema first, so defaults apply and an invalid row is rejected in the package.
An optional field left `undefined` is stored unset, and reads leave unset fields out.

The manifest types each field from its schema: an enum or a string literal is `string`, a
number or boolean literal is `number` or `boolean`, and `zodPeerId` is `id`.
Enum and literal fields that allow `null`, contain nullable or nested array elements, or use a
transform keep `any`, so the host can accept every value the schema allows.

List a table on a contract (`tables` in [`defineContract`](#the-declaration)) to expose it to
other packages and the UI, or on `pkg.tables` to keep it private. Pass `localOnly: true` to keep its rows on each device, and
raise `versionNumber` when its fields change.

Every call on a table goes through the package, its own handlers' and its consumers' alike: a
UI's or another package's `save` reaches the package's table and is parsed with its schema, so
defaults apply to them too
([Every call goes through the package](#every-call-goes-through-the-package)).

### Overriding table methods

To change what a table does, give it a class, as you would any table class. Extend
`PackageTable` for the table's schema and override a method; `super` reaches Peers:

```ts
class FeedsTable extends PackageTable<typeof feedSchema> {
  async save(feed: z.input<typeof feedSchema>) {
    return super.save({ ...feed, title: feed.title.trim() });
  }
}

export const Feeds = defineTable({
  name: "Feeds",
  description: "RSS or Atom feeds shared with the group.",
  primaryKeyName: "feedId",
  schema: feedSchema,
  tableClass: FeedsTable,
});
```

- `Feeds(ctx)` returns a `FeedsTable`, and so does every consumer call through a contract, so
  an override is the logic every caller gets. `this.ctx` is that call's context.
- `super.save` parses the row with the schema (defaults and transforms apply) and stores it;
  `get`, `list`, `count`, `findOne`, and `delete` go straight to storage.
- `dataChanged(event)` sees each change on its way to one subscriber, with `this.ctx` carrying
  that subscriber. Return it, return a changed copy, or return `undefined` to drop it. By
  default it passes the change through.
- Consumers can call the six standard methods. Other methods on the class stay private to the
  package.
- The class runs in the package's worker, like the rest of its code, never in the host.

A table can also be read-only to its consumers, when its rows must change through a tool. Timers
does this: a timer's row and its device schedule change together, in `write-timer`. Its class
refuses `save` and `delete`, and the package stores the rows it plans through a method of its own:

```ts
export class TimersTable extends PackageTable<typeof timerSchema> {
  async save(): Promise<never> {
    throw new Error("Timers change through the write-timer tool");
  }
  async delete(): Promise<never> {
    throw new Error("Timers change through the write-timer tool");
  }
  /** The package's own write. */
  write(timer: ITimer) {
    return super.save(timer);
  }
}
```

## Tools

A tool's definition and its handler sit together:

```ts
// tools/refresh.tool.ts
import { AccessLevel, defineTool, z } from "@peers-app/peers-sdk/define";

export const refreshTool = defineTool({
  name: "refresh",
  usageDescription: "Fetch every saved feed and replace its headlines.",
  accessLevel: AccessLevel.Writer,
  timeoutMs: 90_000,
  inputSchema: z.object({}),
  outputSchema: z.object({
    updated: z.number().describe("Feeds that were fetched."),
    errors: z.array(z.string()).describe("Feeds that failed."),
  }),
  handler: async (args, ctx) => {
    // ...
    return { updated, errors };
  },
});
```

- The handler gets the input as `inputSchema` parses it, and its own `ctx`: host calls made
  through it act for that call's caller. Calls run concurrently, so a handler that reads and
  then writes shared state runs that change through a small queue
  ([Guest API](./contracts#isolated-contract-packages-electron)).
- An input with a `.default()` or `.catch()` is optional in the manifest, including one wrapped
  with `.refine()`, `.readonly()`, or `.brand()`. The guest applies the fallback before the
  handler runs, so it also works for calls through the tools catalog. A `z.preprocess` that
  fills in a missing value isn't visible to the manifest, so that input stays required.
- `accessLevel` is the level a caller needs (the manifest carries it as `suggestedAccessLevel`).
  `timeoutMs` is the call's deadline, up to 120 seconds.
- `outputSchema` describes the result for callers and the catalog; the result isn't parsed with
  it. Return every required output field yourself, including fields with schema defaults. The
  result is copied as JSON would carry it, so an optional field can be left `undefined`.
- A contract defined elsewhere, such as [Voice Skill](./voice-skills), arrives as IR: declare
  its tools with `inputFields` and `outputFields` instead of schemas. Their input reaches the
  handler as sent.

## Calling contracts

`contractRef(contractId, version)` names a contract the package calls. Declare it with
`pkg.consumes(...)` and call it from a handler with that call's `ctx`:

```ts
import { newid, SystemHttp, SystemScheduler } from "@peers-app/peers-sdk/define";

const page = await SystemHttp(ctx).tools.request({
  requestId: newid(),
  method: "GET",
  url,
  responseType: "text",
});
```

`SystemHttp` and `SystemScheduler` are typed references to [System HTTP](../System/HTTP.md) and
[System Scheduler](../System/Scheduler.md). Type your own references with the contract from
[`defineContract`](#the-declaration), imported with `import type` so none of the provider's code
comes along. News's Voice Skill entry point references News's own contract this way:

```ts
import type { News } from "../package";

const NewsRef = contractRef<typeof News>(contractId, contractVersion);
await NewsRef(ctx).tools.refresh();
const latest = await NewsRef(ctx).tables.Headlines.list({}, { pageSize: 5 });
```

- Every tool and table is typed from the contract, and an id or version that doesn't match it is
  a compile error. A tool whose input has no required field can be called without one.
- `tables` has the same methods as the package's own table handle. Each call goes through the
  providing package's table (its class, if it has one), so `save` takes the schema's input and
  the provider's defaults and transforms apply.
- Tool input and saved rows are copied as JSON would carry them: a field left `undefined` is
  omitted.
- Without the contract's types (another package's contract you don't have the source for), type
  just the tools, with the provider's tool signatures (`IHttpConsumer["tools"]`).

A package can call its own contract this way when the Runtime should check the caller again.
News's Voice Skill entry point is open to Readers, so it runs `refresh` through the Runtime,
which requires Writer for it.

## Package-internal state

A package keeps its own state in persistent variables, declared at module scope the same way
as in any Peers code: `deviceVar`, `userVar`, `groupVar`, `groupDeviceVar`, and `groupUserVar`,
from `@peers-app/peers-sdk/define`. They need no `ctx`.

```ts
import { deviceVar } from "@peers-app/peers-sdk/define";

const refreshSchedule = deviceVar("refreshSchedule", { defaultValue: "" });

const scheduleId = refreshSchedule(); // read
refreshSchedule(next.scheduleId); // write
await refreshSchedule.loadingPromise; // wait until the write is saved
```

- Each is an observable. `v()` reads, `v(value)` writes, and `v.subscribe(fn)` hears every
  change, including one made on another device (a `userVar` or `groupVar` synced in).
- The Runtime loads every variable declared at module scope when the package's worker starts,
  before the first call, so handlers can read them right away. A variable created later loads
  when it's created; await its `loadingPromise` before reading it.
- A write updates the value at once and is saved in the background, in order. Await
  `loadingPromise` when the handler's result depends on the write being saved.
- `v.delete()` clears the stored value and goes back to the default. A stored `null` also reads
  as the default.
- The variables are the package's own: the Runtime prefixes each name with the package's id,
  so they never clash with another package's. They aren't part of any contract; to share a value,
  expose an observable instead.
- Outside a worker (in tests, or while `peers-package` reads the declaration) a variable is an
  in-memory observable that starts at its default.

## Events

An event is a signal out. Define it with its payload schema, list it on a provided contract,
and emit it from anywhere in the package:

```ts
import { defineEvent, z } from "@peers-app/peers-sdk/define";

export const finished = defineEvent({
  name: "finished",
  description: "A timer finished.",
  payloadSchema: z.object({
    title: z.string().describe("The timer's label."),
    kind: z.string().default("timer").describe("What finished."),
  }),
});

export const Timers = defineContract({ /* … */ events: [finished] });

await finished.emit({ title: "Tea" }); // no ctx
```

- `emit` parses the payload with the schema first, so defaults apply and a bad payload fails in
  the package. It resolves once the host has accepted the event. An event without a payload is
  sent with `emit()`.
- It needs no `ctx`: the package emits for itself, from a handler, a timer, or other background
  work. An event listed on two provided contracts goes out on both.
- The payload is copied as it's sent, the way JSON would carry it: `undefined` fields are left
  out, and `undefined` array entries become `null`. Dates and `Uint8Array`s are kept. A value
  that can't be sent (a function, a `Map`, a cycle, `NaN`) fails `emit`.
- The manifest describes the parsed payload: an optional or nullable field may be missing or
  `null`, and a field with a transform accepts any value.
- Events aren't replayed: subscribers get the ones emitted while they're subscribed.
- Outside a worker, `emit` checks the payload the same way and sends nothing.
- For a contract defined elsewhere, pass `payloadFields` (Peers IR) instead of a schema, or list
  the IR event in the contract's `events` directly when the package doesn't emit it.

## Observables

An observable is one value other packages and the UI can read, watch, and (when `writable`)
write. Define it over a `source` the package already uses: a package variable, or a plain
in-memory `observable()`.

```ts
import { defineContract, defineObservable, groupVar, observable, z } from "@peers-app/peers-sdk/define";

const location = groupVar("location", { defaultValue: { query: "", unit: "F" } });
const conditions = observable<{ temp: number } | null>(null);

export const Weather = defineContract({
  // contractId, version, name, description, tools …
  observables: [
    defineObservable({
      name: "location",
      description: "Saved city and display unit.",
      schema: z.object({ query: z.string(), unit: z.enum(["F", "C"]) }),
      writable: true,
      source: location,
    }),
    defineObservable({
      name: "conditions",
      description: "The latest reading.",
      schema: z.object({ temp: z.number() }).nullable(),
      source: conditions,
    }),
  ],
});

conditions({ temp: 71 }); // the package reads and writes the source as usual
```

- **A package variable** is stored; consumer reads and writes reach it through the package
  worker. Changes from any side reach subscribers through that worker, including changes
  synced from another device. It needs a `defaultValue`, which consumers read while the
  variable is unset.
- **An in-memory observable** is held by the package's worker. Reading it starts the worker,
  which publishes the value before the read returns, and the package's changes reach
  subscribers as they happen. The value starts over when the worker does. Use it for state
  that doesn't need to outlive the worker, like what the package is doing right now.
  - The worker publishes after the package's variables load, so a value derived from them
    starts out right.
  - Each value is copied as it's published, like an event payload.
  - `peers-package` fails the build when the source's starting value doesn't fit the value
    type. If the first publish still fails, the worker doesn't start; later failed publishes
    are logged.
- Consumer reads and writes run under the caller's authority. A write must fit the manifest's
  value type, then is parsed with the schema before the source takes it, for stored and
  in-memory observables alike. A stored write replies once its value is saved, and fails if
  the save does.
- The schema sets the value type the Runtime checks (`string`, `number`, `boolean`, `object`,
  `id`, or `any`): an enum or string literal is `string`, an array is `object`, and a value
  that can be `null` or `undefined`, or that comes from a transform, is `any`. Values are JSON,
  so a schema with a `Date` anywhere in it is rejected.
- For a contract defined elsewhere, pass `valueType` instead of a schema, or list the IR
  observable (with its `persistentVar` binding) in the contract's `observables` directly.

## The declaration

`src/package.ts` exports the package's own contract and default-exports the package's
definition:

```ts
import {
  defineContract,
  definePackage,
  SystemHttp,
  SystemScheduler,
} from "@peers-app/peers-sdk/define";

export const News = defineContract({
  contractId,
  version: 1,
  name: "News",
  description: "RSS and Atom headlines for a few allowlisted feeds.",
  tables: [Feeds, Headlines],
  tools: [refreshTool, headlinesTool],
});

export default definePackage((pkg) => {
  pkg.packageId = packageId;
  pkg.version = version;
  pkg.provides(News);
  pkg.provides(NewsVoiceSkill);
  pkg.consumes(SystemHttp);
  pkg.consumes(SystemScheduler, { optional: true });
  pkg.network = { allowedHosts: ["feeds.bbci.co.uk", "feeds.npr.org"] };
  pkg.appNavs = [{ name: "News", iconClassName: "bi bi-newspaper", navigationPath: "app" }];
  pkg.actionAliases = { get_headlines: headlinesTool, refresh_news: refreshTool };
});
```

- `defineContract` declares a contract: its id (from `newid()`), version, name, description,
  and the `tables`, `tools`, `observables`, and `events` it exposes. It checks each member's
  kind and rejects a name used twice. The value and its member lists are frozen and typed
  read-only. Export it so the package's UI (and other packages) can reference it by type.
- `pkg.provides(contract)` provides it. A contract defined elsewhere is a `defineContract` too:
  News's `NewsVoiceSkill` takes its members as IR from the shared Voice Skill declaration, with
  News's own `invoke` tool.
- `pkg.consumes(ref, { optional })` declares a dependency.
- `pkg.network`, `pkg.appNavs`, and `pkg.executionMode` set the manifest fields of the same
  names. `pkg.actionAliases` maps voice or UI action names to provided tools.

## Every call goes through the package

A package is the server for its contracts, and its consumers (UIs and other packages) are its
clients. Every consumer call reaches the package's code in its worker, under the caller's
authority, and everything sent back passes through it:

- **Tables:** `get`, `list`, `count`, `findOne`, `save`, and `delete` run the table's class
  ([Overriding table methods](#overriding-table-methods)). Each change on its way to a
  subscriber passes through the class's `dataChanged`, with that subscriber's context.
- **Observables:** reads and writes go to the observable's source (or, for an IR declaration,
  the package variable it names). Values on their way to subscribers pass through unchanged.
- **Events:** emitted by the package's code; each payload on its way to a subscriber passes
  through the package unchanged.
- **Subscriptions:** subscribing and unsubscribing go to the package too. The package accepts
  every subscription; there's no hook to refuse one yet. A subscription carries on across the
  package's restarts and updates, and unsubscribing never starts the worker.
- **Tools:** run their handlers, as always.

If the package's worker can't start, its contract calls fail, as a request to a stopped server
would. The package's own calls to its tables and variables go straight to Peers, and so does
sync: a change that arrives from another device already went through the package on the
device that made it.

The manifest says `guestApi: 3` for this (`peers-package` sets it). Hosts that predate it
reject the package, rather than serve its tables without it.

## Using the contract from a UI

A package's screens and widgets are clients of the Runtime, like the admin UI: they call the
package's contract through the host, not the package's code. Give the UI a client for the
contract in one place:

```ts
// ui/news.ts
import { hostContract } from "@peers-app/peers-sdk";
import { contractId, contractVersion } from "../consts";
import type { News } from "../package"; // types only: no handler code in the UI bundle

export const news = hostContract<typeof News>(contractId, contractVersion);
```

Then use it anywhere in the UI:

```tsx
import { useRows, useTool } from "@peers-app/peers-ui";

function Feeds() {
  const { rows: feeds } = useRows(news.tables.Feeds, {}, { pageSize: 50 });
  const refresh = useTool(news.tools.refresh);
  return (
    <>
      <button disabled={refresh.pending} onClick={() => refresh.run()}>Refresh</button>
      {refresh.error && <div>Couldn't refresh.</div>}
      {feeds.map((feed) => <div key={feed.feedId}>{feed.title}</div>)}
    </>
  );
}
```

- **Typed from the contract.** `tools`, `tables`, `events`, and `observables` are all typed by
  `import type`, which brings none of the package's code into the UI bundle. At runtime the
  client needs only the id and version, which must match the contract's (a mismatch doesn't
  compile). `hostContract(contractRef<typeof News>(contractId, contractVersion))` is the same
  client, from a reference.
- **`useTool(call, { onSuccess, onError })`** from `@peers-app/peers-ui` runs a tool and tracks
  it: `run(input)` resolves to the result, or `undefined` when it fails (it never throws);
  `pending`, `result`, and `error` describe the latest run; `reset()` clears state without
  cancelling calls or their callbacks. Callbacks run for each completion, including older
  overlapping runs. Callback failures are logged and do not change the tool's outcome; async
  callbacks are not awaited. It takes table writes too (`useTool(news.tables.Feeds.save)`)
  or any async function. `run` keeps one identity
  across renders and calls the latest function; nothing updates after unmount.
- **Tables** have the package's table methods and `dataChanged.subscribe(handler)`. Each call
  goes through the package's table, so `save` takes the schema's input and the package's
  defaults, transforms, and overrides apply, and each change reaches the UI through the
  table's `dataChanged`. **Events** have `subscribe(handler)`. **Observables** are
  live local copies: read one with `useObservable(weather.observables.location)` and write it
  by calling it with a value when declared writable. Read-only declarations expose a
  `ReadonlyObservable`; only writable observables have a callable typed `useObservable` setter.
  A write the provider refuses is logged, and the copy reads the
  provider's value again. Writes made while disconnected wait for a connection (up to the
  client's timeout); writes to different observables have independent queues. A slow reread
  cannot replace a newer provider push.
- **`useRows(table, filter, options)`** from `@peers-app/peers-ui` keeps rows current. It reads
  on mount, and again when the table changes, after a reconnect, or when the filter or options
  change. It also reads once a remote subscription becomes live, covering changes missed
  during setup. Changes that arrive during a read cause one more read, not one per change.
- **Connection.** Calls wait for the host connection (10 seconds by default). Subscriptions and
  observables wait as long as it takes and re-attach after a reconnect;
  `subscribe(handler, { onReconnect })` reports when changes may have been missed, after the
  replacement subscription is live. The returned subscription's `ready` promise reports whether
  its initial attachment succeeded; unsubscribing before attachment resolves it to `false`. When
  the initial attachment fails, the next one that goes live after a reconnect calls `onReconnect`.
  Calls go to the active group; switching groups reloads the window.
- **One client per contract.** `hostContract` without options returns the same client for
  the same contract id and version, even from a new reference. It isn't a hook, so it works in
  event handlers and plain functions too.
- **Disposal.** Shared clients live for the window's lifetime. A client created with options is
  independent; call `dispose()` when its owner ends. Disposal cancels connection waits, ends
  subscriptions, and refuses new calls and observable writes; cached observable reads remain.
- The renderer provides `@peers-app/peers-ui`, like `@peers-app/peers-sdk`; list it as a peer
  dependency and a webpack external.
- **Access.** A UI's calls act as the signed-in user today, as every UI call does
  ([Local UI-to-host contracts](./contracts#local-ui-to-host-contracts)).

### Testing a UI

`mockHostContract` from `@peers-app/peers-sdk/testing` stands in for the host. The UI's own
client connects to it, with no signed-in user and no provider running:

```ts
import { mockHostContract } from "@peers-app/peers-sdk/testing";
import { News } from "../package"; // a test can import the contract itself

const host = mockHostContract(News, {
  tables: { Feeds: [{ feedId: newid(), title: "NPR", url: "https://feeds.npr.org/1001/rss.xml" }] },
  tools: { refresh: async () => ({ errors: [] }) },
});
// Render the screen; it reads and writes through `news` as usual.
await host.tables.Feeds.save(nextFeed); // the screen sees the change
host.tables.Feeds.rows; // what the screen saved
host.dispose();
```

- **Tables** hold rows in memory, and a UI's calls go through the table's class with a test
  context, as on the host: a save runs the class's overrides and the schema, defaults
  included, and observed changes reach subscribers through the class's `dataChanged`.
  Delivery hooks stop when the last subscriber leaves or the mock host is disposed. The test
  context's `callOwnedTable` reaches the mock's rows; its other calls fail. `host.tables` are
  storage writes, with no class or schema in between, validated against the manifest's fields
  as host storage does; their changes still pass through the class. Filters are equality
  (`{ feedId }`) and `$in` (`{ status: { $in: ["running", "paused"] } }`); a filter with other
  operators (`$or`, `$matchWords`) fails rather than guess. Equality to `null` or `undefined` matches
  omitted optional fields, as in host storage. Paging and `sortBy` work; other query options,
  including text search, fail explicitly.
- **Tools** answer with the fakes you pass, given the input as the tool's schema parses it. A
  tool without a fake fails when called, and a private tool refuses UI calls, as the host does.
  Access levels aren't checked.
- **Observables** start with the values you pass; others start as the host serves them, a
  stored observable's default or the value an in-memory one's source holds. Set
  `host.observables.x(value)` to push one, and read it to see what the UI wrote. Read-only ones
  refuse UI writes, as the host does. Every UI write must fit the manifest's value type first,
  including IR declarations; schema defaults and coercion cannot bypass that check. Schema
  declarations then parse the write, and the observable keeps the parsed value, as the
  package does. `host.events.x.emit(payload)` reaches subscribers.
- **`onCall(call)`** runs before each answer: return a promise to delay it, or throw to fail it
  (an offline read, a refused save). It cannot replace the answer.
- Values are copied using the isolated boundary's supported value types, including Dates and
  `Uint8Array`s. The helper also works in Jest's jsdom environment, without `structuredClone`.
  One mock host runs at a time; dispose it after unmounting what you rendered. Disposing it
  rejects calls still waiting for an answer.

News's `src/ui/ui-test-kit.mjs` renders its screen and widget this way under `node --test`,
bundling them with esbuild so React and the SDK stay single copies.

## Building

```json
"scripts": {
  "generate-manifest": "peers-package manifest",
  "build:package": "peers-package build",
  "dev:package": "peers-package build --watch"
}
```

- `peers-package manifest` loads `src/package.ts` in Node and writes `dist/manifest.json`. It
  fails if the manifest doesn't validate.
- `peers-package build` also bundles the same `src/package.ts` for the sandbox, with a generated
  entry that registers every tool's handler, and writes `dist/package.bundle.js`, the artifact
  the Runtime installs.
- A failed provider build preserves the last successful manifest and artifact. Watch mode
  rebuilds both outputs, reloads the declaration's CommonJS dependencies, and updates its
  bundler settings when `executionMode` changes.

Use `--root`, `--entry`, and `--out-dir` to select the package root, declaration file, and
output directory. Entry and output paths are relative to the package root; the output directory
can also be outside the package.

The command uses the package's own `esbuild` (`npm install --save-dev esbuild`). The bundle uses
one copy of zod for the package and the SDK, defines `process.env.NODE_ENV` the way other
bundlers do, and strips comments. The sandbox rejects some text even inside a string or
comment (`import(`, `<!--`, `-->`, and a direct `eval(`), so the build fails with the place it
found one rather than leaving it to fail at install.

## Testing

`runPackageTool(tool, args, ctx)` runs a tool the way the Runtime does: it parses the input,
then calls the handler. Pass a fake `ctx` that records or answers host calls.
`startPackage(definition, ctx)` starts the package's variables, events, and in-memory
observables with a fake `ctx`, the way the worker start does. To test what ships,
evaluate `dist/package.bundle.js`'s provider source with a fake `registerContractTool`,
`registerHandler`, `onWorkerStart`, and `ctx`, as News's tests do; the bundle throws if one of
the three functions is missing. Each provided contract registers its member handler under
`contractMemberHandlerName(contractId, version)` (from `@peers-app/peers-sdk`). Call it with
`{ member: "table", name: "Feeds", operation: "save", args: [row] }` to make a consumer's
call, which runs through the table's class.

## What the sandbox provides

Sandboxed packages run ordinary isomorphic JavaScript. Besides the language itself, the sandbox
provides the web platform basics that carry no authority:

- `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `atob`, `btoa`, `structuredClone`
- `crypto.getRandomValues`, `crypto.randomUUID`, `crypto.subtle`
- `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `queueMicrotask`
- `AbortController`, `AbortSignal`, `Event`, `EventTarget`, `DOMException`
- `console`, `performance.now`, `Intl`, the float typed arrays
- `self` and `global`, both the package's own global object

Timers return numeric ids. A timer or microtask callback that throws or rejects is logged with
`console.error` instead of stopping the package. Package `console` output goes to the host's
output, as it does for privileged packages.

Anything that carries authority stays behind a contract: the network (System HTTP), files,
processes, and other packages. There is no `fetch`, `process`, `require`, or `Buffer`.

WebCrypto keys are opaque frozen handles so Node's native key objects never enter the sandbox.
The standard `crypto.subtle` operations accept these handles. Keep them in memory;
`structuredClone` does not preserve their key identity. Copy extractable keys with
`subtle.exportKey` and `subtle.importKey`.

Code runs in strict mode, and the built-in prototypes are frozen, so a library that patches
`Array.prototype` or similar fails. Everything is bundled at build time; there is no runtime
module loading.

## Related topics

- **[Getting started](./getting-started)** — create, import, and build a package.
- **[Package contracts](./contracts)** — contracts, the Guest API, and isolated packages.
- **[Voice skills](./voice-skills)** — the Voice Skill contract.
- **[System: Tables](../System/Tables)** — filters, local-only tables, and reactivity.
