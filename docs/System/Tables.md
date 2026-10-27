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

## Values in object and array fields

A top-level field is stored by its declared type: a `Date` as ISO text, a `boolean` as 0/1, and a `string` or `number` as itself. Object and array fields are stored as JSON text written by Peers' serializer (`toJSONString` / `fromJSONString` in `@peers-app/peers-sdk`). The same serializer carries change values between devices and RPC arguments between processes. It keeps these values that plain JSON can't:

| In your value | Comes back as |
| --- | --- |
| `Date` | `Date` |
| `Uint8Array`, `Buffer` | the same type |
| `undefined`, `NaN`, `Infinity` | the same value (an `undefined` key is kept) |
| `RegExp` | `RegExp` |
| `Error` | `Error` whose `stack` is the original stack (its `message` and other properties aren't kept) |
| a key starting with `$` | the same key |

An object or array that appears more than once in a value, including a cycle, comes back shared in the same way. That holds within one value only (one field, one change, one message), so two fields of a row that held the same object come back as two equal copies.

What doesn't survive storage:

- `Map` and `Set` become `{}`, and class instances become plain objects.
- `-Infinity` becomes `null`, and `-0` becomes `0`.
- `BigInt` values and invalid Dates throw when the row is saved.
- Symbol values are dropped (inside an array, a Symbol becomes `null`), and so are `__proto__` keys. A function is stored as its source text and comes back as a `"__FUNCTION …"` string.
- A string that spells one of the serializer's markers comes back as the marked value. For example, `"__UNDEFINED"` becomes `undefined`, and `"__DATE tomorrow"` becomes an invalid Date. Until the serializer escapes these, don't store arbitrary user text that starts with two underscores inside object or array fields.
- Keys named `__this_ref` or starting with `__DOLLAR_`, and a first array element that starts with `__this_ref:`, are reserved for the serializer's own bookkeeping and don't come back as written.

A field whose schema Peers can't map to one of its types, such as `z.record()`, `z.union()` or `z.any()`, is written the same way, but reads currently return the stored text rather than the value: an object comes back as its JSON, and a number or boolean as a string. Use `z.object()` or an array for structured data until that's fixed.

## Local-only tables

A table whose metadata sets `localOnly` keeps its rows on the device that writes them. Peers records no change rows for it, so nothing about its rows syncs. System tables such as console logs, sync bookkeeping and workflow runs work this way.

For package tables, the schema still syncs through `TableDefinitions`. So every device in the group has its own, separate copy, and a device keeps the table out of sync even before it loads the package that declared it.

An isolated package declares one by setting `localOnly: true` on a `manifest.tables` entry (see **[Package contracts](../Packages/contracts#isolated-contract-packages-electron)**). Whether a table syncs is the provider's choice and isn't part of any contract: a contract can expose a local-only table like any other, and a consumer reads the copy on its own device.

A later schema version can switch a table either way. Changing the flag is a schema change, so it needs a higher `versionNumber`.

- **Synced to local-only:** each device keeps the rows it has and stops sending the table's changes once it has the new definition. It deletes its change rows for the table when it loads the table under that definition; a device that doesn't run the package keeps them, unsent.
- **Local-only to synced:** when a device loads the table under the new definition, it records its existing rows with a near-zero timestamp, so they sync but any real write wins. Where two devices hold a row with the same primary key, one copy wins. A device still on the older version doesn't apply the table's changes from other devices; it gets them on a later sync, after it loads the newer version. A device that kept change rows from before the table went local-only (because it never loaded that version) sends them with their original timestamps, so its copy of those rows wins.

## Sync timestamps and conflict resolution

Non-`localOnly` tables are wrapped in a tracked data source. Writes do not last-write-wins on a row-level `modifiedAt`. They append **change-log rows** (`ChangeTrackingV2`) and peers exchange those rows.

| Field | Role |
| --- | --- |
| `createdAt` | Author write time. Last-write-wins across devices. Equal times break ties with `changeId` (lexicographic). |
| `appliedAt` | Local apply / sync-visibility time. Each device assigns this when it inserts the row. Incremental sync cursors (`timestampAppliedLast`) are high-water marks of `appliedAt`, not `createdAt`. |
| `supersededAt` | Set when a later write covers the same path. Superseded rows are not pulled unless history is preserved. |

### What a change row holds

An insert, a restore, or a save with `saveAsSnapshot` records one row at path `/` for the whole record. Its value is read from the table when changes are listed, so it is not stored twice. An update records one row per changed path (a JSON Patch of the old and new record), and each row's value is encoded and decoded on its own.

A record whose fields share one object, such as a tool whose `inputSchema` and `outputSchema` are the same object, is compared as if each field held its own copy. Nothing is recorded when equal copies become one shared object. A cycle can't be split into separate rows, so an update that adds one is recorded as a root snapshot.

Older versions could split a shared object from its reference into separate rows. Peers then decoded the reference to `{}`, and schema validation could [park the record](./Network-Diagnostics.md#automatic-record-recovery) for good. At startup, the device that wrote such rows (the only one that keeps them in that form) records each affected record again as a root snapshot from its own row. Peers rebuild the record from that snapshot on their next sync.

### Hybrid logical clock

`createdAt` and `supersededAt` come from a per-database hybrid logical clock: `max(now(), last + 1)`. Receiving a change **observes** its `createdAt`, so a later local edit always orders after a change this device has already seen. That fixes the common skew case where device B is a few minutes ahead, A applies B's edit, then A's next edit would otherwise get a *lower* wall-clock time and lose.

`appliedAt` is a separate strictly monotonic local sequence, stamped immediately before the SQL insert. It looks like a timestamp so existing watermarks need no migration, but it does not go backward when the system clock jumps (NTP step, sleep, restart).

### Clock skew expectation

Devices are expected to keep wall clocks within **5 minutes** of each other. Handshake rejects peers outside that window (`CLOCK_SKEW_TOLERANCE_MS`). Incoming changes whose `createdAt` is more than **10 minutes** ahead of local now (`CHANGE_TIMESTAMP_TOLERANCE_MS`) are excluded from active history and materialized data, so a bad timestamp cannot pin a field ahead of every subsequent correctly timed edit. The wider bound covers allowed handshake skew plus a little hybrid-clock lead on multi-hop sync.

Exclusion blocks the source device's sync watermark from advancing. The sync is reported as failed/degraded, and the source offers the same rows again on the next pull. Valid rows from the same batch are still applied idempotently. This avoids both timestamp poisoning and the previous silent-loss failure, where the watermark advanced past rows the receiver had discarded.

A receiver can otherwise confuse "the author's clock is ahead" with "my clock is behind". The second case occurs when a phone sleeps because `performance.now()` may not advance while an iOS page is suspended. `getTimestamp()` therefore re-anchors to `Date.now()` when those clocks diverge. Once the receiver has re-anchored, its next pull accepts the previously excluded rows and advances the watermark normally.

Stored `createdAt` values are never rewritten locally. A change's `changeId` and `createdAt` are its identity for last-write-wins on every device, and peers that already hold a row ignore a re-sent copy. Restamping one copy would therefore make devices order the same change differently. On startup the write clock is seeded from the largest `createdAt` that is not far in the future, so a stored bad row cannot push later local writes forward. Repairing records genuinely authored under a bad wall clock requires an explicit distributed repair operation rather than an in-place timestamp update.

Truly concurrent edits (neither device saw the other's write) remain last-write-wins on `createdAt`. That is inherent to the model, not a clock bug.

### How changes travel between devices

Each device does not push to every peer it is connected to. Per group, it **elects** a small set of *preferred* connections that together reach every known device (a greedy cover; on a fully meshed LAN that is usually one peer). A device pushes a "changes exist" notify to its preferred peers and to the peers that have chosen *it*, and it only acts on notifies from that same priority set. Everyone else receives the change transitively.

Elections run when a connection is added or a preferred one drops, and every `RESYNC_INTERVAL` (60 s) as a safety net; the same tick pulls once from each preferred peer, which is a cheap watermark check when nothing changed. Because a device learns that a peer depends on it only by reading that peer's election result, two devices that connect at the same moment can each elect before the other has finished. To close that gap the election is **re-run shortly after a new connection settles** (`ELECTION_SETTLE_DELAYS_MS`, 10 s and 30 s later), and when a device discovers a new dependent it pulls from it once and sends it one notify. In practice a freshly connected device is fully wired into the group within tens of seconds; the resync tick bounds the worst case at about a minute.

If a group temporarily stops syncing while its devices remain connected, current Peers versions resume syncing automatically. Recovery usually starts within a minute; repeated interruptions can delay it by up to 10 minutes. Keep participating devices up to date. You don't need to reconnect or restart for a group to resume syncing.

### Post-sync runtime work

Applying synced rows is separate from runtime side effects that depend on several tables. Those effects are coalesced while pages are applied and run only after the sync watermark is durable. For example, `Packages`, `PackageVersions`, and `Files` may arrive in different pages; package activation evaluates their final combined state once instead of loading every intermediate version. A runtime load failure is reported as a package warning and does not roll back synchronized rows or freeze the peer watermark.

If a far-future row blocks watermark advancement, reconciliation for sane rows already accepted from that pull is flushed before the sync reports its degraded state. Retrying the same range is idempotent.

## Signed rows

Identity and permission tables (`Users`, `Groups`, `GroupMembers`, `Packages`, `PackageVersions`) carry a `signature` column of the form `publicKey:signature`. The row is signed with `addSignatureToObject` and checked with `verifyObjectSignature` (both in `@peers-app/peers-sdk`) before a remote write is accepted, so a device cannot forge another user's record.

The signature covers a **canonical JSON** form of the row, not whatever key order the object happened to have when it was built: keys are sorted at every level and keys whose value is `null` or `undefined` are dropped. This matters because a signed row is read back from SQLite in schema column order with `NULL` columns as `undefined`, and it is reordered again by msgpack and object spreads on the wire. None of that changes the signed bytes, so an optional field that is absent, `null`, or `undefined` verifies the same way. Extended types (`Date`, `Buffer`, `Uint8Array`) are encoded the same way the ORM stores them.

Verification also accepts the pre-canonical (insertion-order) form, so rows signed by older builds keep verifying without being re-signed. New signatures are always canonical. That fallback is one-way: an old verifier rejects a canonical signature whose key order differs from what it expects. Deploy `peers-services` (and confirm the Azure workflow succeeded) before shipping any client that produces the new form. `full-release.js` waits for that deploy before releasing `peers-electron`; see [Releasing](./Releasing.md).

### Placeholders never overwrite

A device often learns of a user before it has that user's signed row: a connection handshake, an invite identity, or a join approval carries only `userId` and public keys. Those are written as **unsigned placeholders** with `save(user, { weakInsert: true })`, which gives the change a near-zero timestamp so any real write wins last-write-wins.

`weakInsert` alone only protects the *insert* case. `UsersTable` therefore also marks every unsigned weak save `insertOnly` (an `ISaveOptions` flag): if a row for that user already exists, the save returns it untouched instead of updating it. The decision is made inside the data source's serialized write path, not by the caller's earlier `get`, because the owner's signed row can land in between (a sync apply, or the owner's own device copying its identity into a group) and a plain update would replace it with an unsigned snapshot carrying a fresh timestamp that then out-votes the signed row on every device. The visible symptom of that race was remote contract calls failing with `unverified caller identity` even though the caller was a group member.

Each user's own device writes its **signed** row into every group it belongs to with a normal (non-weak) timestamp, so members always end up holding the verifiable record.

## Reactivity and `dataChanged`

When rows are inserted, updated, or deleted, the table emits **`dataChanged`** so UIs and other subscribers can refresh or patch local state. Under the hood that uses the shared **named event** system (`Emitter` / `emit`).

In the **Electron** shell, the renderer does not write the canonical database directly: change notifications may arrive from the **main** process over the same RPC channel as other client calls. How those events are named, subscribed to, and (for performance) **selectively forwarded** to the client is documented in **[Events](./Events)**.

## Related topics

- **[Events](./Events)** — `subscribe`, `emit`, multi-process forwarding, prefix subscriptions
- **[Variables](./Variables)** — persistent observables (`deviceVar`, `userVar`, …) backed by the `PersistentVars` table
