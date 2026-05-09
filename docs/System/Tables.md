---
sidebar_position: 2
title: Tables
---

# Tables

Peers models most structured data with **tables**: typed rows backed by metadata, Zod schemas, and a pluggable **data source** (local SQLite in the desktop app, `ClientProxyDataSource` in the renderer, IndexedDB-backed paths in the PWA, and so on).

Application code usually obtains a table through **`UserContext`** helpers (for example `Messages()`, `Tasks()`, `PersistentVars()`) rather than constructing `Table` instances by hand.

:::tip Work in progress

This page is intentionally short. Deeper ORM and sync documentation will grow here over time.

:::

## Reactivity and `dataChanged`

When rows are inserted, updated, or deleted, the table emits **`dataChanged`** so UIs and other subscribers can refresh or patch local state. Under the hood that uses the shared **named event** system (`Emitter` / `emit`).

In the **Electron** shell, the renderer does not write the canonical database directly: change notifications may arrive from the **main** process over the same RPC channel as other client calls. How those events are named, subscribed to, and (for performance) **selectively forwarded** to the client is documented in **[Events](./Events)**.

## Related topics

- **[Events](./Events)** — `subscribe`, `emit`, multi-process forwarding, prefix subscriptions
- **[Variables](./Variables)** — persistent observables (`deviceVar`, `userVar`, …) backed by the `PersistentVars` table
