# SQLite Transaction Support for Batched Writes

## Overview

This document describes the transaction support added to enable batched database writes across the peers-app ecosystem. The primary motivation was to dramatically improve the performance of `TrackedDataSource.applyChanges()` during sync operations.

## Problem

The `applyChanges` method previously performed many individual write operations:
- Individual inserts in loops for change records
- Individual saves/deletes for data records
- Batch operations that still committed separately

Each write incurred SQLite transaction overhead. With large sync batches, this resulted in hundreds of milliseconds of latency.

## Solution

Leverage SQLite's native transaction support to batch all writes into a single atomic transaction:
1. **Single commit** instead of one per write
2. **Atomicity** - all changes succeed or all fail together
3. **Performance** - disk I/O batched, WAL journal writes once

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TrackedDataSource                        │
│                    (applyChanges)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   SQLDataSource                             │
│        (bulkInsert, bulkSave, bulkDelete)                   │
│        (insertSync, updateSync, deleteSync, saveSync)       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                      ISqlDb                                 │
│   (runInTransaction, execSync, getSync, allSync)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────────┐
    │DBServer │ │ DBLocal │ │ DBServer RN │
    │(electron)│ │(device) │ │(react-native)│
    └─────────┘ └─────────┘ └─────────────┘
          │           │           │
          ▼           ▼           ▼
    better-sqlite3   better-sqlite3   expo-sqlite
    .transaction()   .transaction()   .withTransactionSync()
```

## API Changes

### ISqlDb Interface (`peers-sdk/src/data/orm/sql-db.ts`)

```typescript
export interface ISqlDb {
  // Existing async methods
  get: (sql: string, params?: any) => Promise<any>;
  all: (sql: string, params?: any) => Promise<any[]>;
  exec: (sql: string, params?: any) => Promise<void>;
  close: () => Promise<void>;

  // New: Synchronous versions for use within transactions
  execSync?: (sql: string, params?: any) => void;
  getSync?: (sql: string, params?: any) => any;
  allSync?: (sql: string, params?: any) => any[];

  // New: Transaction wrapper
  runInTransaction?: <R>(fn: () => R) => R;
}
```

### SQLDataSource (`peers-sdk/src/data/orm/sql.data-source.ts`)

New synchronous methods for use within transactions:
- `insertSync(record: T): T`
- `updateSync(record: T): T`
- `deleteSync(idOrRecord: string | T): void`
- `saveSync(record: T): T`

New bulk methods that use transactions internally:
- `bulkInsert(records: T[]): Promise<T[]>`
- `bulkDelete(ids: string[]): Promise<void>`
- `bulkSave(records: T[]): Promise<T[]>`

### ChangeTrackingTable (`peers-sdk/src/data/change-tracking.ts`)

New synchronous methods:
- `insertSync(record: IChangeRecord): IChangeRecord`
- `updateSync(record: IChangeRecord): IChangeRecord`
- `batchMarkSupersededSync(updates: Array<{changeId, supersededAt}>): void`
- `deleteChangesSync(changeIds: string[]): void`
- `deleteSupersededChangesOlderThanSync(tableName, beforeTimestamp): void`

New bulk method:
- `bulkInsert(records: IChangeRecord[]): Promise<IChangeRecord[]>`

## Implementation Details

### Electron (`peers-electron/src/server/db-server.ts`)

Uses `better-sqlite3-multiple-ciphers` native transaction API:

```typescript
public runInTransaction<R>(fn: () => R): R {
  const transaction = this.db.transaction(fn);
  return transaction();
}
```

### Device/Tests (`peers-device/src/local.data-source.ts`)

Same implementation as Electron using `better-sqlite3-multiple-ciphers`.

### React Native (`peers-react-native/host/db-server.ts`)

Uses `expo-sqlite`'s `withTransactionSync`:

```typescript
public runInTransaction<R>(fn: () => R): R {
  let result: R;
  this.db.withTransactionSync(() => {
    result = fn();
  });
  return result!;
}
```

## TrackedDataSource.applyChanges Refactoring

The `_applyChanges` method was refactored to:

1. **Collect phase**: Process all changes and determine final states (unchanged)
2. **Queue phase**: Collect all write operations to execute
3. **Execute phase**: Run all writes in a single transaction

```typescript
// Collect all write operations
const recordsToSave: T[] = [];
const recordsToDelete: string[] = [];
const changesToInsert: IChangeRecord[] = [];

// ... processing logic ...

// Execute in single transaction
db.runInTransaction(() => {
  for (const record of recordsToSave) {
    underlyingDataSource.saveSync(record);
  }
  for (const recordId of recordsToDelete) {
    underlyingDataSource.deleteSync(recordId);
  }
  for (const change of changesToInsert) {
    changeTrackingTable.insertSync(change);
  }
  // ... superseded changes handling ...
});
```

A fallback `_applyChangesNonTransactional` method handles databases without transaction support.

## Performance Results

Test results from `tracked-data-source.test.ts`:

```
Applied 60 changes in 6ms
```

Previously this would have taken 60+ individual transactions, each with disk sync overhead.

## Backward Compatibility

- All new methods are **optional** in the ISqlDb interface
- Bulk methods include **fallbacks** for databases without transaction support
- Existing code continues to work unchanged

## Usage Examples

### Direct Transaction Use

```typescript
// Ensure database is open first
await db.exec('SELECT 1');

// Run multiple operations atomically
db.runInTransaction(() => {
  db.execSync('INSERT INTO users VALUES (?)', ['user1']);
  db.execSync('INSERT INTO users VALUES (?)', ['user2']);
  db.execSync('UPDATE counters SET count = count + 2');
});
```

### Bulk Operations

```typescript
// Insert many records efficiently
const records = generateRecords(100);
await dataSource.bulkInsert(records);

// Save (insert or update) many records
await dataSource.bulkSave(modifiedRecords);

// Delete many records
await dataSource.bulkDelete(idsToDelete);
```

## Testing

Transaction tests are in `peers-device/src/tracked-data-source.test.ts`:

- `should support runInTransaction on DBLocal`
- `should apply multiple changes in a single transaction via applyChanges`
- `should handle large batches of changes efficiently`
- `should bulk insert changes correctly`
- `should handle mixed insert/update/delete in applyChanges transaction`
- `should support sync methods on SQLDataSource`
- `should support bulkSave on SQLDataSource`

## Files Modified

| File | Changes |
|------|---------|
| `peers-sdk/src/data/orm/sql-db.ts` | Added ISqlDb transaction methods |
| `peers-electron/src/server/db-server.ts` | Implemented transaction methods |
| `peers-device/src/local.data-source.ts` | Implemented transaction methods |
| `peers-react-native/host/db-server.ts` | Implemented transaction methods |
| `peers-sdk/src/data/orm/sql.data-source.ts` | Added sync + bulk methods |
| `peers-sdk/src/data/change-tracking.ts` | Added sync + bulk methods |
| `peers-device/src/tracked-data-source.ts` | Refactored applyChanges |
| `peers-device/src/tracked-data-source.test.ts` | Added transaction tests |

