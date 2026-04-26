# Insert Changes: Reference Current Record Instead of Storing Full Value

## Problem

In `TrackedDataSource`, insert changes are stored as `{op: 'set', path: '/', value: {fullRecord}}` — the entire record is persisted as a JSON blob in the changes table at insert time. This causes two problems:

1. **DB size doubling** — Every tracked record is stored twice: once in its source table and once as a JSON value in the changes table. Since most data is tracked, this roughly doubles database size.

2. **Schema drift** — If a record was inserted under an old schema and the schema later changes, peers syncing that insert change may fail because the stored value has a stale shape. (This is largely addressed by syncing table definitions as tracked data first — see `table-definitions-as-tracked-data.ai.md` — but eliminating stale snapshots removes the risk entirely.)

## Solution

Stop storing the full record value in the insert change record. Instead, store a sentinel (e.g. `null` or omit the value), and **resolve it from the source table at `listChanges` query time** on the sending peer.

### What changes

**On insert (`_insert`):**
- Create the change record as today, but with `value: null` instead of `value: data`.
- The record is still inserted into the source table as normal.

**On `listChanges` / `cursorChanges` (the read path):**
- After querying the changes table, identify insert changes (`op: 'set', path: '/'`) that have a sentinel value.
- Batch-lookup the corresponding records from the source table by `recordId`.
- Populate `change.value` with the looked-up record before returning.
- Consumers of `listChanges` see no API change — the value field is always populated.

**On `applyChanges` (the receive path):**
- No change needed. The receiving peer gets fully-populated change records (resolved by the sender) and processes them exactly as today.

### What doesn't change

- The `IChangeRecord` interface — `value` is still present on the type.
- All consumers of changes (e.g. `PVarsTrackedDataSource.applyChanges`, `SyncGroup`, etc.) — they still read `change.value` and it's always populated.
- Granular update changes (`path: '/fieldName'`) — these continue to store their values inline since they're small.
- Delete changes — unchanged.

## Why This Is Safe

**Insert value reflects current state, not original state — and that's fine.** The looked-up value will be the current record (with all updates applied), not the record as it was at insert time. This is safe because:

- All granular update changes are `set` operations with concrete values (not deltas/increments), so re-applying them on a base that already has those values is **idempotent**.
- The superseding logic ensures only the most recent change per path is active — older changes to the same field are already pruned.
- The sync system's goal is eventual consistency. Peers always converge on the latest state regardless of the base they start from.

**Deleted records don't cause lookup failures.** When a record is deleted, the delete change supersedes the insert change (`supersededAt` is set). Superseded changes are filtered out of `listChanges` results, so the insert change for a deleted record is never returned and never needs a lookup.

## Implementation Notes

### Efficient batch lookups in `listChanges`

This is the critical implementation detail. A naive approach (one lookup per insert change) would be expensive when syncing many records. Instead:

1. Query changes from the changes table as today.
2. Collect all `recordId` values from insert changes that need resolution.
3. Do a single batch query: `SELECT * FROM [table] WHERE [primaryKey] IN (...)`.
4. Map results back onto the change records.

For `cursorChanges`, the same batching should be done per page/chunk of the cursor iteration.

### Migration

Existing insert changes in the changes table already have `value` populated. Leave existing values in place. They still work. But delete them as part of the database compaction logic

### Affected code

- `TrackedDataSource._insert` — stop writing full record to `value`
- `TrackedDataSource.listChanges` — add batch lookup for insert change values
- `TrackedDataSource.cursorChanges` — same for cursor variant
- Tests in `tracked-data-source.test.ts` — update expectations for insert change `value`
