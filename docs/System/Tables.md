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

## Sync timestamps and conflict resolution

Non-`localOnly` tables are wrapped in a tracked data source. Writes do not last-write-wins on a row-level `modifiedAt`. They append **change-log rows** (`ChangeTrackingV2`) and peers exchange those rows.

| Field | Role |
| --- | --- |
| `createdAt` | Author write time. Last-write-wins across devices. Equal times break ties with `changeId` (lexicographic). |
| `appliedAt` | Local apply / sync-visibility time. Each device assigns this when it inserts the row. Incremental sync cursors (`timestampAppliedLast`) are high-water marks of `appliedAt`, not `createdAt`. |
| `supersededAt` | Set when a later write covers the same path. Superseded rows are not pulled unless history is preserved. |

### Hybrid logical clock

`createdAt` and `supersededAt` come from a per-database hybrid logical clock: `max(now(), last + 1)`. Receiving a change **observes** its `createdAt`, so a later local edit always orders after a change this device has already seen. That fixes the common skew case where device B is a few minutes ahead, A applies B's edit, then A's next edit would otherwise get a *lower* wall-clock time and lose.

`appliedAt` is a separate strictly monotonic local sequence, stamped immediately before the SQL insert. It looks like a timestamp so existing watermarks need no migration, but it does not go backward when the system clock jumps (NTP step, sleep, restart).

### Clock skew expectation

Devices are expected to keep wall clocks within **5 minutes** of each other. Handshake already rejects peers outside that window (`CLOCK_SKEW_TOLERANCE_MS`). Incoming changes whose `createdAt` is more than **10 minutes** ahead of local now (`CHANGE_TIMESTAMP_TOLERANCE_MS`) are skipped and do not advance the local clock. The wider bound covers allowed handshake skew plus a little hybrid-clock lead on multi-hop sync.

A device that once wrote far-future `createdAt` values (mis-set clock) repairs those rows locally on startup and on the periodic resync interval, then they propagate with sane timestamps.

Truly concurrent edits (neither device saw the other's write) remain last-write-wins on `createdAt`. That is inherent to the model, not a clock bug.

### How changes travel between devices

Each device does not push to every peer it is connected to. Per group, it **elects** a small set of *preferred* connections that together reach every known device (a greedy cover; on a fully meshed LAN that is usually one peer). A device pushes a "changes exist" notify to its preferred peers and to the peers that have chosen *it*, and it only acts on notifies from that same priority set. Everyone else receives the change transitively.

Elections run when a connection is added or a preferred one drops, and every `RESYNC_INTERVAL` (60 s) as a safety net; the same tick pulls once from each preferred peer, which is a cheap watermark check when nothing changed. Because a device learns that a peer depends on it only by reading that peer's election result, two devices that connect at the same moment can each elect before the other has finished. To close that gap the election is **re-run shortly after a new connection settles** (`ELECTION_SETTLE_DELAYS_MS`, 10 s and 30 s later), and when a device discovers a new dependent it pulls from it once and sends it one notify. In practice a freshly connected device is fully wired into the group within tens of seconds; the resync tick bounds the worst case at about a minute.

## Reactivity and `dataChanged`

When rows are inserted, updated, or deleted, the table emits **`dataChanged`** so UIs and other subscribers can refresh or patch local state. Under the hood that uses the shared **named event** system (`Emitter` / `emit`).

In the **Electron** shell, the renderer does not write the canonical database directly: change notifications may arrive from the **main** process over the same RPC channel as other client calls. How those events are named, subscribed to, and (for performance) **selectively forwarded** to the client is documented in **[Events](./Events)**.

## Related topics

- **[Events](./Events)** — `subscribe`, `emit`, multi-process forwarding, prefix subscriptions
- **[Variables](./Variables)** — persistent observables (`deviceVar`, `userVar`, …) backed by the `PersistentVars` table
