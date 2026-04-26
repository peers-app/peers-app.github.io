# Table Definitions as Tracked Data

## Task
Read `design/table-definitions-as-tracked-data.md` and plan out how to implement it.

## Problem Statement
Syncing is flaky because table definitions (schemas) may not exist on a receiving peer when changes arrive. Currently, table schemas are only available if the corresponding package has been synced and loaded first. This creates a chicken-and-egg problem: we need the table schema to apply changes, but the schema comes from a package that may not have been synced yet.

## Current Architecture

### How it works today:
1. **System tables** (Users, Groups, etc.) are registered at import time via `registerSystemTableDefinition()` into a global `systemTableDefinitions` map
2. **Package tables** are registered when `PackageLoader.loadPackage()` runs - it executes the package bundle and calls `tableContainer.registerTableDefinition()` for each `ITableDefinition`
3. **SyncGroup** tries to sync Packages first (lines 375-384 of sync-group.ts), then reloads them via `PackagesTrackedDataSource.applyChanges()` so table definitions get registered before other changes arrive
4. **applyChanges()** calls `tableContainer.getAllTables()` which instantiates all registered tables, then throws if a table isn't found

### Where it breaks:
- Package bundles may fail to load (missing file, code error, incompatible version)
- Package sync may not complete before other changes referencing those tables arrive
- First-time sync has no packages at all - everything depends on the package sync completing first
- `getAllTables()` only knows about tables from loaded packages + system tables

## Proposed Solution

### Core Idea
Create a new system table `TableDefinitions` that stores `ITableMetaData` objects. When any table is instantiated, its definition is automatically saved to `TableDefinitions`. This table is synced like any other tracked data, so peers automatically learn about table schemas without needing the full package installed.

### Implementation Plan

#### Phase 1: Create the TableDefinitions system table

**New file: `peers-sdk/src/data/table-definitions.ts`**
- Define `ITableDefinitionRecord` type with fields:
  - `tableId` (primary key) - same as `ITableMetaData.tableId`
  - `name` - table name
  - `metaData` - full `ITableMetaData` object serialized as JSON (object field)
  - `versionNumber` - a unix timestamp (Date.now()) manually set by the developer in the table definition; doubles as the "last updated" indicator
- Define metaData, schema, and register as system table
- Create accessor function `TableDefinitions(dataContext?)` following the pattern of other tables

#### Phase 2: Auto-save table definitions on instantiation

**Modify: `peers-sdk/src/data/orm/table-container.ts`**
- In `getTable()`, after a table is created (and only on the server side), save/upsert its `ITableMetaData` into the `TableDefinitions` table
- Need to be careful about:
  - Not saving during initial setup before TableDefinitions itself is ready
  - Not creating infinite recursion (TableDefinitions table saving its own definition)
  - Only saving if the `versionNumber` has actually changed

**Version conflict prevention** (design doc concern: "old version doesn't update the table definition back to the old schema"):
- Developers must set a `versionNumber` field on `ITableMetaData` using `Date.now()` as a unix timestamp
- When saving a definition, compare `versionNumber`: higher value always wins
- When receiving a synced definition, only apply it if its `versionNumber` is greater than the currently registered one
- This is simple, explicit, and deterministic - no heuristics needed

#### Phase 3: Use TableDefinitions during sync

**Modify: `peers-device/src/sync-group.ts`**
- In the sync flow, sync `TableDefinitions` changes early (right after Files and Packages, or even before Packages)
- After applying TableDefinitions changes, register the new definitions with `tableContainer` so they're available for subsequent change application

**Modify: `peers-sdk/src/data/orm/table-container.ts`**  
- Add a method like `registerFromTableDefinitionRecord()` that takes an `ITableDefinitionRecord` and registers it (without a custom constructor - just the base `Table` class)
- Modify `applyChanges()` in sync-group.ts: if a table is not found, check `TableDefinitions` before throwing

#### Phase 4: Handle schema updates on existing tables

**The concern:** What happens when a table definition is updated and the SQLite table needs migration?

- `SQLDataSource.ensureTableIsNewest()` already handles this well - it compares the CREATE TABLE SQL and migrates if different
- When we receive an updated `TableDefinition` via sync:
  1. Register the new definition in `tableContainer` (overwriting the old one)
  2. Delete the old table instance so it gets re-created with the new schema
  3. On next access, `getTable()` re-creates it, which triggers `SQLDataSource.ensureTableIsNewest()` for migration
- For changes arriving that were created on the old schema:
  - `set` operations (full writes) work fine - they contain the full record
  - `delete` operations work fine
  - `patch-text` operations work fine if the field still exists
  - The only problem is if a change references a field that was **removed** - but we're planning to enforce "no column removal" (see Phase 5)

#### Phase 5: Schema evolution rules (optional/careful)

The design doc raises enforcing schema modification rules:
- **No deleting columns** (includes renames)
- **No adding required columns without simple defaults**

**Recommendation:** Don't enforce these as hard errors yet. The existing migration code in `ensureTableIsNewest()` already handles this gracefully with `globalDefaultValues()`. Instead:
- Log a **warning** when a schema change removes columns or adds required columns without defaults
- The existing migration code already provides safe defaults for new required fields
- This gives users flexibility while surfacing potential issues

### Sync Order Update

Current sync order in `applyChanges()` (line 482-490):
```
Users → Devices → Groups → PersistentVars → PeerTypes → Packages → Files → everything else
```

New sync order:
```
Users → Devices → Groups → PersistentVars → PeerTypes → Packages → TableDefinitions → Files → everything else
```

And in the main sync flow (before the cursor loop), add TableDefinitions to the pre-sync alongside Files and Packages:
```
Files → Packages → TableDefinitions → (cursor loop for everything else)
```

### Key Design Decisions

1. **TableDefinitions is a system table** - not a package table. It's always available.
2. **Only `ITableMetaData` is stored** - not the Zod schema or constructor. Those are nice-to-haves from packages but not needed for basic table creation and sync.
3. **Version/conflict resolution** - developers manually set `versionNumber` (unix timestamp via `Date.now()`). Higher value always wins. Simple and deterministic.
4. **No enforcement of schema rules** (initially) - just warnings. The existing migration handles edge cases.
5. **No custom table constructors** from TableDefinitions - tables created from synced definitions use the base `Table` class. Custom behavior requires the full package.

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `peers-sdk/src/data/table-definitions-table.ts` | **Create** | New system table for storing table definitions |
| `peers-sdk/src/data/orm/table-container.ts` | **Modify** | Auto-save definitions, add method to register from records |
| `peers-device/src/sync-group.ts` | **Modify** | Sync TableDefinitions early, use as fallback for missing tables |
| `peers-device/src/main.ts` | **Modify** | May need to update data source factory priority |

### Risk Assessment

- **Low risk:** Creating the TableDefinitions table, storing definitions
- **Medium risk:** Changing sync order - need to test that this doesn't break existing flows
- **Low risk:** Version conflict prevention - explicit developer-set timestamps are deterministic
- **Low risk:** Schema migration on update - leverages existing tested code

## Notes
- The `tableId` field on `ITableMetaData` is optional (system tables don't have one), so we need a strategy for system tables. Since system tables are always registered via code, they don't need to be in `TableDefinitions`. We can skip saving tables without a `tableId`.
- `getFullTableName()` combines `name` and `tableId` (e.g., `MyTable_abc123`), so `tableId` is important for uniqueness of package tables.
