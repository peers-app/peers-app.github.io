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
  package.ts               the declaration
  data/feeds.ts            schema + table
  data/headlines.ts        schema + table
  tools/refresh.tool.ts    definition + handler
  tools/headlines.tool.ts  definition + handler
  logic/feed-xml.ts        parsing (internal)
  voice/news-voice-skill.ts
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

List a table on a contract (`contract.tables`) to expose it to other packages and the UI, or on
`pkg.tables` to keep it private. Pass `localOnly: true` to keep its rows on each device, and
raise `versionNumber` when its fields change.

zod defaults are functions, so they aren't part of the IR: a field with a default is required
for anyone else who writes the table, and the package's own `save` fills it in.

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
  it. Return every required output field yourself, including fields with schema defaults.
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
[System Scheduler](../System/Scheduler.md). Type your own references with the provider's tool
signatures, or with its tool declarations:

```ts
const News = contractRef<{ refresh: typeof refreshTool }>(newsContractId, 1);
await News(ctx).tools.refresh({});
```

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

## The declaration

`src/package.ts` default-exports the package's definition:

```ts
import { definePackage, SystemHttp, SystemScheduler } from "@peers-app/peers-sdk/define";

export default definePackage((pkg) => {
  pkg.packageId = packageId;
  pkg.version = version;

  const news = pkg.contract(contractId, 1, "News", "RSS and Atom headlines.");
  news.tables = [Feeds, Headlines];
  news.tools = [refreshTool, headlinesTool];

  const voice = pkg.contract(skill.contractId, skill.version, skill.name, skill.description);
  voice.tools = [newsVoiceInvoke];
  voice.observables = skill.observables;
  voice.events = skill.events;

  pkg.consumes(SystemHttp);
  pkg.consumes(SystemScheduler, { optional: true });
  pkg.network = { allowedHosts: ["feeds.bbci.co.uk", "feeds.npr.org"] };
  pkg.appNavs = [{ name: "News", iconClassName: "bi bi-newspaper", navigationPath: "app" }];
  pkg.actionAliases = { get_headlines: headlinesTool, refresh_news: refreshTool };
});
```

- `pkg.contract(...)` provides a contract; assign its `tables`, `tools`, `observables`, and
  `events`. Observables (each backed by a package-prefixed persistent variable) and events are
  declared in IR for now.
- `pkg.consumes(ref, { optional })` declares a dependency.
- `pkg.network`, `pkg.appNavs`, and `pkg.executionMode` set the manifest fields of the same
  names. `pkg.actionAliases` maps voice or UI action names to provided tools.

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
then calls the handler. Pass a fake `ctx` that records or answers host calls. To test what ships,
evaluate `dist/package.bundle.js`'s provider source with a fake `registerContractTool` and
`ctx`, as News's tests do.

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
