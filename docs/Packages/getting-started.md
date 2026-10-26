---
sidebar_position: 1
title: Getting started
---

# Packages

Peers **packages** are how the app loads extensible behavior: **tables** and **tools** (and related metadata) on the server/runtime side, **routes** for URL mapping in the browser, and **UI bundles** for React screens. The desktop app and PWA install package versions from bundled assets or synced updates, then each **device** chooses which version to run within a group (or personal space), using group-level defaults on `IPackage` when the device has no override.

When a **package version record** syncs to a device, Peers also downloads that version’s **package, routes, and UI bundle files** into the local content-addressed cache. Downloading those bytes does **not** activate the version — activation still follows group defaults and this device’s pin / follow settings.

At a high level, a package contributes:

- **Runtime manifest and provider** — isolated table, contract, tool, and navigation declarations,
  plus provider source that Electron and headless can run in a supervised container.
- **Routes** — small bundle that registers URL paths before UI loads.
- **UI** — lazy-loaded React components registered by `peersUIId`.

## Package lifecycle

Packages follow a **three-phase lifecycle**: `dev` → `beta` → `stable`. Disk updates create **dev** versions; promotion to beta or stable is explicit, in the **Versions** UI or with `peers packages promote`. Dev records sync to the group but **never auto-activate on other devices** unless those devices opt in.

When you **activate** a different version on this device, routes and UI bundles reload without a full page refresh.

See **[Package lifecycle](./package-lifecycle)** for development workflow, per-device pin/follow settings, and releasing to the group. See [Package lifecycle design](../Roadmap/package-lifecycle) for design rationale and remaining roadmap work.

## Creating a new package

