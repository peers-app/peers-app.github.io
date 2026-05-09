---
sidebar_position: 3
title: Events
---

# Events

Peers uses a small **in-process event bus** for named payloads: subscribers match either an exact **event name** or a custom predicate. Tables, persistent variables, the desktop UI shell, voice, and other features share this mechanism.

Core implementation: `@peers-app/peers-sdk` — `events.ts` (`subscribe`, `subscribeDebounce`, `emit`, `Emitter`, `Event`, `unionEvents`, `subscribePrefix`, `notifyClientConnected`).

## Subscribing and emitting

- **`subscribe(name, handler)`** — runs `handler` when `emit({ name, data })` uses that exact `name`. Handlers may return a boolean; returning `false` makes `emit` resolve to `false` (useful for cancellation-style semantics).
- **`subscribe(filterFn, handler)`** — custom matching on the full `{ name, data }` object. Prefer a **string name** when possible so dispatch stays fast.
- **`subscribeDebounce(...)`** — same as `subscribe`, but the handler is debounced by milliseconds.
- **`new Emitter("myEvent")`** — pairs with `emitter.event.subscribe(handler)` for typed `data` payloads; `emitter.emit(data)` calls `emit({ name: "myEvent", data })`.

Name-based subscriptions are indexed internally so matching does not scan every subscriber on every emit.

## Multi-process mode (Electron and CLI client)

In the **desktop app**, data and business logic run mainly in the **main** process while the **renderer** runs the web UI. The SDK marks the renderer (and the CLI when `PEERS_IS_CLIENT` is set) as a **client**.

- On the **server (main)**, `emit` runs local handlers, then may forward the same payload to the UI via **`rpcClientCalls.emitEvent`**, which the Electron host implements over **Socket.IO**.
- On the **client**, the SDK assigns `rpcClientCalls.emitEvent` to **`emit(event, dontPropagate)`** so incoming events run **only** local subscribers and are not sent back to the server.

Reference wiring:

- Renderer: `peers-electron/src/client/frontend-client.ts` (after `connect`, call **`notifyClientConnected()`** so subscriptions registered before the socket was ready are flushed to the main process).
- CLI: `peers-cli/src/connection.ts` (same pattern).

## Selective forwarding

The main process only forwards events the client has **registered interest** in:

- Subscribing with an **exact name** registers that name with the server (reference counted; duplicate subscribers share one registration).
- Prefix-based streams (for example **all** `SomeTable_DataChanged_*` events across group databases) use **`subscribePrefix(prefix)`** from library code that needs it; that registers a **prefix** with the server.

This reduces Socket.IO traffic when many tables emit `*_DataChanged_*` events but the current UI only listens to a subset.

## Single-process mode (PWA)

In the **PWA**, the app calls **`setSingleProcessClient(true)`**. Client and “server” share one process, so table `dataChanged` emitters are **not** suppressed on the client, and `emit` does **not** forward through `emitEvent` (there is no separate renderer process to push to).

## Tables and `dataChanged`

Each `Table` exposes **`table.dataChanged`** as an `Event` backed by a stable name (including the data context). UI code typically uses `Messages().dataChanged.subscribe(...)` rather than calling `subscribe` with the raw string name.

For ORM access patterns (`list`, `get`, proxies), see **[Tables](./Tables)**. For how **pvars** listen for `PersistentVars` updates, see **[Variables](./Variables)**.
