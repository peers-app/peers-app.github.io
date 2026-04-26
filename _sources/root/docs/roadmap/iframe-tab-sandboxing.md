# Iframe Tab Sandboxing for Package Isolation

Introduce iframe-based isolation for package tabs in the tabs layout, starting with CSS + crash containment (lightweight), with a clear path to full JS/security isolation later.

## Honest Assessment

Iframe-per-tab is the **right long-term direction**, but full security isolation (where the iframe truly can't access the parent) is **not lightweight** given the current architecture. Here's why:

Package UIs like `tasks.tsx` directly use a **large SDK surface area**:

- ORM data layer: `Tasks().get()`, `Tasks().list()`, `.dataChanged.subscribe()`
- User context: `getUserContext()`, `myUserId()`
- Persistent vars: `deviceVar`, `userVar` (observables with `.subscribe()`)
- Tab navigation: `goToTabPath()`, `updateActiveTabTitle()`, `closeCurrentTab()`, `mainContentPath()`
- Shared UI components: `SortableList` from peers-ui
- Direct browser APIs: `localStorage`, `document.querySelector`, `window.addEventListener`

To fully sandbox (null origin, `sandbox="allow-scripts"`), you'd need a **postMessage bridge** that proxies ALL of the above, plus provides the shared libraries inline (since null origin can't fetch). That's significant work.

**However**, there's a genuinely lightweight Phase 1 that delivers real value immediately.

## Recommended Phased Approach

### Phase 1: Same-Origin Iframe (CSS + Crash Isolation) -- LIGHTWEIGHT

Render each **non-system package tab** in a same-origin `<iframe>`. The iframe accesses shared libraries from `window.parent` (so no code duplication). No sandbox attribute yet.

**What you get:**

- **CSS isolation** -- a package's styles can't break the shell or other tabs (this is a real problem today since bundles can inject arbitrary CSS)
- **Crash containment** -- if a package UI throws an unhandled error or does `while(true){}`, the parent shell stays responsive. Stronger than React error boundaries.
- **Clean architectural boundary** -- forces the code to separate "shell" from "package content", which is the hard structural work. Everything after this is tightening the sandbox.
- **Performance visibility** -- each iframe shows up separately in DevTools Performance tab, making it obvious which package is slow

**What you DON'T get yet:**

- JS security isolation (iframe can access `window.parent`)
- This is explicitly a stepping stone, not the end state

**Key changes:**

All changes live in **peers-ui** -- both peers-electron and peers-pwa get iframe isolation automatically with zero host-specific changes.

1. Create an **iframe srcdoc generator** in peers-ui (e.g. `peers-ui/src/tabs-layout/package-frame.ts`):
   - Generates the iframe HTML as a string (no separate HTML file needed)
   - Copies parent's stylesheets into the iframe at runtime by cloning all `<link rel="stylesheet">` and `<style>` elements from `window.parent.document` -- this works generically regardless of whether CSS is loaded via webpack (Electron) or Vite (PWA)
   - Sets up `window.React`, `window.PeersSDK`, `window.PeersUI`, `window.zod` by referencing `window.parent.*`
   - Listens for `postMessage` to receive bundle code, evaluates it, renders the component
   - Reports readiness back to parent via `postMessage`
2. Change `peers-ui/src/tabs-layout/tabs-layout.tsx` `TabContentRenderer`:
   - For `tab.packageId !== 'system-apps' && tab.packageId !== 'launcher'`: render `<iframe srcDoc={generatedHTML}>` instead of `<UIRouter>`
   - Parent sends `postMessage({ type: 'loadPackage', bundleCode, path, packageId })` after iframe signals ready
   - Tab title updates communicated via `postMessage` from iframe to parent
3. Adapt `peers-ui/src/ui-router/ui-loader.tsx`:
   - `loadUIBundle` stays the same (fetches bundle code as string)
   - New: instead of eval'ing into the main window, pass the string to the iframe via postMessage
   - Route resolution stays in the parent (routes are lightweight metadata)

**What stays the same:**

- `tabs-state.ts` -- tab management is entirely in the parent
- `routes-loader.ts` -- route metadata stays in the parent
- System apps (threads, settings, tools, packages UI) -- these stay in the main frame
- The launcher tab -- stays in the main frame

### Phase 2: PostMessage Bridge (True Isolation) -- MEDIUM EFFORT

Replace `window.parent.*` access with a postMessage-based proxy. The iframe gets a local `PeersSDK` shim that serializes calls over `postMessage` and deserializes responses.

Key challenge: the SDK is heavily observable-based (subscriptions, live data changes). The bridge needs to support:

- Request/response for one-shot calls (`Tasks().get(id)`)
- Subscription forwarding for observables (`.subscribe()`, `.dataChanged`)
- Navigation commands (`goToTabPath`, `updateActiveTabTitle`)

### Phase 3: Sandbox Attribute (Full Security) -- MORE EFFORT

Switch to `sandbox="allow-scripts"` (no `allow-same-origin`). This requires:

- Providing all code via `srcdoc` or blob URL (null origin can't fetch)
- Pre-bundling a "package host" script with React + SDK shim
- All communication exclusively via postMessage bridge from Phase 2

## Cross-Package UI Composition

Packages can still use `UIRouter` to render components from other packages (mashups). The isolation boundary is the **tab**, not the individual component. When package A's tab needs a UIRouter component from package B, package B's bundle gets loaded into package A's iframe. They share context within that tab -- which is the intentional mashup behavior. The parent controls route resolution and bundle delivery, providing a natural place to add permission policies later.

## Alternative / Complementary: Web Workers for Server-Side Code

Worth mentioning: `package.bundle.js` (the non-UI "server" code that registers tools, defines tables, does data processing) runs via `new Function` in the same context too. Moving this into **Web Workers** is arguably:

- **Simpler** -- no DOM, no React, no CSS to deal with
- **Higher security value** -- server-side code has more dangerous capabilities
- **Smaller API surface** to bridge

This is orthogonal to iframe sandboxing and could be done in parallel or as a precursor.

## Why NOT Shadow DOM

Shadow DOM gives CSS isolation without iframe overhead, but:

- React's event delegation doesn't work correctly inside Shadow DOM (known issue with synthetic events)
- No crash containment, no JS isolation
- Fragile with third-party CSS frameworks like Bootstrap