Creating or cloning a package from the desktop app requires **git**, **Node.js**, and **npm** on your machine. Peers looks them up through your login shell so tools installed via nvm, Homebrew, or fnm work even when the app was opened from Finder or the Dock. If those tools are truly missing, the create dialog explains how to install Node.js from [nodejs.org](https://nodejs.org) and restart Peers.

The fastest way to start a new package is from the Peers app
(**Packages → Create**), which clones the
[peers-package-template](https://github.com/peers-app/peers-package-template),
patches IDs, builds bundles, registers the `Packages` record, and provisions a
per-package author signing key in your personal space. A package made from the template needs
the latest Peers release; an older app refuses to install it, so update Peers first.

You can also scaffold on disk and import:

```bash
git clone https://github.com/peers-app/peers-package-template.git ~/peers/packages/my-app
cd ~/peers/packages/my-app
rm -rf .git
# fill in src/consts.ts and peers.packageId in package.json (see Set up IDs below)
# update README.md's title and first paragraph, then:
npm install && npm run build
```

Then import the directory: open **Packages → Create** in Peers and select it, or run
`peers packages import ~/peers/packages/my-app`.

### Importing an existing package directory

If the target directory already exists and contains a valid `package.json` with `peers.packageId`, create/import **does not** re-clone the template. It:

1. Validates the manifest package ID
2. Recovers the signing public key before saving the package. The target `Packages` row takes precedence; if it is absent, Peers searches your personal context, then groups, for the same package ID's first nonblank `publishPublicKey`. It can also recover the key from metadata cached alongside your personal signing secret, or through host decryption of an older encrypted secret. A new keypair is created only when both the public key and signing secret are missing; established keys are never silently rotated.
3. Creates or updates the `Packages` row (name, description, optional `remoteRepo`)
4. Persists `packageLocalPath_<packageId>` for that data context
5. Installs the on-disk `dev` bundles

If those bundles match the package's existing `dev` `PackageVersions` row, import reuses that row instead of writing a new one. If `Packages.activePackageVersionId` is empty, as it is after deleting and re-importing a package, import sets it to that version and activates it on this device. Deleting a package removes only its `Packages` row; its version rows and bundle files remain so a later import can reuse them.

This is the supported path for monorepo apps under `official-packages/` (for example Groceries).

From a terminal, `peers packages import <path>` imports a folder; it fails rather than
scaffolding when the folder is missing. After a rebuild, `peers packages reload <packageId>`
installs the new bundles and exits `1` with the load error if the new version does not run,
while the previous version keeps running. `peers packages get <packageId>` shows the running
version and the last error, and `peers packages uninstall <packageId>` removes the package.
See [Packages](../System/Packages.md).

Importing the same local package by name into Personal or another group reuses its publisher identity. Deleting the package leaves your personal signing secret and its cached public key intact, so re-importing after uninstall also preserves that identity. Import fails without changing keys if the available public keys disagree, or if an existing secret has no recoverable public key.

### Project structure

The template starts as a small shared list, with one table, one tool, and one screen:

```
my-app/
├── src/
│   ├── consts.ts               # Package, contract, and screen IDs
│   ├── package.ts              # The contract and the package's declaration
│   ├── data/items.ts           # A table: zod schema + defineTable
│   ├── tools/add-item.tool.ts  # A tool: definition + handler
│   ├── ui/
│   │   ├── client.ts           # The screen's client for the contract
│   │   └── app.tsx             # The screen
│   ├── routes.ts               # URL path registrations (eager)
│   ├── uis.ts                  # React component registry (lazy)
│   └── app.test.mjs            # Tests for the tool and the screen
├── webpack.routes.config.js
├── webpack.uis.config.js
├── README.md                   # Its first paragraph is the package's description in Peers
└── package.json
```

`src/package.ts` declares what the package is: the tables, tools, observables, and events of
the contracts it provides, and the contracts it consumes. **[Declaring a
package](./declaring-a-package)** covers each of them.

The build produces three output bundles:

| Bundle | Built from | Purpose |
|--------|-----------|---------|
| `package.bundle.js` | `src/package.ts`, by `peers-package build` | The manifest Peers reads, and the package's code for the sandbox |
| `routes.bundle.js` | `src/routes.ts` | URL path mappings (loaded eagerly at startup) |
| `uis.bundle.js` | `src/uis.ts` | React components (loaded lazily on navigation) |

Peers reads a package's manifest without running its code, and runs the code in a supervised
sandbox worker on Electron and headless hosts (a package can instead run as a privileged Node
process; see [below](#provider-execution-modes)). Screens and widgets run in the app's window
and reach the package through its contracts. See **[Routes and UI](./routes-and-ui)** for how
those bundles are loaded and why they are split.

Upgrade every peer that syncs a group before using a package's tables there; older hosts
store package tables under a different name.

### Set up IDs

The template ships with placeholder IDs in `src/consts.ts`:

```ts
export const packageId = "<package-id>";
export const packageName = "<package-name>";
export const contractId = "<contract-id>";
export const contractVersion = 1;
export const appScreenId = "<app-screen-id>";
```

Replace the three ID placeholders with values generated by `newid()` from `@peers-app/peers-sdk`. All Peers IDs must be exactly 25 alphanumeric characters. You can generate IDs with the CLI:

```bash
peers tools run new-id
```

`new-id` is supplied by the Common Tools contract in peers-core. Local CLI calls
use the runtime catalog and its active provider; the command and existing tool ID
remain unchanged.

Update `packageName` to your package's display name and set `peers.packageId` in
`package.json` to match `packageId`. Update the title and first paragraph in `README.md` too;
Peers shows that paragraph as the package's description. The desktop creator fills in the IDs
and name automatically.

### Build and run

```bash
npm install
npm run build
```

This produces `dist/package.bundle.js`, `dist/routes.bundle.js`, and `dist/uis.bundle.js`. Import
the directory once with `peers packages import <path>`. After subsequent builds, install the new
bundles and reload the UI:

```bash
peers packages reload <packageId>
peers ui reload
peers ui screenshot   # prints the path of a PNG of the Peers window
```

Open the printed file to check what your package's screen looks like (an agent can open it
too); `peers ui inspect --text` shows the visible text instead.

During development, `npm run dev` rebuilds all three bundles as you change files. After a
change to the package itself, `peers packages reload <packageId>` installs the new build.
`npm test` runs the template's tests, the tool against a fake host and the screen against
`mockHostContract`, without a running host ([Testing](./declaring-a-package#testing)).

### Webpack externals

The renderer provides `React`, `@peers-app/peers-sdk`, `@peers-app/peers-ui`, and `zod` as
globals. The route and UI webpack configs list them as **externals** so they are not bundled.
The package's own code is not a webpack entry: `peers-package build` bundles it, with
`@peers-app/peers-sdk/define` and any other libraries it imports.

## Provider execution modes

`pkg.executionMode` accepts exactly `"sandbox"` or `"privileged"`. Omission keeps the
SES sandbox: no ambient `process`, `require`, filesystem, or subprocess access. The field
applies only to the package's code; routes and UI do not gain Node access. Privileged providers
are supported in Electron and headless. Browser/PWA provider execution remains unsupported.

A privileged provider is **trusted device code**. It runs in its own Node process as the same
OS account as Peers, without root/admin elevation. It inherits Peers' environment and working
directory and can access the filesystem, network, and subprocesses directly. Existing host
bridge checks still apply to ordinary contract, table, pvar, and event calls, but direct OS
access bypasses sandbox and network-policy confinement. There are no granular permissions or
additional consent gate in this mode.

A privileged package imports Node built-ins as usual, and `peers-package build` bundles it for
Node:

```ts
// src/tools/platform.tool.ts
import { platform } from "node:os";
import { AccessLevel, defineTool, z } from "@peers-app/peers-sdk/define";

export const platformTool = defineTool({
  name: "platform",
  usageDescription: "The operating system this device runs.",
  accessLevel: AccessLevel.Reader,
  inputSchema: z.object({}),
  outputSchema: z.object({ platform: z.string() }),
  handler: () => ({ platform: platform() }),
});
```

```ts
// src/package.ts: list platformTool in the contract's tools, then
export default definePackage((pkg) => {
  // …
  pkg.executionMode = "privileged";
});
```

Use Node built-ins only in a privileged package; a sandboxed package cannot load them.

Both IIFE and bundled CommonJS providers work, including bundles whose entrypoint has a
leading `#!/usr/bin/env node` shebang. Node provides `require`, `module`, `exports`,
`__filename`, and `__dirname`; the synthetic filename is `.peers-isolate-provider.cjs` under
Peers' inherited working directory. It is not the author's package directory. Bundle dependencies
into the source: the artifact format does not distribute package-directory assets or
`node_modules`. Native modules and external files are not automatically installed on devices.
The provider uses the Node version shipped with its host (Electron's embedded Node on desktop).
Standard output and standard error go to the host's output streams; bridge traffic uses a
separate IPC channel, so provider logging does not interfere with contract replies.

A privileged provider can keep working after a tool call returns: a timer or a child process's
output can write the package's own tables and pvars and emit its events, and consumers of a
contract-exposed table see those writes through `dataChanged` as usual. A declared package
starts when its contract is first used, including table reads and subscriptions. Starting it
at activation isn't supported yet.

Startup stays lazy, with one session per package/data context. Normal deadlines still apply:
Electron and headless allow 30 seconds for startup/evaluation and, by default, each tool call;
a tool can declare `timeoutMs` up to 120 seconds. A timed-out call is rejected while the
process and its state keep running; the session is terminated
only when it then fails a liveness ping, or crashes, and the next invocation starts a fresh
one. Startup and evaluation timeouts still terminate the session. Switching modes requires normal version
replacement, which stops the previous session. Invalid replacements retain the old registration.

Activation follows existing device/group version selection, pin, and follow rules. A version
that becomes active on several devices can therefore run privileged code on each of them.
Downloading a version does not activate it. Termination kills only the provider process and
cannot undo filesystem, network, or other OS side effects. Any spawned descendants, including
ordinary subprocesses created without `detached: true`, may survive timeouts, replacement, or
shutdown. Providers must manage descendant cleanup; the runtime does not guarantee it.

## Writing the manifest by hand

A package can write its manifest and provider source itself instead of declaring them with
`definePackage`, as Peers' isolation test packages do. Prefer
[Declaring a package](./declaring-a-package): the manifest, the handlers, and the UI's types
then come from one declaration, and the build checks them against each other.

A build script combines a pure-data manifest with the provider's source text. This example
uses `peers.packageId` from `package.json`; replace `<contract-id>` with a generated contract
ID, and create `src/provider-source.js` for the provider code. The provider source can't be
empty; for this observable-only example, a comment is enough:

```javascript
// build-package.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { serializeIsolatedPackageArtifact } from "@peers-app/peers-sdk";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const packageId = packageJson.peers.packageId;
const contractId = "<contract-id>";

const manifest = {
  packageId, // 25-character Peers ids, from `peers tools run new-id`
  version: packageJson.version,
  guestApi: 2,
  tables: [],
  provides: [{
    contractId,
    version: 1,
    name: "My App",
    tools: [],
    observables: [{
      name: "state",
      description: "Shared application state.",
      valueType: "object",
      writable: true,
      persistentVar: { scope: "group", name: "state", defaultValue: {} },
    }],
  }],
  consumes: [],
  appNavs: [{ name: "My App", iconClassName: "bi bi-app", navigationPath: "app" }],
};
const providerSource = await readFile("src/provider-source.js", "utf8");
await mkdir("dist", { recursive: true });
await writeFile("dist/package.bundle.js", serializeIsolatedPackageArtifact({ manifest, providerSource }));
```

- Every isolated package provides at least one contract, and each provided contract has at
  least one tool, table, observable, or event. A writable observable backed by a persistent variable
  gives a UI-first package a small reactive store without starting a worker; prefer tables for
  record-oriented data.
- Each package-owned table is declared once, in `manifest.tables`: a package-local name, primary
  key, fields, an optional schema version, and optionally `localOnly: true` to keep its rows on
  each device ([Local-only tables](../System/Tables#local-only-tables)). There is no table id or
  physical name to declare. A provided contract exposes a table by listing its name; the rest
  stay private.
- The provider source is JavaScript stored in the artifact. Copied in as is, it can't import
  modules; bundle it to use libraries, as `peers-package` does. Declare each tool in the
  manifest and register its handler with `registerContractTool`.
- With `guestApi: 2`, each handler is `async (args, ctx) => { ... }`. `ctx.callOwnedTable` (any
  table method, with filters for `list`), the owned persistent-variable helpers, and event emits
  work whenever the package's worker runs, including from a timer and from
  `onWorkerStart(async (ctx) => { ... })`; calls into other packages' contracts need an active
  tool call. Calls run concurrently, so a handler that reads and then writes the same row runs
  that change through a small queue kept in module state. A call that times out is rejected
  while the worker keeps running ([Guest API](./contracts#isolated-contract-packages-electron)).
- `appNavs` declares the entries in the Apps launcher (`pkg.appNavs` in a declaration). Each
  `navigationPath` matches a route in `src/routes.ts`. Omit `appNavs` for a package that only
  shows a widget, as Weather does.
- `network` names the HTTPS hosts the package may call through [System HTTP](../System/HTTP.md)
  (`pkg.network`), and `executionMode` is `pkg.executionMode`
  ([above](#provider-execution-modes)). A privileged provider bundled by hand uses esbuild with
  `platform: "node"` and `format: "cjs"`.
- `versionTag` and contract `devTag` are **not** set in code. The platform assigns them from the
  package's promotion state.

Legacy host-backed packages, built with `definePackage` from `@peers-app/peers-sdk` rather than
`@peers-app/peers-sdk/define`, still load for compatibility.

## Author signing keys

Each package has an Ed25519 **author** keypair used to sign non-dev publish artifacts:

- **Public key** — stored on the `Packages.publishPublicKey` field (TOFU anchor for verifiers), with a recovery copy in the signing pvar's description. The versioned `peers-package-signing-key:v1:<packageId>:<publicKey>` marker is bound to that package ID and validated before use; the human-readable description is retained.
- **Secret key** — stored as a secret user pvar named `packageSigningKey_<packageId>` in your personal data context. Do not commit it or paste it into chat/logs.

Keys are created when a package is first registered (create or import) if both the established public key and signing secret are missing. Re-importing the same directory reuses the target's established public key. When the target `Packages` row is absent, importing reuses the same package ID's first nonblank public key from your personal context or groups.

Uninstalling from any or all contexts leaves the personal signing pvar intact. Its cached public key lets a later import restore the same publisher identity even when every `Packages` row has been deleted. Imports lazily add this metadata to older pvars without changing or re-encrypting their stored secret value.

For legacy encrypted secrets without metadata, Node hosts (Electron and headless) use their existing user-secret decryption to recover only the public key for the importer. SDK hosts can supply the optional `resolveSigningPublicKey(encryptedSecret)` create/import callback for this recovery. If decryption is unavailable or fails, an established or cached public key can still be reused. A disagreement between established, cached, or recovered keys fails the import before any signing-key or package writes. An existing unreadable secret is never replaced automatically; if no public key is recoverable, restore `publishPublicKey` or unlock the secret before importing.

Explicitly deleting `packageSigningKey_<packageId>` removes your local author signing secret. If every installed copy of the package is also deleted, the next import generates a **new publisher identity** and restores the pvar's deterministic ID even if it was previously deleted. If an established public key remains in another context, Peers retains that identity without generating replacement keys; restore the matching secret to publish under it.

## Related topics

- **[Declaring a package](./declaring-a-package)** — `definePackage`, tables, tools, contracts, the `peers-package` build, and what the sandbox provides.
- **[Routes and UI](./routes-and-ui)** — how routes and UI bundles work, how to author them, and why to prefer route-based rendering.
- **[Package lifecycle](./package-lifecycle)** — develop, release, and run versions (dev / beta / stable).
- **[Package contracts](./contracts)** — versioned interfaces, isolated manifests, validation, and the registry.
- **[Voice skills](./voice-skills)** — how a package becomes voice-addressable and contributes a widget.
- **[System HTTP](../System/HTTP)** — host-mediated HTTPS, allowlists, and credential refs.
- **[System Scheduler](../System/Scheduler)** — device-local wake-ups of a package's own tool.
- **[Package lifecycle design](../Roadmap/package-lifecycle)** — design doc and shipped vs planned work.
- **[System: Tables](../System/Tables)** — how Peers models data with tables and reactivity.
- **[System: Workflows](../System/Workflows)** — how tools run in workflow runs (often used together with package tools).
