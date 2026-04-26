# Roadmap: Standardize build tooling (npm, Node, Biome, bundlers)

This document is the **implementation plan** for converging package management, Node version, lint/format, dependency versions, and (later) bundlers across the `peers-app` monorepo. It is designed for **small, verifiable steps** with explicit validation after each change so regressions are caught before the next step.

**Related context:** Prior discussion and audit live in the Cursor plan *Standardize Build Tooling* (`standardize_build_tooling_ec503091`); this roadmap turns that into a repo-native, reviewable checklist.

---

## Documentation and handoff (required)

This file is the **canonical narrative** for the standardize-build-tooling effort. Cursor plans (for example Phase 1) are **snapshots** of intent; they can go stale. **Subsequent agents (and humans) must be able to open only this document and have enough context to continue** without re-deriving history from chat or submodule diffs alone.

**After every meaningful chunk of work** (a PR, a merged submodule, or a stopped session), update **both**:

1. **This roadmap** — especially [Progress log](#progress-log) and, when appropriate, [Current state (snapshot)](#current-state-snapshot) or [Done criteria](#done-criteria-checklist).
2. **The active Cursor plan** (if one exists for the current phase) — short pointer to what changed and “see roadmap Progress log.”

**What to append to the Progress log each time:**

- **Date** (UTC or local, be consistent) and **phase** (0–5 or subsection, e.g. “Phase 1.2”).
- **What changed:** submodule(s), files touched at a high level (`package.json`, workflow path, lockfile), not a full diff.
- **Commits:** branch names and **commit SHAs** (submodule + root if applicable) so someone can `git show` without guessing.
- **Validation:** exact commands run (`npm run build`, `npm test`, `yarn test`, CI job name) and **pass/fail**; note flaky or skipped tests.
- **Decisions / exceptions:** e.g. “left peers-react-native on TS X because Expo Y”; “Jest 29 chosen over 30 — see log entry.”
- **Blockers and next step:** one concrete “do this next” line for the next agent.

**When to edit the snapshot table:** After a **phase completes** or when reality diverges from the table (e.g. first submodule migrated to npm), refresh [Current state (snapshot)](#current-state-snapshot) or add an “As of YYYY-MM-DD” note so stale rows are not misleading.

**Task system:** If you use the internal `#peers` task, put the **taskId** in the Progress log entry and keep task **statusDetails** in sync with the same facts.

---

## Progress log

Append new entries at the **top** (most recent first). Use this template:

```markdown
### YYYY-MM-DD — Phase X.Y — short title

- **Author / agent:** optional
- **Submodules / root:** …
- **Changes:** …
- **Commits:** `repo` @ `abc1234` (repeat per repo)
- **Validation:** commands + result
- **Decisions / exceptions:** …
- **Next step:** …
- **Related task:** optional taskId
```

### Entries

> **Resume here (Phase 4+):** **[Phase 3](#phase-3--standardize-on-npm)** complete for **docs + scripts + migrated submodules**. **3.1** — all JS app submodules on **`package-lock.json`** except optional **`peers-react-native`** (**`yarn.lock`** may remain). **3.2** — [`full-release.js`](../../full-release.js) / [`dev-all.sh`](../../dev-all.sh) / **`peers-react-native`** scripts (see [Progress log](#progress-log) *Phase 3.2*). **3.3 (2026-04-22)** — npm-first docs pass. **3.4 (2026-04-22)** — [`link-deps.js`](../../link-deps.js) uses **direct relative symlinks** under **`node_modules/@peers-app/*`** for the npm path (npm ≥10 **`npm link`** silently re-installed the published tarball, producing **two** **`peers-sdk`** instances and breaking singletons like the in-memory tool registry). **3.5 (2026-04-22)** — **zod routed through `@peers-app/peers-sdk`**: **`peers-sdk`** re-exports **`z`** from its public surface; every consumer imports **`{ z }`** from **`@peers-app/peers-sdk`** instead of **`"zod"`** directly, which guarantees schemas are built with the same zod instance that **`fieldsToSchema`/`schemaToFields`** unpack; all packages aligned on **`zod@3.25.76`**. **Next:** **[Phase 4 — Webpack → esbuild](#phase-4--webpack--esbuild-except-react-native)**; optional **`peers-react-native`** **`yarn.lock` → `package-lock.json`**; submodule docs (e.g. **`peers-services/docs/download-links.md`**) if **`yarn`** examples remain.

### 2026-04-22 — Phase 3.5 — zod routed through `@peers-app/peers-sdk`

- **Author / agent:** Cursor agent
- **Submodules / root:** **peers-sdk**, **peers-electron**, **peers-ui**, **peers-device**, **peers-core**, **peers-pwa**, **peers-react-native**, **peers-package-template**; **peers-app root** — [`link-deps.js`](../../link-deps.js).
- **Symptom:** After bumping **`peers-electron`**'s `overrides.zod` to **`3.25.76`** in `f9ac4d4` (needed for the **`zod/v3`** subpath import pulled in by a transitive dep), **`peers-electron`**'s webpack began failing with **`TS2322: Types have separate declarations of a private property '_cached'`** on `ZodObject` and **`TS2739: missing "~standard", "~validate"`**. **`peers-device`** also failed typecheck with **`Cannot find module 'zod'`** because it relied on the yarn-era hoisting that npm + symlinks does not provide.
- **Root cause:** With per-package `node_modules` under npm + direct symlinks, each sibling's own **`node_modules/zod`** is a distinct on-disk install. **`peers-electron`** was on **`3.25.76`** while **`peers-sdk`** was still on **`3.23.8`**, so schemas built with one zod reached **`fieldsToSchema`/`schemaToFields`** in peers-sdk expecting the other's class shape. **`peers-device`**'s test/source files imported **`{ z } from "zod"`** without declaring zod as a dep.
- **Decision:** Make **`@peers-app/peers-sdk`** the single owner of zod in the dev graph, rather than duplicating the dep everywhere. This is the library pattern: the package that defines the schema contract owns the schema library.
- **Fix:**
  - **`peers-sdk/src/types/zod-types.ts`** adds **`export { z } from "zod"`** so consumers can **`import { z } from "@peers-app/peers-sdk"`**.
  - **`peers-sdk/package.json`** bumped **`zod: 3.23.8 → 3.25.76`**.
  - 13 consumer files rewrote **`from "zod"`** → **`from "@peers-app/peers-sdk"`** (4 **`peers-electron`**, 2 **`peers-ui`**, 7 **`peers-device`**). Two bootstrap files (**`peers-electron/src/client/index.tsx`**, **`peers-pwa/src/main.tsx`**) keep **`import * as zod from 'zod'`** because they intentionally expose **`window.zod`** for dynamically loaded package bundles declaring zod as **`external`**.
  - **`peers-core`/`peers-pwa`/`peers-react-native`/`peers-package-template`** package.json bumped **`zod → 3.25.76`**.
  - **`peers-electron/package.json`** gains an explicit **`"zod": "3.25.76"`** direct dep alongside the existing **`overrides.zod`** block (protects the `client/index.tsx` wildcard import).
  - **`peers-device`/`peers-ui`** carry no zod dep (they now reach it via **`@peers-app/peers-sdk`**).
  - [`link-deps.js`](../../link-deps.js) **`peers-core`** link set expanded from **`['@peers-app/peers-ui']`** → all three (**`peers-sdk`**, **`peers-device`**, **`peers-ui`**) so **`npm install`** no longer installs published tarballs for those two and types stay consistent.
  - **`peers-services`** intentionally left on its own **`zod@^4.3.6`** — its usage is an isolated Mongo collection schema that does not cross into peers-sdk.
- **Commits:** see submodule + root commits dated 2026-04-22 after this entry.
- **Validation:** `npm install` in every affected pkg; `node link-deps.js` (symlinks verified via `ls -la node_modules/@peers-app/`); `npm run build` in **`peers-sdk`** / **`peers-device`** / **`peers-ui`** / **`peers-core`** / **`peers-electron`** all clean; **`./dev-all.sh`** reports **`Found 0 errors`** on every watcher. User confirmed **`new-id`** workflow works end-to-end in the running Electron app.
- **Operational note (unchanged from 3.4):** **`npm install`** / **`npm ci`** re-installs published tarballs over symlinked **`@peers-app/*`** deps; re-run **`node link-deps.js`** from the repo root after any install in a linked consumer.
- **Next step:** **[Phase 4 — Webpack → esbuild](#phase-4--webpack--esbuild-except-react-native)**.

### 2026-04-22 — Phase 3.4 — `link-deps.js` direct symlinks (fix workflow tool regression)

- **Author / agent:** Cursor agent
- **Submodules / root:** **peers-app root** — [`link-deps.js`](../../link-deps.js); this roadmap
- **Symptom:** Running `new-id` in a workflow returned `Error: the module built from the tool code did not return a tool function.` Built-in tools with empty `tool.code` rely on the in-memory registry populated when **`peers-core`'s** bundle is evaluated and calls **`registerTool(...)`** from **`@peers-app/peers-sdk`**.
- **Root cause:** npm ≥10 **`npm link @peers-app/peers-sdk`** (and `peers-ui`) inside **`peers-electron`** silently wrote real directories (published tarballs) instead of symlinks; **`peers-device`** was symlinked and resolved **`peers-sdk`** from the live source tree. Result: two **`peers-sdk`** module instances at runtime, so **`registerTool`** wrote to one **`registeredToolInstances`** map and **`initTool`** read from another.
- **Fix:** [`link-deps.js`](../../link-deps.js) npm path now creates direct relative symlinks (e.g. `peers-electron/node_modules/@peers-app/peers-sdk -> ../../../peers-sdk`), matching how yarn-era linking worked and how **`peers-device`** was already linked.
- **Commits:** **peers-app root** — [`link-deps.js`](../../link-deps.js) + this roadmap (`git log -1 --oneline`)
- **Validation:** `node link-deps.js` twice (idempotent); `realpath peers-electron/node_modules/@peers-app/{peers-sdk,peers-ui,peers-device}` each resolve into the sibling repo. App restart + workflow **`new-id`** still pending manual verification.
- **Operational note:** **`npm install`** / **`npm ci`** will re-install the published tarball over any symlinked **`@peers-app/*`** dep; re-run **`node link-deps.js`** from the repo root after any install in a linked consumer.
- **Next step:** User restart of **`peers-electron`** and re-test workflow **`new-id`**; if green, resume **[Phase 4](#phase-4--webpack--esbuild-except-react-native)**.

### 2026-04-22 — Phase 3.3 — Documentation sweep (npm-first)

- **Author / agent:** Cursor agent
- **Submodules / root:** **peers-app root** — [`docs/release-workflow.md`](../release-workflow.md), [`docs/roadmap/ci-sibling-packages.md`](./ci-sibling-packages.md), [`docs/cli.md`](../cli.md), [`docs/context/cli-context.md`](../context/cli-context.md), [`docs/context/voice-production-builds.md`](../context/voice-production-builds.md); this roadmap
- **Changes:** Replaced **`yarn install` / `yarn.lock` / `yarn test` / `yarn build`** (etc.) with **`npm install`**, **`package-lock.json`**, **`npm test`**, **`npm run build`**, **`npm run release`** patterns; removed nonexistent **`yarn deploy`** in favor of **`npm run release:*`**; **`npm outdated`** / **`npm update`** (+ optional **`npm-check-updates`**); CI sibling example **`npm ci`**. **`release-workflow`:** note **`peers-react-native`** may still use Yarn until lockfile migration.
- **Commits:** **peers-app root** — this roadmap + files under **`docs/`** listed above (**`git log -1 --oneline`**)
- **Validation:** Manual review of edited markdown; no code paths changed.
- **Next step:** **[Phase 4](#phase-4--webpack--esbuild-except-react-native)**; optional RN **`package-lock.json`**; stray **`yarn`** in submodule **`docs/`** (e.g. **`peers-services`**) as follow-up.

### 2026-04-21 — Phase 3.2 — Root scripts: `full-release.js` unlink, `dev-all.sh` RN, react-native `npm run`

- **Author / agent:** Cursor agent
- **Submodules / root:** **peers-app root** — [`full-release.js`](../../full-release.js), [`dev-all.sh`](../../dev-all.sh); [`peers-react-native`](../../peers-react-native) — [`package.json`](../../peers-react-native/package.json), [`CLAUDE.md`](../../peers-react-native/CLAUDE.md); this roadmap
- **Changes:** **`unlinkPackage`:** Yarn **`yarn unlink`** unchanged; npm removes **`node_modules/<scope>/<name>`** so **`npm install --force`** can resolve published tarballs (avoids **`npm unlink`** mutating **`package.json`**). **`forceInstallDependencies`:** Yarn failure fallback uses **`npm install --force`** without deleting **`package-lock.json`**. **`dev-all.sh`:** RN webpack watch via **`npm run webpack -- --watch`**. **`peers-react-native`:** **`dev`** script **`yarn` → `npm run`** for **`sdk` / `device` / `ui` / `webpack`**; **`CLAUDE.md`** **`npm run dev`**.
- **Commits:** `peers-react-native` @ `48268e0`; **peers-app root** — submodule pointer + [`full-release.js`](../../full-release.js) / [`dev-all.sh`](../../dev-all.sh) / this doc (**`git log -1 --oneline`** on **peers-app** root)
- **Validation:** **`node --check full-release.js`** — **pass**. **`update-and-build.sh`** / **`update-deps.js`** — reviewed only (**`getPackageManager()`** pattern already correct).
- **Next step:** Superseded by **[Phase 3.3](#33-documentation-sweep)** (done **2026-04-22**).

### 2026-04-21 — Phase 3.1 follow-ups: peers-core `openai`, peers-electron `zod` (`zod/v3`)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-core`](../../peers-core) [`package.json`](../../peers-core/package.json); [`peers-electron`](../../peers-electron) [`package.json`](../../peers-electron/package.json), [`.npmrc`](../../peers-electron/.npmrc); **peers-app root** — submodule pointers
- **Changes:** **`peers-core`:** add **`openai`** devDependency — **`src/frames/pipeline/__tests__`** imports **`openai`**; **`ts-loader`** typechecks full **`src/**/*`**, so **`build:uis`** / **`dev:uis`** failed without the package. **`peers-electron`:** npm **`overrides`** was **`zod@3.23.8`** (single **`Zod`** type for **`tsc`**) but **`3.23.8`** does not export **`./v3`** → runtime **`ERR_PACKAGE_PATH_NOT_EXPORTED`** for **`zod/v3`** (e.g. LangChain). Bumped override to **`zod@3.25.76`**; verified **`require('zod/v3')`** and **`npm run build:server`**.
- **Commits:** `peers-core` @ `053c9ae`; `peers-electron` @ `f9ac4d4`; **peers-app root** @ `acda071`, `f80db92` (submodule bumps)
- **Validation:** **`peers-core`:** **`npm run build:uis`** — **pass**. **`peers-electron`:** **`npm run build:server`**, **`node -e "require('zod/v3')"`** — **pass**; **`npm start`** / app load — **pass** (manual).
- **Next step:** **[Phase 3.2](#32-root-and-cross-cutting-scripts)** / **[3.3](#33-documentation-sweep)** per priority.

### 2026-04-21 — Phase 3.1 — peers-services, peers-pwa, peers-electron: Yarn → npm

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-services`](../../peers-services), [`peers-pwa`](../../peers-pwa), [`peers-electron`](../../peers-electron) — **`package-lock.json`**, **`yarn.lock`** removed; **peers-app root** — [`link-deps.js`](../../link-deps.js), [`dev-all.sh`](../../dev-all.sh), this doc, [`monorepo-structure.mdc`](../../.cursor/rules/monorepo-structure.mdc)
- **Changes:** **`peers-services`:** **`npm run`** in **`docker:restart`** / **`link-deps`** (**`npm link`**); workflows **`npm ci`**. **`peers-pwa`:** **`npm run`** for **`dev` / `build` / `release`**; **`CLAUDE.md`**. **`peers-electron`:** all scripts **`npm run`** / **`npx`**; removed duplicate **`postinstall`** key; **`.npmrc`** **`legacy-peer-deps=true`** (React 18 vs **`react-split-pane`**); **`overrides`** **`zod`** (initially **`3.23.8`** for **`tsc`** — superseded by **`3.25.76`** in *2026-04-21 — follow-ups* for **`zod/v3`**); CI uses **`npm ci`**, sibling checkouts **`npm run build`**. **`link-deps.js`:** **`npm link`** when no **`yarn.lock`**. **`dev-all.sh`:** Electron uses **`npx`** instead of **`yarn`**.
- **Commits:** `peers-services` @ `d38bfa5`; `peers-pwa` @ `d53f61e`; `peers-electron` @ `f8db671` (superseded by **`f9ac4d4`** — see follow-up entry); **peers-app root** — see this commit
- **Validation:** **`peers-services`:** **`npm ci`**, **`npm run lint`**, **`npm run build`** — **pass**. **`peers-pwa`:** **`npm ci`**, **`npm run typecheck`** — **pass** (**`npm run lint`** has pre-existing Biome **errors**). **`peers-electron`:** **`npm ci`**, **`npm run build:server`** — **pass** (full **`npm run lint`** still noisy).
- **Decisions / exceptions:** **`full-release.js`** **`yarn unlink`** only for **`yarn.lock`** repos — completed in **Phase 3.2** (see Progress log). **`peers-react-native`** still had **`yarn`** in **`dev`** until **Phase 3.2** script edits.

### 2026-04-20 — Phase 3.1 — peers-ui + peers-device: Yarn → npm (registerable trio complete)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`package.json`](../../peers-ui/package.json), [`package-lock.json`](../../peers-ui/package-lock.json), [`.github/workflows/publish.yml`](../../peers-ui/.github/workflows/publish.yml), removed **`yarn.lock`**; [`peers-device`](../../peers-device) — [`package.json`](../../peers-device/package.json) (already had **`package-lock.json`**; no **`yarn.lock`** in repo); **peers-app root** — this doc + submodule pointers
- **Changes:** **`peers-ui`:** same pattern as **`peers-sdk`** — **`npm run`** scripts, **`npm ci`** publish workflow, committed lockfile. **`peers-device`:** replaced **`yarn`** invocations in **`build`** / **`release:*`** with **`npm run`** so local scripts match **npm** (publish workflow was already **npm**).
- **Commits:** `peers-ui` @ `e7c745f`; `peers-device` @ `0250002`; **peers-app root** — see this commit
- **Validation:** **`peers-ui`:** **`rm -rf node_modules && npm ci && npm run lint && npm run build && CI=1 npm test`** — **pass**. **`peers-device`:** **`npm ci && npm run build && CI=1 npm test`** — **pass**; **`npm run lint`** — **fails** (pre-existing full-tree Biome **errors**, unchanged by this work).
- **Decisions / exceptions:** All three **link-deps**-registerable packages (**`peers-sdk`**, **`peers-device`**, **`peers-ui`**) now use **`package-lock.json`** — unblocks **[Phase 3.2 — `npm link`](#32-root-and-cross-cutting-scripts)** in **`link-deps.js`** when ready.
- **Next step:** **[Phase 3.1](#31-order-of-migration)** — **`peers-electron`**, **`peers-services`**, **`peers-pwa`**; or **[Phase 3.2](#32-root-and-cross-cutting-scripts)** (**`link-deps`**, **`dev-all`**, **`full-release`**) now that the trio is on **npm**.

### 2026-04-20 — Phase 3.1 — peers-sdk: Yarn → npm

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-sdk`](../../peers-sdk) — [`package.json`](../../peers-sdk/package.json), [`package-lock.json`](../../peers-sdk/package-lock.json), [`.github/workflows/publish.yml`](../../peers-sdk/.github/workflows/publish.yml); **peers-app root** — this doc + submodule pointer
- **Changes:** Removed **`yarn.lock`**; **`npm install`** → committed **`package-lock.json`**. Replaced **`yarn`** in scripts (**`build`**, **`release:*`**, **`release`**) with **`npm run`**; fixed **`release:major`** (**`git push --tags`**). Publish workflow: **`cache: npm`**, **`npm ci`**, **`npm run lint`**, **`npm test`**, **`npm run build`**. **[`link-deps.js`](../../link-deps.js)** / **[`full-release.js`](../../full-release.js)** already pick **npm** when **`yarn.lock`** is absent (**`getPackageManager()`**).
- **Commits:** `peers-sdk` @ `d45291e`; **peers-app root** — see this commit
- **Validation:** **`rm -rf node_modules && npm ci && npm run lint && npm run build && CI=1 npm test`** in **`peers-sdk`** — **pass** (lint exits **0** with existing Biome **warnings**).
- **Decisions / exceptions:** **`link-deps.js`** still uses **`yarn link`** for registration (unchanged — [Phase 3.2](#32-root-and-cross-cutting-scripts)); **`update-and-build.sh`** will use **npm** for **`peers-sdk`** automatically.
- **Next step:** **[Phase 3.1](#31-order-of-migration)** — migrate **`peers-ui`** and/or **`peers-device`** (**`yarn.lock` → `package-lock.json`**).

### 2026-04-20 — Phase 2.3 follow-up — message compose + Biome `useExhaustiveDependencies`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`channel-message-list.tsx`](../../peers-ui/src/components/messages/channel-message-list.tsx), [`thread-message-list.tsx`](../../peers-ui/src/components/messages/thread-message-list.tsx), [`markdown-editor/editor.tsx`](../../peers-ui/src/components/markdown-editor/editor.tsx), [`hooks.ts`](../../peers-ui/src/hooks.ts), [`lazy-list.tsx`](../../peers-ui/src/components/lazy-list.tsx), [`console-logs-list.tsx`](../../peers-ui/src/screens/console-logs/console-logs-list.tsx); [`peers-core`](../../peers-core) — [`biome.json`](../../peers-core/biome.json); [`peers-services`](../../peers-services) — [`biome.json`](../../peers-services/biome.json); **peers-app root** — [`biome.json`](../../biome.json), this doc
- **Changes:** Restored **shared-ref `effects`** initialization in channel/thread message lists (Biome paydown had spread-cloned `props.effects`, breaking **`pushMessage`** and **`sendMessage`**). **`OnKeyDownPlugin`:** keep **`useEffect`** deps **`[editor]`** only — documented why (stable **`effects`** ref + imperative **`onKeyDown`**); avoids Lexical **`KEY_DOWN_COMMAND`** churn. **Repo-wide:** disabled Biome **`useExhaustiveDependencies`** in root + **`peers-services`**; removed redundant **`peers-core`** override for **`use-lazy-sections.ts`**. Dropped stale **`biome-ignore`** comments that only suppressed that rule.
- **Commits:** `peers-ui` @ `865ab82`; `peers-core` @ `5d4f36c`; `peers-services` @ `a60740f`; **peers-app root** @ `f1f7608` (submodule pointers + root `biome.json`)
- **Validation:** **`yarn lint`**, **`yarn build`** in **`peers-ui`** — **pass** (Biome **0** warnings).
- **Decisions / exceptions:** **`useExhaustiveDependencies`** off by policy (stable-object / imperative patterns); **not** “we don’t care about hook correctness” — manual review of **`--write`** diffs on hook files remains ([§2.3 guardrail](#23-pay-down-debt)).
- **Next step:** **[Phase 3 — npm](#phase-3--standardize-on-npm)** — **`peers-sdk`** first (**`yarn.lock` → `package-lock.json`**).

### 2026-04-20 — Phase 2.3 — peers-services: Biome debt paydown (CI green)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-services`](../../peers-services) — [`biome.json`](../../peers-services/biome.json), all 17 `src/*.ts` files, 3 `load-test/*.ts` files, [`scripts/update-app-urls.js`](../../peers-services/scripts/update-app-urls.js); **peers-app root** — this doc + submodule pointer
- **Changes:** Rewrote `biome.json` as a standalone config (dropped `extends: "//"`) with `files.includes` scoped to `src/**`, `load-test/**`, `scripts/**` so vendor bundles in `public/` (Vite build output, jQuery, Bootstrap, peers-core webpack bundles), YAML manifests, and Terraform configs are no longer linted — surface dropped from ~9846 errors / ~11171 warnings over 49 files to **38 errors / 91 warnings over 24 files**. Ran **`npx biome check --write --unsafe`** across the owned tree (formatter + safe lint fixes: `node:` import prefix, type-only imports, enum string-key cleanup, template literals, removed redundant try/catch, etc.). Hand-fixed the 7 residual errors the unsafe fix introduced or couldn't auto-repair: restored typed cast in `mongo-collection.isIndexSpecification` (biome over-weakened `as any` → `as never`), restored non-null assertion in `db-server.exec` with targeted `biome-ignore` (optional-chain had broken return type), blocked single-expression arrows in `data/db.ts` / `connection-server.ts` / `scripts/update-app-urls.js` (3× `noAssignInExpressions`), replaced `new Promise(async (resolve, reject) => …)` in `db-server.openDb` with an IIFE (`noAsyncPromiseExecutor`), typed the `_unusedToken` implicit-any `let`, removed a redundant `let cursor;` pattern and converted a `forEach` side-effect callback to a block body.
- **Commits:** `peers-services` @ `207ba2f`; **peers-app root** — see this commit
- **Validation:** **`npm run lint`** in `peers-services` — **exit 0** (**0 errors, 41 warnings**); **`npm run build`** (tsc) — **pass**. CI run pending (push triggered new GHA run on `peers-app/peers-services`).
- **Decisions / exceptions:** 41 warnings left untouched — mostly `noExplicitAny` / `noNonNullAssertion` / `noBannedTypes` (`Object`) / 3× `noBannedTypes` in the unused `src/data/db.ts` legacy Mongo wrapper. None block CI (`biome check` exits 0 on warnings). Kept `src/data/db.ts` even though nothing imports it — removal is a separate decision. `biome-ignore` on `db-server.exec` is scoped and documented.
- **Next step:** **[Phase 3 — npm](#phase-3--standardize-on-npm)** (`peers-sdk` first, `yarn.lock` → `package-lock.json`).

### 2026-04-20 — Extract `peers-services/k8s` → `peers-k8s` submodule

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-services`](../../peers-services) — removed `k8s/` (38 tracked files: Terraform, scripts, user-deployment templates, base `deployment.yaml` / `service.yaml`, nested `peers-app/` Dockerized TS service); new [`peers-k8s`](../../peers-k8s) repo created at `https://github.com/peers-app/peers-k8s` via `git-filter-repo --subdirectory-filter k8s` (history preserved); **peers-app root** — `.gitmodules` + new `peers-k8s` submodule pointer + submodule pointer update for `peers-services`
- **Changes:** `k8s/` was never referenced outside itself (prod deploy is `azure/webapps-deploy@v3`, not AKS). Removing it also eliminates the nested `k8s/peers-app/biome.json` sub-package (extends `../../biome.json`), which was contributing a sizable share of the 9868-error `peers-services` Biome surface. Monorepo-structure rule updated with new `peers-k8s` row.
- **Commits:** `peers-services` @ `8dfce3f`; `peers-k8s` @ `d4b5711`; **peers-app root** — see this commit
- **Validation:** `git ls-files k8s` in `peers-services` post-rm returns empty; GH push to `peers-app/peers-k8s` succeeds; root `git submodule status` includes `peers-k8s`. Fresh CI run on `peers-services` to rerun still pending.
- **Decisions / exceptions:** Inner `peers-k8s/peers-app/biome.json` still has `"extends": ["../../biome.json"]` (dangling in standalone), but no CI or script invokes Biome in that tree so it's non-blocking — follow-up cleanup when/if `peers-k8s` gets its own lint/build.
- **Next step:** Decide whether to pay down `peers-services` Biome now (`lint:fix` + residue) or temporarily drop `npm run lint` from `.github/workflows/main_peers-services.yml` until paydown is scheduled.

### 2026-04-20 — Phase 2.3 — peers-ui: Biome warning paydown (remaining `src/components/` warnings)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`checkbox.tsx`](../../peers-ui/src/components/checkbox.tsx), [`input.tsx`](../../peers-ui/src/components/input.tsx), [`input-number.tsx`](../../peers-ui/src/components/input-number.tsx), [`save-button.tsx`](../../peers-ui/src/components/save-button.tsx), [`sortable-list.tsx`](../../peers-ui/src/components/sortable-list.tsx), [`markdown-editor/`](../../peers-ui/src/components/markdown-editor/) (`editor.tsx`, `markdown-plugin.tsx`, `mention-node.ts`), [`message-logs/message-logs.tsx`](../../peers-ui/src/components/message-logs/message-logs.tsx), [`messages/`](../../peers-ui/src/components/messages/) (`channel-message-list.tsx`, `thread-message-list.tsx`, `message-display.tsx`); **peers-app root** — this doc + submodule pointer
- **Changes:** Replaced **`noExplicitAny`** in form controls with **`Omit<…>`** + **`Observable<… | undefined>`** unions; **`sortable-list`** typed **`T`**, **`void`** callbacks, **`Record<string, unknown>`**, guards for **`Sortable`** indices / missing root element; **`save-button`**: targeted **`biome-ignore`** on **`IDoc<any>`** (call sites stay strongly typed per table); markdown: structural types for transformers, **`kind`** as string, **`AutoLinkNode`** ignore with comment, Lexical **`KeyboardEvent`** bridged via **`unknown`** cast; message lists / logs: removed **`!`** assertions; **`replyCount`** for **`usePromise`** count.
- **Commits:** `peers-ui` @ `24df7f9`; **peers-app root** — submodule pointer + this doc (same change-set as `peers-ui` tip above)
- **Validation:** **`yarn build`**, **`CI=1 yarn test`**, **`yarn lint`** in **`peers-ui`** — **pass** (**`biome check .`**: **0 warnings**)
- **Decisions / exceptions:** **`IDoc<any>`** retained on **`SaveButton`** with **`biome-ignore`** — **`IDoc<Record<string, unknown>>`** broke **`IDoc<T>`** variance at call sites; **`AutoLinkNode as any`** kept with **`biome-ignore`** (Lexical node registry typing).
- **Next step:** **[Phase 3.1 — npm](../../peers-sdk)** (`yarn.lock` → **`package-lock.json`**) or other roadmap priority.

### 2026-04-19 — Phase 2.3 — peers-ui: Biome warning paydown (`src/components/` slice)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`voice-subscribe-events.ts`](../../peers-ui/src/components/voice-subscribe-events.ts), [`chat-overlay.tsx`](../../peers-ui/src/components/chat-overlay.tsx), [`voice-indicator.tsx`](../../peers-ui/src/components/voice-indicator.tsx), [`group-switcher.tsx`](../../peers-ui/src/components/group-switcher.tsx), [`typeahead.tsx`](../../peers-ui/src/components/typeahead.tsx), [`lazy-list.tsx`](../../peers-ui/src/components/lazy-list.tsx), [`inverse-lazy-list.tsx`](../../peers-ui/src/components/inverse-lazy-list.tsx), [`list-screen.tsx`](../../peers-ui/src/components/list-screen.tsx), [`io-schema-values.tsx`](../../peers-ui/src/components/io-schema-values.tsx), [`markdown-with-mentions.tsx`](../../peers-ui/src/components/markdown-with-mentions.tsx), [`markdown-editor/toolbar.tsx`](../../peers-ui/src/components/markdown-editor/toolbar.tsx), [`messages/`](../../peers-ui/src/components/messages/) (compose, channel + thread lists, channel-view, avatar, message-display), [`ui-defaults/list-screen.tsx`](../../peers-ui/src/ui-defaults/list-screen.tsx); **peers-app root** — submodule pointer
- **Changes:** Typed `subscribe` voice/chat payloads; `unknown` error handling; `void` / narrower callback types; `Record<string, unknown>` where safe; `chat:openWithMessage` sets string draft text from `IMessage.message`; `biome-ignore` on one heterogeneous IO `observable`; full-tree **`yarn lint`** warnings **~74 → ~30**.
- **Commits:** `peers-ui` @ `0f160d0`; **peers-app root** @ `4ea1bed`
- **Validation:** **`yarn build`**, **`CI=1 yarn test`**, **`yarn lint`** — **pass** in **`peers-ui`** (lint exit **0**, **30** warnings)
- **Decisions / exceptions:** One intentional **`biome-ignore`** for dynamic IO schema **`observable`** typing.
- **Next step:** Remaining **`peers-ui`** warnings (mostly **`input` / `checkbox` / `sortable-list`**, etc.) or **Phase 3** npm (`peers-sdk` first).

### 2026-04-19 — Prerequisite: dead legacy UI removal (pre-tabs layout)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — removed **`left-bar`**, **`top-bar`**, **`off-canvas`**, **`main-content-container`**, **`messages/thread-view`**, orphan **`typeahead/`** folder, **`lazy-sortable-list`**, **`input-datetime`**, **`screens/profile`**, mis-scaffolded **`text-list-editor.tsx/`**; dropped **`react-split-pane`**; removed **`openThreads` / `threadViewOpen`** from [`globals.tsx`](../../peers-ui/src/globals.tsx); [`peers-electron`](../../peers-electron) / [`peers-react-native`](../../peers-react-native) / [`peers-services`](../../peers-services) — stripped unused **`.peers-*-bar` / thread-view / Resizer** CSS from bundled styles; **peers-app root** — submodule pointer(s)
- **Changes:** Tabs-only top level confirmed (`TabsLayoutApp`); no remaining imports of deleted modules; optional empty **`screens/`** dirs removed with orphans.
- **Commits:** `peers-ui` @ `af26a23`; `peers-electron` @ `0071a04`; `peers-react-native` @ `08b0ecd`; `peers-services` @ `221b81a`; **peers-app root** @ `d57b445`
- **Validation:** **`yarn build`**, **`CI=1 yarn test`**, **`yarn lint`** in **`peers-ui`** — **pass** (warnings higher count before later paydown commit)
- **Decisions / exceptions:** **`peers-react-native`** **`web.bundle.js.txt`** not committed with CSS-only shell change (unrelated bundle drift).
- **Next step:** Superseded by Biome paydown entry above; same **Resume** fork (**Phase 2.3** vs **Phase 3**).

### 2026-04-19 — peers-ui: validation fixes + manual smoke-test (screens)

- **Author / agent:** Cursor agent + manual verification (Mark)
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`lazy-list.tsx`](../../peers-ui/src/components/lazy-list.tsx), [`tabs-state.ts`](../../peers-ui/src/tabs-layout/tabs-state.ts), [`global-search.tsx`](../../peers-ui/src/screens/search/global-search.tsx), [`console-logs-list.tsx`](../../peers-ui/src/screens/console-logs/console-logs-list.tsx), [`contact-list.tsx`](../../peers-ui/src/screens/contacts/contact-list.tsx), [`group-list.tsx`](../../peers-ui/src/screens/groups/group-list.tsx), [`index.tsx`](../../peers-ui/src/index.tsx) (MarkdownEditor exports); **peers-app root** — submodule pointer(s)
- **Changes:**
  - **`LazyList`:** `resetTrigger` clears items; effect order (reset before preload); generation counter to drop stale in-flight `loadMore`; **`contacts` / `groups`** dedupe within cursor batch.
  - **`goToTabPath`:** immutable tab path when no app matches + **`_mainContentPath`** sync (fixes Search result navigation + **`TabContentRenderer`** **`React.memo`**).
  - **`GlobalSearch`:** user hits → **`contacts/:userId`** (not **`profile`**) so **`determineAppFromPath`** opens a new tab like other entities.
  - **`ConsoleLogsList`:** **`searchQuery = searchText()`** in hook deps (stable observable ref had blocked message filter refresh).
  - Earlier: **`index.tsx`** explicit **`MarkdownEditor`** / **`IEditorEffects`** exports for **`peers-core`** webpack; console-logs column-width effect guard.
- **Commits:** `peers-ui` @ `5bb3546` (tip; includes `c939c71`, `c11b865`, `edf09ca`, …); **peers-app root** @ `60f50f0` (submodule bump)
- **Validation:** **`yarn build`**, **`yarn lint`** (**`biome check .`**) — **pass** in **`peers-ui`**; **manual smoke-test:** Contacts, Groups, Global Search, Console logs, Data Explorer, Network Viewer, Packages, Assistants, Tools, Variables, Peer types, Join group, Workflows, Profile — **no regressions reported**
- **Decisions / exceptions:** None blocking; warning paydown outside **`src/screens/`** still optional.
- **Next step:** **`peers-ui`** warnings outside **`src/screens/`** or **[Phase 3 — npm](#phase-3--standardize-on-npm)** (`peers-sdk` first).

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui remaining `src/screens/` (all slices)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — **`biome.json`**; **`src/screens/`** (contacts, join-group, peer-types, variables, search, assistants, groups, data-explorer, console-logs, tools, network-viewer + **`network-viewer-ipc.ts`**, profile/welcome-modal/setup-user); **peers-app root** — this doc + submodule pointer (follows)
- **Changes:** Scoped **`npx biome check --write --unsafe`** per chunk; **`biome.json`** overrides for screen folders + **`network-viewer`** **`noSvgWithoutTitle`**; **`useCallback`** / **`useRef`** for cursors, **`loadData`**, **`getAllApps`**, **`runDiagnostics`**, **`loadTables`**; typed Electron IPC via **`getNetworkViewerApi()`**; **`unknown`** catches; **`console-logs-list`** filter-reset effect **`biome-ignore`** (observable setter); **`global-search`** static **`searchConfigs`**
- **Commits:** `peers-ui` @ `efc497d`
- **Validation:** per chunk: scoped **`npx biome check`**, **`yarn build`**, **`CI=1 yarn test`** — **pass**; full **`yarn lint`** — **exit 0** (**82** warnings repo-wide, **0** errors)
- **Decisions / exceptions:** **`yarn lint`** warnings remain mostly in **`src/components/`** (pre-existing **`any`** on input/observable helpers) — not blocking error exit; optional follow-up. **`isDesktop()`** used consistently in **`network-viewer`** where desktop gate is required.
- **Next step:** **`peers-ui`** warning paydown outside **`src/screens/`** or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/screens/packages/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/screens/packages/`](../../peers-ui/src/screens/packages/) (6 files), [`biome.json`](../../peers-ui/biome.json); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on **`packages/`** (format, **`import type`**, templates, **`@ts-expect-error`** for Electron folder input).
  - **`biome.json`:** override **`src/screens/packages/**/*`** — same **a11y** bundle + **`noArrayIndexKey`** **off** as **`settings/`** / **`workflows/`** (Bootstrap dropdowns, link buttons).
  - **`package-list.tsx`:** **`useCallback`** for **`newCursor`** with deps **`searchText`**, **`cursorObs`**; mount effect **`void newCursor()`**; **`catch (err: unknown)`** with **`Error`** / **`String`** narrowing.
  - **`package-info.tsx`:** **`remoteRepoUrl`** local for **`openLinkInBrowser`** (no **`!`**; satisfies **`noNonNullAssertion`**).
- **Commits:** `peers-ui` @ `26ef6d2`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/screens/packages/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/screens/contacts/`**, **`assistants/`**, **`tools/`**, etc., or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/screens/workflows/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/screens/workflows/`](../../peers-ui/src/screens/workflows/) (4 files), [`biome.json`](../../peers-ui/biome.json); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on **`workflows/`**.
  - **`biome.json`:** override **`src/screens/workflows/**/*`** — same **a11y** bundle + **`noArrayIndexKey`** **off** as **`settings/`** (instruction list keys, toolbar buttons).
  - **`workflow-list.tsx`:** **`useCallback`** for **`newCursor`** with deps **`searchText`**, **`cursorObs`**, **`cursorId`**; mount effect calls **`void newCursor()`** (fixes **`useExhaustiveDependencies`** on unstable inline async function).
- **Commits:** `peers-ui` @ `1b9b5f9`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/screens/workflows/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/screens/packages/`**, **`contacts/`**, **`assistants/`**, etc., or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/screens/settings/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/screens/settings/`](../../peers-ui/src/screens/settings/) (9 files), [`biome.json`](../../peers-ui/biome.json); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on **`settings/`** (format, quotes, import style).
  - **`biome.json`:** override **`src/screens/settings/**/*`** — same **a11y** bundle as **`src/components`** (Bootstrap labels/dropdowns/spinners); **`noArrayIndexKey`** **off** (dry-run warning list + audio device labels).
  - **`settings-page.tsx`:** **`FileWithElectronPath`**, **`PeersHostWindow`** replace **`any`** for Electron **`File.path`** and host globals.
- **Commits:** `peers-ui` @ `e93336f`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/screens/settings/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — another **`src/screens/`** folder (e.g. **`workflows/`**, **`packages/`**, **`contacts/`**), or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `utils` + `mention-configs` + `index`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/utils.ts`](../../peers-ui/src/utils.ts), [`src/mention-configs.ts`](../../peers-ui/src/mention-configs.ts), [`src/index.tsx`](../../peers-ui/src/index.tsx), [`biome.json`](../../peers-ui/biome.json); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`utils.ts`:** Biome **`--write`** (quotes, templates, **`const`** **`doc`**, **`substr`** path left as-is); **`Object.hasOwn`** instead of **`hasOwnProperty`**; second **`nObj`** renamed **`outObj`** (**`noRedeclare`**); removed stale **`@ts-expect-error`** on **`replaceAll`** (TS 5.8).
  - **`biome.json`:** override **`src/utils.ts`** — **`noExplicitAny`** + **`noInnerDeclarations`** **off** (legacy **`toJSON`** / **`fromJSON`** / dynamic **`js`** helpers).
  - **`mention-configs.ts`:** **`import type`** **`IMentionData`**, formatting.
  - **`index.tsx`:** organize exports (Biome).
- **Commits:** `peers-ui` @ `3fe518e`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/utils.ts src/mention-configs.ts src/index.tsx biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/screens/`** subdirectory (e.g. **`settings/`**, **`workflows/`**), or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `globals` + `hooks`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/globals.tsx`](../../peers-ui/src/globals.tsx), [`src/hooks.ts`](../../peers-ui/src/hooks.ts), [`src/hooks.test.tsx`](../../peers-ui/src/hooks.test.tsx); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`globals`:** **`type`** imports from SDK, template literal for query URL, **`const`** **`threadId`**, **`_ev`** on resize, **`@ts-expect-error`** for **`window.globals`**, Biome format/organize imports.
  - **`hooks`:** **`import type`** **`React`**; **`usePromise`** uses **`[...deps]`** + **`biome-ignore`** (caller-controlled deps + **`p`**); **`useObservableState`** conditional **`useObservable`** — **`biome-ignore`** (**`useHookAtTopLevel`**); **`useSubscription`** merged into **one** **`useEffect`** (**`onChange`:** **`void`**); **`useOnScreen`** builds **`IntersectionObserver`** inside effect, **`RefObject<Element | null>`**, **`biome-ignore`** for mount-only **`ref.current`** read (reverts unsafe Biome autofix that put **`observer.observe`** / **`ref.current`** in the dependency array).
  - **`hooks.test`:** **`type="button"`**, **`setValue("new-value" as T)`**, format.
- **Commits:** `peers-ui` @ `68dca39`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/globals.tsx src/hooks.ts src/hooks.test.tsx biome.json`** **pass** (**0** errors); **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/screens/`** in chunks, or root **`utils.ts`** / **`mention-configs.ts`** / **`index.tsx`**; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/components/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/components/`](../../peers-ui/src/components/) (full tree), [`biome.json`](../../peers-ui/biome.json) (**`a11y`** overrides for **`src/components/**/*`** aligned with **peers-core** UI bundles), [`tsconfig.json`](../../peers-ui/tsconfig.json) (**`jsx`:** **`react-jsx`**); [`workflow-instructions.tsx`](../../peers-ui/src/screens/workflows/workflow-instructions.tsx) (Lexical **`onKeyDown`** return); **peers-app root** — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on **`src/components/`**; **`biome.json`:** **`useAriaPropsForRole`** + **Bootstrap-style** **`a11y`** off for **`src/components/**/*.tsx`** / **`.ts`**.
  - **Hooks / correctness:** **`Router`** **`useObservable`** before **`try`**; **`chat-overlay`** **`scrollToBottom`** **`useCallback`** + stable message-load effect; **`useCallback`** for **`loadMore`** / **`prependItems`** / **`loadMessages`** / **`refreshLogCount`** / **`setSimpleInputSchema`** / **`updateSchemaFields`** where **`useExhaustiveDependencies`** complained; **`for…of`** instead of **`forEach`** return; **mention** menu **`key`**s; **`tabs`** / **toolbar** keys; **`markdown-with-mentions`** while-loop without assign-in-condition; **`io-schema`** **`for`** + subscription cleanup; **`sortable-list`** state type (**`Record<string, never>`**); **`isMobile`** **`window.opera`** typing.
- **Commits:** `peers-ui` @ `debbc91`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/components/ biome.json`** **pass** (**0** errors, **82** warnings); **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/globals.tsx`** / **`hooks.ts`** or remaining **`src/`** subtrees; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/ui-router/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/ui-router/`](../../peers-ui/src/ui-router/) (`routes-loader.ts`, `ui-loader.tsx`), [`biome.json`](../../peers-ui/biome.json); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`**; **`routes-loader`:** **`RoutesBundleWindow`**, **`Promise<unknown>`**; **`ui-loader`:** **`loadUIBundle`** via async IIFE (**`noAsyncPromiseExecutor`**), **`PeersUiBundleWindow`** / **`PeersRuntimeWindow`**, **`Record<string, unknown>`** for routed props, **`registerInternalPeersUI`** **`component: IPeersUI['content']`**, **`propsSchema`** documented **`any`** (duplicate **zod** resolutions).
  - **`type="button"`** on error/retry UI; **`biome.json`:** **`useHookAtTopLevel`** off for **`ui-loader.tsx`** (**`UILoader`** invoked from **`UIRouter`** — existing pattern).
- **Commits:** `peers-ui` @ `95f530b`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/ui-router/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — **`src/components/`** in subfolders or **`src/globals.tsx`** / **`hooks.ts`**; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/tabs-layout/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/tabs-layout/`](../../peers-ui/src/tabs-layout/) (`tabs-layout.tsx`, `tabs-state.ts`), [`biome.json`](../../peers-ui/biome.json) (**`overrides`** for **`src/tabs-layout/**/*.tsx`** a11y); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`**; **`handleMainPathChanged`** **`setNewMainPath`** typed **`void`**; **`determineAppFromPath`** / **`AppLauncherTab`** **`flatMap`** use explicit **`navs`** guard (**`AppInfo[]`** / **`AppItem[]`**).
  - **`type="button"`** on toolbar / launcher buttons; **`noAssignInExpressions`** fix on tab close hover handlers; RN bridge uses **`Window & { __NATIVE_THEME?, ReactNativeWebView? }`** (no **`any`**).
  - **`biome.json`:** a11y off for tabs (**Bootstrap** dropdown / tab strip patterns, spinner **`role="status"`**).
- **Commits:** `peers-ui` @ `69ac3af`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/tabs-layout/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — e.g. **`src/ui-router/`** or **`src/components/`** in chunks; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/command-palette/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/command-palette/`](../../peers-ui/src/command-palette/), [`biome.json`](../../peers-ui/biome.json) (**`overrides`** for **`src/command-palette/**/*.tsx`** a11y); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`**; **`for`** loop for **`coreCommands`** registration (**`useIterableCallbackReturn`**); **`useCallback`** for **`createNewThreadFromQuery`** (fixes **`useExhaustiveDependencies`**).
  - **`getAllApps`:** explicit **`navs`** guard so **`flatMap`** is **`AppSearchItem[]`** (TS).
  - **`biome.json`:** **`noStaticElementInteractions`** / **`useKeyWithClickEvents`** off for command-palette overlay (aligned with **`peers-core`** task UI pattern).
- **Commits:** `peers-ui` @ `b31b133`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/command-palette/ biome.json`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — e.g. **`src/tabs-layout/`** or root **`utils.ts`** / **`hooks.ts`** cluster; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/ui-defaults/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/ui-defaults/`](../../peers-ui/src/ui-defaults/) (3 files); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`**; **`renderItem`** uses inferred row type (drops **`Record<string, any>`**).
  - **`tsconfig`** uses **`"jsx": "react"`** — restored **`import React`** where Biome dropped it; **`biome-ignore lint/correctness/noUnusedImports`** on those imports (Biome does not treat classic JSX as using **`React`**).
- **Commits:** `peers-ui` @ `9c70e94`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/ui-defaults/`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Next step:** Phase **2.3** — e.g. **`src/command-palette/`** or **`src/tabs-layout/`**; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui `src/system-apps/`

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`src/system-apps/`](../../peers-ui/src/system-apps/) (17 files); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on the directory (mostly quote/format; **`isReactNative()`** uses **`Window & { __NATIVE_THEME?: unknown }`** instead of **`any`**).
- **Commits:** `peers-ui` @ `284c551`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check src/system-apps/`** **pass**; **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** still **fails**.
- **Decisions / exceptions:** No **`useEffect`** in this slice; **`index.ts`** barrel is re-export + value imports (review if future **`organizeImports`** touches load order — low risk for ESM/tsc).
- **Next step:** Phase **2.3** — another **`peers-ui`** subtree under **`src/`** (e.g. **`ui-defaults/`**, **`command-palette/`**, root **`utils.ts`** / **`hooks.ts`** cluster) or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-ui config + Jest setup

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-ui`](../../peers-ui) — [`tsconfig.json`](../../peers-ui/tsconfig.json), [`jest.config.js`](../../peers-ui/jest.config.js), [`babel.config.js`](../../peers-ui/babel.config.js), [`src/setupTests.ts`](../../peers-ui/src/setupTests.ts); peers-app root — submodule pointer + this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on the four files: formatter (JSON/JS/TS), **`node:util`** import, remove useless mock **`constructor`** bodies, typed **`IntersectionObserver`** / **`ResizeObserver`** globals (no **`any`**).
- **Commits:** `peers-ui` @ `5c8293b`; **peers-app root** — submodule pointer + this doc
- **Validation:** **`npx biome check`** on those four files **pass** (0 errors); **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (1 suite, 17 tests). Full-tree **`yarn lint`** in **peers-ui** still **fails** — expected until more **`src/`** slices.
- **Decisions / exceptions:** Config-only slice — no **`useEffect`** edits; no barrel **`export *`** in this slice.
- **Next step:** Phase **2.3** — next **`peers-ui`** directory or file cluster under **`src/`**, same validate/commit pattern; or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 hotfix — peers-sdk `context/index.ts` export order (Biome circular export)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-sdk`](../../peers-sdk) — [`src/context/index.ts`](../../peers-sdk/src/context/index.ts); peers-app root — submodule pointer + this doc
- **Cause:** Biome **`assist/source/organizeImports`** alphabetized **`export *`** in **`context/index.ts`** (and **`data/files/index.ts`** order changed in the same Phase 2.3 pass), which altered CommonJS load order. The existing cycle **`context → data-context → package-loader → data/files → user-context-singleton → user-context → data`** then caused **`data/index.js`** to merge a **partial** **`data/files/index.js`** export snapshot — root **`@peers-app/peers-sdk`** lost **`Files`** (and a later **`Files`-only** workaround dropped **`setFileOps`**, **`getFileOps`**, **`file.types`** constants, etc.).
- **Fix:** Restore pre-Biome order: **`user-context-singleton`** first, then **`data-context`**, then **`user-context`**. Add **`// biome-ignore assist/source/organizeImports`** on that file so **`biome check --write`** cannot re-alphabetize. Revert the temporary **`export { Files, FilesTable } from "./files"`** hack in **`data/files/index.ts`**.
- **Commits:** `peers-sdk` @ `1c8dc30`; **peers-app root** @ `ac417e9`
- **Validation:** **`yarn build`** / **`CI=1 yarn test`** in **peers-sdk** (31 suites); **`require('@peers-app/peers-sdk')`** exposes **`Files`**, **`setFileOps`**, **`getFileOps`**, **`FILE_CHUNK_SIZE`**, etc.; **peers-electron** **`yarn build`** against linked SDK.
- **Decisions / guardrail:** **`export *`** order in barrels that participate in cycles is **load-order-sensitive**; use **`biome-ignore`** or break the cycle (follow-up: lazy **`Files`** import in **[`package-loader.ts`](../../peers-sdk/src/package-loader/package-loader.ts)**).
- **Next step:** Same as [resume block](#entries) — **Phase 2.3** on **`peers-ui`** or **Phase 3** npm per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-sdk (full package)

- **Author / agent:** Cursor agent
- **Submodules / root:** [`peers-sdk`](../../peers-sdk) — wide mechanical + targeted fixes ([`src/`](../../peers-sdk/src/) tree, config); peers-app root — this doc + submodule pointer
- **Changes:**
  - **`biome check --write`** / **`--unsafe`** across the repo; resolved **error**-severity rules (e.g. **`noAsyncPromiseExecutor`**, **`useIterableCallbackReturn`**, **`noAssignInExpressions`**, **`noInnerDeclarations`**, **`serial-json`** control flow, **`sql.data-source`** update field **`map`**/`filter`, **`file-read-stream`** read loop without assignment-in-**`while`**).
  - **`doc.ts`**: align **`@ts-expect-error`** / imports with Biome **`noTsIgnore`**; drop directives that became unused under current **TS**.
  - **`types.ts`**: **`ZodTypeAny`** for **`fieldsToSchema`**; safe **`codeSchema.shape`** intersection keying.
- **Commits:** `peers-sdk` @ `73ca2dd` (superseded for runtime exports by hotfix **`1c8dc30`** — see [hotfix entry](#entries)); **peers-app root** — submodule + this doc
- **Validation:** **`yarn lint`** (**`biome check .`**) **0 errors** (warnings expected); **`yarn build`** **pass**; **`CI=1 yarn test`** **pass** (31 suites, 691 tests).
- **Next step:** Phase **2.3** on **`peers-ui`** (or **Phase 3** npm for **`peers-sdk`** first) per priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/tasks/`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/tasks/`](../../peers-core/src/tasks/) (tools incl. [`import-old-tasks.tool.ts`](../../peers-core/src/tasks/tools/import-old-tasks.tool.ts), UI panels, task list, mobile view), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`noNonNullAssertion` / `noExplicitAny`:** **`new-task`** / **`write-task`** groupId; **`import-old-tasks`** **`OldRecord`**, **`stripNumericKeys`**, repeats cleanup, **`existingTasks`** / **`idMap`**, pvar **`scope`**, repeats-import samples; panels (**`content-panel`**, **`conversation-panel`**, **`comments-section`**, **`repeats-editor`**); **`categorize-tasks`** / **`use-lazy-sections`** completed entries; **`mobile-tasks-view`** / **`task-list-panel`** recurring toggle; **`unlogged-time`** timer start; **`use-lazy-sections`** section move + **`SortBy`** from **`@peers-app/peers-sdk`**, children **`parentTaskId`** guards.
  - **`search-bar`:** wire **`autoFocus`** prop; **`biome.json`** — **`noAutofocus`** off under existing **`src/tasks/ui/**/*.tsx`** a11y bundle (intentional focus-on-open).
- **Commits:** `peers-core` @ `138df7b`; **peers-app root** — submodule pointer + this doc (same PR)
- **Validation:** **`npm run lint`** (**`biome check .`**) **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests).
- **Next step:** Biome in other submodules or **Phase 3** npm migration per roadmap priority.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core webpack / Jest / tsconfig

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`webpack.package.config.js`](../../peers-core/webpack.package.config.js), [`webpack.routes.config.js`](../../peers-core/webpack.routes.config.js), [`webpack.uis.config.js`](../../peers-core/webpack.uis.config.js), [`jest.config.js`](../../peers-core/jest.config.js), [`tsconfig.json`](../../peers-core/tsconfig.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check --write --unsafe`** on those five files: **`node:path`** in **`webpack.package.config.js`**, template output paths in routes/uis, double-quote formatting; **`jest.config.js`** / **`tsconfig.json`** formatter alignment.
  - **Removed** unused **`require("webpack")`** from **`webpack.routes.config.js`** and **`webpack.uis.config.js`** (dead code; configs never referenced **`webpack`**).
- **Commits:** `peers-core` @ `b57c8cc`; **peers-app root** — submodule pointer + this doc (same PR)
- **Validation:** `npx biome check` on the five files **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests). **`npm run lint`** (**full tree**) still **fails** — remaining **`src/tasks/`** diagnostics.
- **Next step:** Continue Phase **2.3** — **`src/tasks/`** (`noNonNullAssertion`, **`noExplicitAny`**, unused params, etc.) until **`npm run lint`** is green.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core root `package.ts` / `uis.ts` / `routes.ts`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/package.ts`](../../peers-core/src/package.ts), [`src/uis.ts`](../../peers-core/src/uis.ts), [`src/routes.ts`](../../peers-core/src/routes.ts); peers-app root — this doc
- **Changes:**
  - **`npx biome check`** on those three files exits **0**: organize imports, formatting.
  - **`package.ts`:** **`(exports as { exports: IPeersPackage }).exports`** — removes **`noExplicitAny`** while preserving the **webpack** bundle contract.
  - **No `biome.json` overrides** added.
- **Commits:** `peers-core` @ `860376d`; **peers-app root** — submodule pointer + this doc (same PR)
- **Validation:** `npx biome check src/package.ts src/uis.ts src/routes.ts` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests).
- **Next step:** Continue Phase **2.3** — **`webpack.*.config.js`** / **`jest.config.js`** / **`tsconfig.json`** and remaining **`src/tasks/`** Biome diagnostics until **`npm run lint`** is green.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/voice-hub`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/voice-hub/`](../../peers-core/src/voice-hub/) (assistants, `consts`, `data`, [`ui/voice-hub.tsx`](../../peers-core/src/voice-hub/ui/voice-hub.tsx)), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check src/voice-hub/`** exits **0**: import/type, organize imports, formatting.
  - **`biome.json` overrides:** **`src/voice-hub/ui/**/*.tsx`** — same **a11y** bundle as **`src/groceries/ui`** (mic/cancel buttons, Bootstrap spinner **`role="status"`**).
  - **`voice-hub.tsx`:** remove **`any`** — typed **`IEventData<…>`** for voice events; **`Messages().list`/`count`** and **`VoiceMessages().cursor`** use **`DataFilter`/`sortBy`** without casts; **`voiceGetState().keyError`**; **`threadId`** updates without **`!`**; subscription cleanup with **`for…of`** instead of **`forEach`** return.
- **Commits:** `peers-core` @ `53bb903`; **peers-app root** — submodule pointer + this doc (same PR)
- **Validation:** `npx biome check src/voice-hub/` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests).
- **Next step:** Continue Phase **2.3** — root **`package.ts`** / **`uis.ts`** / **`routes.ts`**.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/timers`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/timers/`](../../peers-core/src/timers/) (`consts`, `data`, `tools`, `ui`), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check src/timers/`** exits **0**: import/type, organize imports, formatting; **`write-timer.tool.ts`:** **`const updates`** (was **`let`**).
  - **`biome.json` overrides:** **`src/timers/ui/**/*.tsx`** — same **a11y** bundle as **`src/groceries/ui`** plus **`noSvgWithoutTitle`** (decorative progress-ring SVG).
  - **`timers-screen.tsx`:** Biome **`--write`** dropped **`now`** from the auto-expire effect deps — restored **`[now, timers]`** and **`void now`** in the effect body so expiry still runs every tick; avoids **`useExhaustiveDependencies`** fighting **`[now, timers]`**.
- **Commits:** `peers-core` @ `700ee7e`; **peers-app root** — submodule pointer + this doc (same PR)
- **Validation:** `npx biome check src/timers/` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests).
- **Next step:** Continue Phase **2.3** — **`src/voice-hub/`**, then root **`package.ts`** / **`uis.ts`** / **`routes.ts`**.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/groceries`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/groceries/`](../../peers-core/src/groceries/) (data, logic, tools, UI), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check src/groceries/`** exits **0**: import/type, organize imports, formatting.
  - **`biome.json` overrides:** **`src/groceries/ui/**/*.tsx`** — same **a11y** bundle as **`src/tasks/ui`** / **`src/frames/ui`**.
  - **`add-to-shopping-list.tool.ts`:** resolve **`groupId`** without **`!`** (throw if missing). **`groceries-screen.tsx`:** define **`triggerSessionEnd`** before **`resetInactivityTimer`** (fixes **`noInvalidUseBeforeDeclaration`**); deviceVar subscription cleanup with **`for…of`** instead of **`forEach`** return.
- **Commits:** `peers-core` @ `74178f0`; **peers-app root** @ `d46c3e9` (submodule pointer + this doc)
- **Validation:** `npx biome check src/groceries/` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests).
- **Next step:** Continue Phase **2.3** — **`src/timers/`** (then **`voice-hub/`**, root **`package.ts`** / **`uis.ts`** / **`routes.ts`**).

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/frames`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/frames/`](../../peers-core/src/frames/) (data, pipeline incl. tests/fixtures, tools, UI), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check src/frames/`** exits **0**: import/type, organize imports, formatting (incl. **`__tests__/fixtures/**/*.js`**).
  - **`biome.json` overrides:** **`src/frames/ui/**/*.tsx`** — same **a11y** bundle as **`src/tasks/ui`** (Bootstrap-style controls, spinners, etc.).
  - **`validator.ts`:** no **`!`** on **`queue.shift()`**; **`frame-detail.tsx`:** zip **`blocks`/`members`** without **`blocks[i]!`**, cleanup subscriptions with **`for…of`** (not **`forEach`** return); corpus tests: **`Map.get`** cache pattern, **`judgeCheck`** after **`API_KEY`** guard, **`forEach`** + **`console.log`** with block bodies; **`parser-corpus`** **`anyOfRoles`** check without **`any`**.
- **Commits:** `peers-core` @ `c8dae96`; **peers-app root** @ `a4f14b7` (submodule pointer + this doc)
- **Validation:** `npx biome check src/frames/` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests). **`frame-detail`** / **`frames-screen`** hook deps unchanged except cleanup style.
- **Next step:** Continue Phase **2.3** — **`src/groceries/`** (then **`timers/`**, **`voice-hub/`**, root **`package.ts`** / **`uis.ts`** / **`routes.ts`**).

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/common/assistants` + `src/common/ui`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/common/assistants/`](../../peers-core/src/common/assistants/), [`src/common/ui/`](../../peers-core/src/common/ui/), [`biome.json`](../../peers-core/biome.json); peers-app root — this doc
- **Changes:**
  - **`npx biome check src/common/assistants/ src/common/ui/`** exits **0**: import/type (`import type`, inline `type` where needed), organize imports, double-quote formatting; **`index.ts`** barrel uses **local imports + `export { … }`** instead of duplicate re-export/import blocks.
  - **`biome.json` overrides:** **`src/common/ui/**/*.tsx`** — **`noStaticElementInteractions`**, **`useKeyWithClickEvents`**, **`useSemanticElements`** off for the **`CollapsedStrip`** div-with-**`role="button"`** pattern (aligned with **`src/tasks/ui`** approach); **`app.tsx`** uses **`type="button"`** on the demo button (no override).
- **Commits:** `peers-core` @ `b5a946e`; **peers-app root** @ `fd00648` (submodule pointer + this doc)
- **Validation:** `npx biome check src/common/assistants/ src/common/ui/` **pass**; **`npm run build`** **pass**; **`CI=1 npm test`** **pass** (8 suites, 87 tests). No **`useEffect`** edits in this slice.
- **Next step:** Continue Phase **2.3** — **`src/frames/`** (then groceries → timers → voice-hub → root **`package.ts`** / **`uis.ts`** / **`routes.ts`**); same validate/commit pattern.

### 2026-04-19 — Phase 2.3 hotfix — `use-lazy-sections` loading spinner

- **Submodules / root:** peers-core [`use-lazy-sections.ts`](../../peers-core/src/tasks/ui/task-list/use-lazy-sections.ts); peers-app root — this doc
- **Cause:** During Biome/format passes on the Phase 2.3 **`src/tasks`** slice, **`useEffect` dependency arrays** were corrupted: **`lastClearCompleteDT`** was replaced by **`buildChildrenMap`**, and the incremental-expand effect gained extra deps. **`buildChildrenMap`** is a **new function reference every render** → those effects re-ran every frame → **`loadIdRef`** kept incrementing → in-flight **`loadAll`/`loadSearch`** aborted with **`loadIdRef.current !== loadId`** before **`setLoading(false)`** — Tasks UI stuck on the loading spinner **with no console or build error**.
- **Fix:** Restore deps to match pre-**`39eb2ab`** behavior: **`lastClearCompleteDT`** on the two main effects; **`[expandedSections]`** only on the expand effect.
- **Commits:** `peers-core` @ `d486356`; **peers-app root** @ `6c1f55d` (roadmap hotfix note)
- **Validation:** `npm run build`; `CI=1 npm test` — pass. Re-smoke **Tasks** in **peers-electron** after rebuilding **peers-core** **`uis.bundle.js`**.
- **Decisions / guardrail:** After **`biome check --write`** (or organize-imports) on files with **React `useEffect`**, **manually diff dependency arrays** against `main`. Do not list **inner `async function`** / **unstable callbacks** as deps unless wrapped in **`useCallback`** with a stable contract. See **Guardrail (2026-04-19)** under **§ Phase 2.3 — Pay down debt** below.
- **Next step:** Continue Phase **2.3** on the next **`peers-core`** subtree (see snapshot); optional **`peers-electron`** full build after **`uis.bundle`** changes.

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/tasks`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core — [`src/tasks/`](../../peers-core/src/tasks/) (data, tools, UI), [`biome.json`](../../peers-core/biome.json) overrides, [`tsconfig.json`](../../peers-core/tsconfig.json) (`jsx`); peers-app root — this doc only
- **Changes:**
  - **`npx biome check src/tasks/`** exits **0** (remaining findings are **warnings**, not errors): import/type/format, `useCallback` for **`SimpleThreadView`** message load, subscription cleanup without **`forEach` return**, list HTML parser loop without assign-in-**`while`**.
  - **`biome.json` overrides:** **`src/tasks/ui/**/*.tsx`** — strict **a11y** rules off (buttons without **`type`**, click-on-`div`, etc.; follow-up optional); **`use-lazy-sections.ts`** — **`useExhaustiveDependencies`** off (matches existing **eslint** intent); **`import-old-tasks.tool.ts`** — **`useNodejsImportProtocol`** off (**`require('fs')`** for webpack).
  - **`tsconfig.json`:** **`"jsx": "react-jsx"`** so JSX matches automatic runtime after Biome import cleanup (was **`react`** + missing **`React`** in scope).
- **Commits:** `peers-core` @ `39eb2ab` (superseded for Tasks behavior by hotfix **`d486356`**); **peers-app root** — submodule + roadmap commits through **`6c1f55d`**
- **Validation:** `npx biome check src/tasks/` **pass**; `npm run build` **pass**; `CI=1 npm test` **pass**. Full-package **`npm run lint`** (**`biome check .`**) still reports debt **outside** `src/tasks/` — expected until more Phase **2.3** slices. **Regression:** Tasks infinite load from bad **`useEffect`** deps — fixed in [hotfix entry](#entries) (`d486356`).
- **Next step:** Superseded by hotfix + snapshot — continue Phase **2.3** on the next directory (see **Current state** and hotfix **Next step**).

### 2026-04-19 — Phase 2.3 — Biome debt: peers-core `src/common/tools`

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-core ([`biome.json`](../../peers-core/biome.json) override for webpack-bundled CLI runner), [`src/common/tools/`](../../peers-core/src/common/tools/)); peers-app root — this doc only
- **Changes:**
  - **`npx biome check src/common/tools/`** clean: import/type fixes, organize imports, formatting; **`run-workflow.tool.ts`** refactored to avoid **`noAsyncPromiseExecutor`** (non-async Promise executor + `runWorkflow().then()`).
  - **`cli-assistant-runner.tool.ts`:** keep **`child_process` / `os` / `path`** without **`node:`** prefix so **webpack** `build:package` resolves builtins as externals; **Biome** [`useNodejsImportProtocol`](https://biomejs.dev/linter/rules/use-nodejs-import-protocol/) disabled for that file only via **`biome.json` overrides**.
  - Tests: **`SpawnOptions`**, **`IMessage` / `IWorkflowLog` / `IAssistant`** instead of **`any`** where needed for **`noExplicitAny`**.
- **Commits:** `peers-core` @ `08094d1`; **peers-app root** — submodule pointer to that commit + this roadmap update (same PR)
- **Validation:** `npx biome check src/common/tools/` **pass**; **`peers-core`** `npm run build` **pass**; `CI=1 npm test` **pass** (8 suites, 87 tests; sandbox/Watchman may need `CI=1` or full permissions locally). **Follow-up:** full **`peers-electron`** build **pass** (manual smoke — confirms linked **peers-core** package bundle still loads correctly downstream).
- **Decisions / exceptions:** **`node:`** imports remain in **Jest-only** test files under `common/tools/__tests__/` (not webpack-bundled). Rest of **peers-core** still has Biome debt outside this directory.
- **Next step:** Continue Phase **2.3** — next **`peers-core` directory** (e.g. another `src/common/` subtree) or next submodule slice; same validate/commit pattern.

### 2026-04-19 — Phase 2.2 follow-up — Biome in submodule CI + full-release (no root GHA)

- **Author / agent:** Cursor agent
- **Submodules / root:** peers-sdk, peers-ui, peers-device, peers-services, peers-app.github.io, peers-electron (workflow edits); root **remove** [`.github/workflows/biome.yml`](../../.github/workflows/biome.yml), [full-release.js](../../full-release.js), this doc
- **Changes:**
  - **Removed** root monorepo **Biome** workflow — private submodule URLs cannot be cloned on GitHub-hosted runners without extra PAT wiring; **lint enforcement** moves to **each package’s existing CI** and **`node full-release.js`**.
  - **[full-release.js](../../full-release.js):** new **`runLint()`** runs **`yarn`/`npm run lint`** (Biome) when a **`lint`** script exists, **before build** in Step 2 (linked packages) and Step 3 (release).
  - **Submodule workflows:** **`yarn lint` / `npm run lint`** after install, before test/build — `publish.yml` (sdk, ui, device), **`main_peers-services.yml`**, **`deploy-pages.yml`** (docs), **`build-and-release.yml`** (electron app + **`npm run lint`** in **peers-core** / **peers-cli** sidecar build steps).
- **Commits:** `peers-sdk` @ `d0dacc9`; `peers-ui` @ `d1ef8e1`; `peers-device` @ `dade19c`; `peers-services` @ `e077f29`; `peers-app.github.io` @ `abff3da`; `peers-electron` @ `d80dfda`; **peers-app root** @ `8f06c73`
- **Validation:** Submodule workflows and full-release run **`lint`** where defined; full-tree Biome clean is still Phase **2.3**.
- **Next step:** Phase **2.3** debt paydown; optional PAT + root workflow later if desired.

### 2026-04-25 — Default branch `main`

- **Submodules / root:** [biome.json](../../biome.json), [peers-core/biome.json](../../peers-core/biome.json), [git-pull-all.sh](../../git-pull-all.sh)
- **Changes:** `vcs.defaultBranch` = **`main`** (matches Git default on all `peers-app` repos). **`git-pull-all.sh`:** detached-HEAD checkouts use **`origin/main` only** (no `master` fallback).

### 2026-04-19 — Phase 2.2 — Biome CI and editor integration

- **Author / agent:** Cursor agent (Phase 2.2)
- **Submodules / root:** root only — ~~`.github/workflows/biome.yml`~~ (removed in Phase 2.2 follow-up — private submodules), [`.vscode/`](../../.vscode/), [biome.json](../../biome.json) (`vcs.defaultBranch`), [docs/roadmap/standardize-build-tooling.md](./standardize-build-tooling.md)
- **Changes:**
  - **GitHub Actions** `Biome` workflow on `pull_request` and `push` to **`master`**: `actions/checkout@v4` with **`fetch-depth: 0`**, **`submodules: recursive`**, Node **22**, **`npm ci`**, then **`biome ci --changed --since <base>`** with **`--no-errors-on-unmatched`** (docs-only / YAML-only / submodule-pointer-only PRs may process zero Biome-handled files without failing).
  - **`biome.json`:** `vcs.defaultBranch` = **`master`** (supports local/CI `--changed` semantics).
  - **`.vscode`:** recommend **Biome** extension; default formatter + format-on-save for JS/TS/JSON (VS Code / Cursor).
- **Commits:** **peers-app root** @ `c32951e`
- **Validation:** Local: `npm ci` and `npx biome ci --changed --since HEAD~1 --no-errors-on-unmatched .` **pass** on the Phase 2.2 commit (Biome checks changed JSON/config files). CI: confirm **Biome** job green on PR/push after merge (fork PRs: same as other workflows; submodules require accessible URLs).
- **Decisions / exceptions:** Enforcement is **PR-scoped changed files** vs base, not full-tree green until Phase 2.3. **`--no-errors-on-unmatched`** avoids failing when the changed set is empty of Biome-supported files.
- **Next step:** Phase **2.3** — pay down Biome debt incrementally; optionally tighten CI to full tree once clean.

### 2026-04-19 — Phase 2.1 — Biome scaffold

- **Author / agent:** Cursor agent (Phase 2.1)
- **Submodules / root:** peers-sdk, peers-core, peers-device, peers-ui, peers-electron, peers-cli, peers-pwa, peers-react-native, peers-package-template, peers-services (incl. `k8s/peers-app`), peers-app.github.io; root `biome.json`, `package.json`, `package-lock.json`, this doc
- **Changes:**
  - Root **`biome.json`:** recommended linter rules, formatter (2 spaces, line width 100), `vcs.useIgnoreFile`, `files` includes with force-ignore for `dist`, `bin`, `build`, `node_modules`, `.docusaurus`, `.expo`, etc.
  - Root **`package.json`:** private meta-package with **`@biomejs/biome` 2.3.11** and `lint` / `lint:fix` scripts (`biome check` at monorepo root).
  - Each JS package: **`biome.json`** with `"root": false`, `"extends": "//"` ( **`peers-services/k8s/peers-app`** uses `"extends": ["../../../biome.json"]` for deep path).
  - **`package.json`:** `@biomejs/biome` **2.3.11**, **`lint`** / **`lint:fix`**; **peers-pwa** former `lint` (`tsc --noEmit`) moved to **`typecheck`**; **peers-react-native** **`expo lint`** preserved as **`lint:expo`**.
- **Commits:** `peers-sdk` @ `0ac2f8c`; `peers-core` @ `78511df`; `peers-device` @ `f715731`; `peers-ui` @ `c832630`; `peers-electron` @ `fc04c6d`; `peers-cli` @ `10e59c6`; `peers-pwa` @ `e993c3b`; `peers-react-native` @ `7d51d88`; `peers-package-template` @ `d2c8144`; `peers-services` @ `fc3435f`; `peers-app.github.io` @ `46f67ef`; **peers-app root** @ `341e72d`
- **Validation:** Root `npm install` + `npm run lint` (Biome runs; many diagnostics expected). Per submodule `npm run build` / `yarn build` — **pass** (sdk, core, cli, device, ui, electron, pwa, services, package-template, k8s container, peers-app.github.io). `peers-react-native` not fully built (native); `yarn lint` / Biome not required to be clean for Phase 2.1.
- **Decisions / exceptions:** Root **`package.json`** added for pinned Biome CLI at monorepo root (optional path in roadmap). No CI in 2.1 (Phase 2.2).
- **Next step:** Phase **2.2** — Biome in CI and optional editor/docs; then **2.3** debt paydown.

### 2026-04-19 — Phase 1.1–1.3 — Node 22, TypeScript 5.8.3, Jest 29

- **Author / agent:** Cursor agent (Phase 1 implementation)
- **Submodules / root:** peers-sdk, peers-ui, peers-device, peers-electron, peers-cli, peers-core, peers-pwa, peers-services (+ `k8s/peers-app/package.json`), peers-package-template, peers-react-native, peers-app.github.io; root `.nvmrc` + this doc
- **Changes:**
  - Root **`.nvmrc`** with `22`
  - **CI:** `node-version` **20 → 22** in `peers-sdk`, `peers-ui`, `peers-app.github.io`, `peers-services` (`update-download-links.yml`)
  - **`typescript`:** `^5.8.3` in all package.json that declared TypeScript (including `peers-services/k8s/peers-app`)
  - **Jest:** `peers-device` **jest** `^30` → `^29.7.0`, **@types/jest** → `^29.5.13`; **peers-ui** **jest-environment-jsdom** `^30` → `^29.7.0`, **@types/jest** → `^29.5.13`
  - **Type fixes for TS 5.8:** `peers-ui/src/setupTests.ts` (`TextEncoder` cast); `peers-electron/src/server/voice/stt-service.ts` (`File` from `Uint8Array` buffer)
- **Commits:** `peers-sdk` @ `1543dda`; `peers-ui` @ `02addfc`; `peers-app.github.io` @ `5db3d7d`; `peers-services` @ `8393057`; `peers-device` @ `2017c8e`; `peers-electron` @ `f391442`; `peers-core` @ `a66fe6a`; `peers-cli` @ `e4b6415`; `peers-pwa` @ `23f1e97`; `peers-package-template` @ `5e55ad2`; `peers-react-native` @ `3aec416`; **peers-app root** @ `3d1a587` (Phase 1: .nvmrc, submodule refs, roadmap file); later commits on `master` may amend roadmap text only
- **Validation (Node v22.15.1):**
  - `yarn build`: peers-sdk, peers-ui, peers-electron, peers-pwa, peers-services — **pass**
  - `npm run build`: peers-device, peers-core, peers-cli, peers-package-template, peers-app.github.io — **pass**
  - `yarn test` / `npm test`: peers-sdk (31 suites), peers-device (9 suites), peers-ui (1 suite), peers-core (8 suites), peers-react-native `npx jest --watchAll=false` — **pass**; peers-electron script is `echo 'no tests'`
- **Decisions / exceptions:** Jest **29** path chosen (not 30). Baseline: peers-sdk had TS 5.5.4 / jest 29.7; peers-device had jest 30 — now aligned.
- **Next step:** Roadmap **Phase 2** (Biome) or **Phase 3** (npm migration) per priority; update [ci-sibling-packages.md](./ci-sibling-packages.md) when moving to npm-first CI examples.

---

## Goals

- **One package manager:** npm everywhere (remove Yarn from day-to-day workflows and CI examples that assume `yarn.lock`).
- **Predictable runtime:** `.nvmrc` at the monorepo root (and optional `engines` in packages) so local and CI Node versions match.
- **Aligned tool versions:** TypeScript and Jest (and other shared dev deps where practical) on agreed versions across submodules.
- **Lint and format:** Biome as the single tool for both (today most packages have no ESLint/Biome/Prettier).
- **Bundler strategy:** Migrate **webpack → esbuild** where the plan calls for it, while **keeping webpack only in `peers-react-native`** for Hermes compatibility. **Do not** change the peers package **bundle contracts** (see [Bundle output contract](#bundle-output-contract-peers-packages)) without explicit testing.

## Non-goals (for this roadmap)

- Replacing Metro/Expo for the React Native app (mobile remains as-is except npm/script alignment where touched).
- Replacing Docusaurus on the docs site submodule (`peers-app.github.io`) except as a follow-up if versions are aligned.
- Big-bang reformat of the entire codebase in a single PR (Biome should roll out with incremental `check` / `check --fix` and scoped CI).

---

## Current state (snapshot)

| Area | Situation |
|------|-----------|
| **Package manager** | **npm** (`package-lock.json`) for all migrated JS packages (see [resume block](#entries)); **`yarn.lock`** remains in **`peers-react-native`** only (among app submodules). |
| **Linking** | [link-deps.js](../../link-deps.js): **`yarn link`** if **`yarn.lock`** in that package, else **`npm link`**. |
| **Dev orchestration** | [dev-all.sh](../../dev-all.sh): **`npm run`** / **`npx`** for sdk, ui, device, core, electron, and react-native webpack watch (**`npm run webpack -- --watch`**). |
| **Install/build scripts** | [update-and-build.sh](../../update-and-build.sh) / [update-deps.js](../../update-deps.js): Yarn if **`yarn.lock`**, else **`npm ci`** / **`npm install`**. [full-release.js](../../full-release.js): **`unlinkPackage`** / **`forceInstallDependencies`** / **`buildProject`** are **`yarn`/`npm`-aware**; npm unlink semantics avoided (see [resume block](#entries)). |
| **TypeScript** | **As of 2026-04-19:** `^5.8.3` in all TS submodules (Phase 1). |
| **Jest** | **As of 2026-04-19:** `^29.7.0` where Jest is used; peers-ui jsdom stack on 29 (Phase 1). |
| **Node** | **As of 2026-04-19:** root [`.nvmrc`](../../.nvmrc) = `22`; GHA publish/deploy workflows that used Node 20 now use **22**. |
| **Lint / format** | **As of 2026-04-21:** Same Biome setup as 2026-04-20 (**`useExhaustiveDependencies`** off at root + **`peers-services`**). **`peers-core`** @ **`053c9ae`:** **`openai`** devDependency for pipeline test imports (see Progress log *follow-ups*). **`peers-electron`** @ **`f9ac4d4`:** **`zod`** **`overrides`** **`3.25.76`** (not **`3.23.8`**) for runtime **`zod/v3`**. **`peers-sdk`** **`npm run lint`** @ **`d45291e`**; **`peers-ui`** @ **`e7c745f`** (0 Biome warnings). **`peers-core`** full-tree **`biome check`** historically green @ **`138df7b`**; config touchpoints @ **`5d4f36c`**. **Integration:** rebuild **`peers-electron`** after **`uis.bundle.js`** changes; Tasks hotfix **`d486356`**. |

**As of 2026-04-22:** [docs/release-workflow.md](../release-workflow.md), [docs/roadmap/ci-sibling-packages.md](./ci-sibling-packages.md), and related **`docs/`** / **`docs/context/`** pages are **npm-first** (**Phase 3.3**). [.cursor/rules/monorepo-structure.mdc](../../.cursor/rules/monorepo-structure.mdc) was already aligned.

---

## Target decisions

| Topic | Decision |
|-------|----------|
| Package manager | **npm** for all JS submodules; delete `yarn.lock` where migrated; commit `package-lock.json`. |
| Node | **`.nvmrc` = 22** at monorepo root; optional `"engines": { "node": ">=22" }` per `package.json`. |
| TypeScript | Align devDependency to **`^5.8.3`** (or a single agreed minor — bump this doc if the team picks a newer floor). |
| Jest | **`^29.7.0`** everywhere Jest is used (Phase 1 done 2026-04-19). |
| Lint / format | **Biome** — root `biome.json`; submodules use minimal config with `"extends": "//"` where Biome’s monorepo pattern applies; `lint` / `lint:fix` scripts. |
| Bundlers | **esbuild** replaces webpack in peers-electron, peers-core, peers-package-template, peers-cli. **Webpack remains** in peers-react-native only. **tsc** remains for libraries; **Vite** remains for peers-pwa. |

### Bundle output contract (peers packages)

The loader pipeline is **bundler-agnostic** but **not** output-agnostic. Any change (webpack, esbuild, or other) must preserve:

- **`package.bundle.js`:** CommonJS shape so `module.exports` is populated when evaluated in the host (`PackageLoader` in [`peers-sdk/src/package-loader/package-loader.ts`](../../peers-sdk/src/package-loader/package-loader.ts) — server-side eval).
- **`routes.bundle.js` / `uis.bundle.js`:** Eval’d with injected `exportRoutes` / `exportUIs`; code must invoke those callbacks; externals resolve via **globals** (`React`, `PeersSDK`, `PeersUI`, `zod`, etc.).

Validation for bundler migrations must include **loading a real package** in Electron (and any other supported host), not only file size or hash checks.

---

## Principles for validation

1. **One submodule at a time** for risky changes (npm migration, esbuild), with **build + tests** in that submodule before moving on.
2. **Commit inside the submodule first**, then update the **root repo** if `docs/` or aggregate scripts changed — same as [.cursor/rules/git-commits.mdc](../../.cursor/rules/git-commits.mdc).
3. **Keep main usable:** Prefer merging Phase 1 (Node + versions + Biome scaffold) before Phase 2 (npm) if that reduces risk, or run Phase 1 on a branch until green.
4. **Record the command you ran** in the PR / task notes so bisect is possible, and **append the same detail** to [Progress log](#progress-log) (see [Documentation and handoff](#documentation-and-handoff-required)).
5. After **link-deps** or **dev-all** changes, smoke-test: `node link-deps.js` and a short `dev-all.sh` run (or equivalent manual starts) on a clean clone is ideal before declaring done.

---

## Phase 0 — Baseline (no code changes)

**Purpose:** Know what “green” looks like before edits.

**Do:**

- From a clean-ish tree, note current versions: `node -v`, and per submodule `npm test` / `npm run build` (or yarn where still required) for the packages you touch in the next phases.
- Optionally capture `npm ls typescript jest` (or yarn equivalent) in key repos for comparison after alignment.

**Validate:**

- Document any known flaky tests or skipped suites so later failures are not misattributed.

---

## Phase 1 — Node version + align TypeScript + Jest

**Purpose:** Low-risk dependency alignment; failures are usually compile/test noise, easy to bisect.

### 1.1 Add `.nvmrc` (root)

**Do:**

- Add `22` (or `22.x` per team preference) to **[`.nvmrc`](../../.nvmrc)** at the monorepo root.
- Optionally add `"engines": { "node": ">=22" }` to each submodule `package.json` (can be gradual).

**Validate:**

- `nvm use` / `fnm use` / `asdf` picks Node 22.
- No unintended CI breakage: update GitHub Actions `node-version` where workflows pin Node (search `.github/workflows` across submodules).

### 1.2 Align TypeScript

**Do:**

- Set `typescript` to **`^5.8.3`** (or chosen single range) in every submodule that uses TypeScript.

**Validate:**

- In each updated submodule: `npm run build` (or current build command), `npm test` where tests exist.
- Fix any new diagnostics **before** merging the next phase.

### 1.3 Align Jest

**Do:**

- Either pin **all** Jest consumers to **`^29.7.0`** **or** upgrade **all** to **Jest 30** with a short migration pass (APIs, config, snapshots).

**Validate:**

- Full test suite per submodule touched; pay attention to peers-device if downgrading from Jest 30 or upgrading majors.

---

## Phase 2 — Biome (lint + format)

**Purpose:** Introduce consistent rules without blocking on npm migration.

### 2.1 Scaffold config

**Do:**

- Add root **`biome.json`** with team-agreed presets (TypeScript-oriented rules, formatter options).
- Add **`biome.json`** in each submodule that should participate, using Biome’s **extends** pattern for shared rules where supported.
- Add `lint` / `lint:fix` (or `format`) scripts and devDependency `@biomejs/biome`.

**Validate:**

- `biome check .` at root (if applicable) and in each submodule — **expect many findings initially**.
- Adopt **incremental** enforcement: start with `warn`-level or narrow `includes` / exclude `dist`, `node_modules`, generated paths, then tighten.

### 2.2 CI and editor integration

**Do:**

- Add a CI job or step that runs `biome check` on changed files or on the whole repo once clean enough.
- Document editor format-on-save in a follow-up or `.vscode/` / Cursor settings if the team uses shared settings.

**As implemented (2026-04-19):** Root monorepo **`.github/workflows/biome.yml`** was **removed** after a follow-up (private submodule URLs break `actions/checkout` with `submodules: recursive` on GitHub-hosted runners without extra PATs). Biome in CI is **`yarn`/`npm run lint`** in **each package’s** existing workflows plus **`runLint()`** in **[full-release.js](../../full-release.js)**. See [Progress log](#progress-log) entry *Phase 2.2 follow-up*.

**Validate:**

- CI passes on a branch with a small, mechanical Biome-only commit to prove wiring.

### 2.3 Pay down debt

**Do:**

- Reduce Biome noise in focused PRs (directory-by-directory or package-by-package).

**Validate:**

- No new failures in `build` / `test` from formatting-only churn (review diffs for logic changes).

**Guardrail (2026-04-19, still applies 2026-04-20):** Automated Biome edits can **change `useEffect`/`useCallback` dependency arrays** in subtle, breaking ways (example: swapping a stable prop like **`lastClearCompleteDT`** for an **inner `function`** reference that changes every render — caused Tasks infinite loading; see [Progress log](#progress-log) *Phase 2.3 hotfix*). **`useExhaustiveDependencies`** is now **disabled** repo-wide (see [resume block](#entries)), but **`biome check --write`** can still rewrite arrays — **re-read the diff** and smoke-test **UIs** that depend on the file.

**Next slice (suggested):** **[Phase 4 — Webpack → esbuild](#phase-4--webpack--esbuild-except-react-native)**; optional **`peers-react-native`** **`yarn.lock` → `package-lock.json`**; sweep remaining **`yarn`** in submodule **`docs/`** (e.g. **`peers-services`**). Snapshot: [resume block](#entries).

---

## Phase 3 — Standardize on npm

**Purpose:** One lockfile story, simpler docs, unblock **npm link** in link-deps.

### 3.1 Order of migration

Migrate **one submodule at a time** (suggested order — adjust if release pressure dictates):

1. **peers-sdk** (many dependents)
2. **peers-ui** / **peers-device** (parallel possible if careful; still validate each)
3. **peers-electron**, **peers-services**, **peers-pwa**

**Per submodule:**

- Remove **`yarn.lock`**, run **`npm install`**, commit **`package-lock.json`**.
- Replace script invocations: `yarn X` → `npm run X` (and `yarn install` → `npm ci` in CI).
- Search for `yarn` in `package.json`, CI workflows, and READMEs in that repo.

**Validate (each submodule):**

- `rm -rf node_modules && npm ci`
- `npm run build`
- `npm test` (if applicable)
- If the package publishes: dry-run or follow existing release checklist from [docs/release-workflow.md](../release-workflow.md).

### 3.2 Root and cross-cutting scripts

**Do:**

- **[link-deps.js](../../link-deps.js):** **Done (2026-04-21):** **`getPackageManager()`** — **`yarn link`** if **`yarn.lock`**, else **`npm link`** (registerable packages are on **`package-lock.json`**). Remaining: harden error messages / docs if any script still assumes Yarn-only linking.
- **[dev-all.sh](../../dev-all.sh):** **Done (2026-04-21)** for **Electron** (**`npx tsc`**, **`npx webpack`**) and **`peers-react-native`** webpack watch (**`npm run webpack -- --watch`**).
- **[update-and-build.sh](../../update-and-build.sh)**, **[update-deps.js](../../update-deps.js):** **`yarn`/`npm`** chosen by **`yarn.lock`** per package (**`npm ci`** / **`npm run build`** when on npm) — no further change for Phase 3.2.
- **[full-release.js](../../full-release.js):** **Done (2026-04-21):** **`unlinkPackage`** uses **`yarn unlink`** when **`yarn.lock`** exists; otherwise removes linked **`node_modules/@peers-app/*`** (npm **`unlink`** avoided — it uninstalls from **`package.json`**). Yarn **`install --force`** failure falls back to **`npm install --force`** without deleting **`package-lock.json`**.
- **React-native:** **`dev`** script uses **`npm run`** for local **`sdk` / `device` / `ui` / `webpack`** steps; **`yarn.lock`** may remain until optional **`package-lock.json`** migration; keep **webpack** for the web/Hermes bundle per [Target decisions](#target-decisions).

**Validate:**

- From a fresh clone: `npm ci` in each migrated repo, `node link-deps.js`, then start the minimal set of dev processes needed for your smoke test.
- Run **`./update-and-build.sh`** (or relevant subset) if you rely on it for releases.

### 3.3 Documentation sweep

**Done (2026-04-22):** [docs/release-workflow.md](../release-workflow.md), [docs/roadmap/ci-sibling-packages.md](./ci-sibling-packages.md), [docs/cli.md](../cli.md), [docs/context/cli-context.md](../context/cli-context.md), [docs/context/voice-production-builds.md](../context/voice-production-builds.md). **[.cursor/rules/monorepo-structure.mdc](../../.cursor/rules/monorepo-structure.mdc)** was already npm-first — no edit. Submodule **README** search found no **`yarn`** hits at repo root; **`peers-services/docs/download-links.md`** and similar may still mention **`yarn`** — clean up when touching those repos.

**Validate:**

- A teammate can follow **root `docs/`** release and CLI flows on a machine with only **npm** (no global yarn), except **`peers-react-native`** until **`yarn.lock`** is removed there.

---

## Phase 4 — Webpack → esbuild (except React Native)

**Purpose:** Faster builds and smaller devDependency trees without changing Hermes-tested webpack in **peers-react-native**.

**Order (suggested):**

1. **peers-cli** — single bundle, smallest surface.
2. **peers-package-template** + **peers-core** — three bundles each; prove contract with integration tests or manual load.
3. **peers-electron** — renderer (and any bundled client assets) last because packaging and E2E cost more to debug.

**Per migration:**

- Implement esbuild scripts mirroring entry points and externals.
- Preserve **source maps** if you rely on them today for debugging.
- Keep **CSS/asset** behavior equivalent or explicitly document differences.

**Validate:**

- **Unit:** `npm test` / `npm run build` in the submodule.
- **Contract:** Load peers-core (or template) bundles in the real app: register package, routes, UIs — exercise one workflow that hits each bundle type.
- **Electron:** `npm start` / packaged build smoke test on at least one OS you ship.
- **Regression:** Compare critical bundle sizes only as a secondary signal; **correctness > bytes**.

**Rollback:** Keep the old webpack config in git history; tag pre-migration commits if needed.

---

## Phase 5 — Cleanup and guardrails

**Do:**

- Remove unused webpack / babel / loader devDependencies from migrated packages.
- Ensure **no** stray `yarn.lock` in migrated repos; add a lightweight CI check (script: fail if `yarn.lock` appears in allowlisted npm-only dirs).
- Revisit **full-release** and **CI** matrices for caching (`npm cache` vs yarn).

**Validate:**

- Full release dry-run or staging release per [docs/release-workflow.md](../release-workflow.md).
- Green CI across submodules touched.

---

## Risk register (short)

| Risk | Mitigation |
|------|------------|
| **link-deps** breaks mid-migration | Migrate sdk/ui/device before electron consumers; or short-lived dual support in `link-deps.js` with tests. |
| **Jest major** alignment breaks tests | Dedicated PR; read Jest changelog; run peers-device and peers-electron suites fully. |
| **Biome** huge diff | Incremental `includes`, or format-only PRs per directory. |
| **esbuild** subtle runtime difference | Strict contract tests / manual load in Electron; keep webpack on RN untouched. |
| **CI** still references yarn | Grep `.yml` files for `yarn` after Phase 3. |

---

## Done criteria (checklist)

- [x] Root `.nvmrc` present; CI Node versions aligned (Phase 1, 2026-04-19).
- [x] TypeScript and Jest versions aligned per [Target decisions](#target-decisions) (Phase 1, 2026-04-19).
- [x] Biome running in CI with agreed enforcement level (Phase 2.2, 2026-04-19): **`lint` (Biome) in submodule GitHub Actions** and **`node full-release.js`**; no root monorepo Biome workflow (private submodules). Each job runs **`biome check .`** for that package — **[`peers-core`](../../peers-core)** full-tree **`biome check .`** is **green** (Phase **2.3**, 2026-04-19, submodule **`138df7b`**); other submodules may still carry Biome debt until addressed.
- [ ] No `yarn.lock` in **all** JS submodules (**`peers-react-native`** may still use **`yarn.lock`** — optional follow-up).
- [x] `link-deps.js` + `dev-all.sh` + **`full-release.js`** **`unlinkPackage`** / install paths: **Phase 3.2** (**2026-04-21**).
- [ ] Webpack removed from peers-cli, peers-core, peers-package-template, peers-electron; webpack remains only in peers-react-native.
- [x] [monorepo-structure.mdc](../../.cursor/rules/monorepo-structure.mdc) **Build** column uses **`npm run build`** for migrated packages (2026-04-21).
- [x] [ci-sibling-packages.md](./ci-sibling-packages.md), [release-workflow.md](../release-workflow.md), **`docs/cli.md`**, **`docs/context/*`**: **`npm ci`** / **`npm run`** examples (**Phase 3.3**, **2026-04-22**). Submodule **`docs/`** (e.g. **`peers-services`**) may still mention **`yarn`** — optional sweep.

---

## Suggested task tracking

File a **#peers** task (or parent epic) in the internal task system for this roadmap and link to this document. Break work into **In-Progress** items per phase so validation gates are not skipped. Keep task **statusDetails** aligned with the latest [Progress log](#progress-log) entry.
