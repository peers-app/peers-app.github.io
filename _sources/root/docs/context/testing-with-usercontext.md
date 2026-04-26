# Testing with Real UserContext (In-Memory Database)

This guide explains how to create tests that use a real `UserContext` instance backed by an in-memory SQLite database. This approach allows you to test actual code paths without mocking, while keeping tests fast and isolated.

## Why Use Real UserContext in Tests?

- **Tests actual code paths** - No mocking means you're testing real behavior
- **Catches integration issues** - Real interactions between components
- **Fast execution** - In-memory SQLite is very fast
- **Test isolation** - Each test gets a fresh database

## Basic Pattern

The pattern is used in `peers-device/src/connection-manager/connection-manager.test.ts` and `peers-device/src/persistent-vars.test.ts`.

```typescript
import { 
  DataSourceFactory,
  IDataSource,
  ITableMetaData, 
  newid, 
  SQLDataSource,
  UserContext,
} from "@peers-app/peers-sdk";
import { z } from "zod";
import { DBLocal } from "./local.data-source";

async function createTestUserContext(): Promise<UserContext> {
  const userId = newid();
  const deviceId = newid();
  
  // Create in-memory SQLite database
  const db = new DBLocal(':memory:');

  // Create data source factory that uses the in-memory DB
  const dataSourceFactory: DataSourceFactory = (
    metaData: ITableMetaData, 
    schema?: z.AnyZodObject, 
    groupId?: string
  ): IDataSource<any> => {
    return new SQLDataSource(db, metaData, schema);
  };

  // Create real UserContext with ephemeral=true for test mode
  const userContext = new UserContext(userId, dataSourceFactory, true /* ephemeral */);
  
  // Wait for initialization to complete
  await userContext.loadingPromise;
  
  // Set device ID after DB load
  userContext.deviceId(deviceId);
  
  return userContext;
}
```

## Key Points

### 1. Use `DBLocal(':memory:')`

The `:memory:` parameter creates an in-memory SQLite database that exists only for the duration of the test.

```typescript
const db = new DBLocal(':memory:');
```

### 2. Set `ephemeral=true`

The third parameter to `UserContext` constructor enables ephemeral/test mode:

```typescript
const userContext = new UserContext(userId, dataSourceFactory, true /* ephemeral */);
```

This skips certain initialization steps that aren't needed in tests.

### 3. Always await `loadingPromise`

The UserContext has async initialization. Always wait for it:

```typescript
await userContext.loadingPromise;
```

### 4. Set `deviceId` after loading

The device ID should be set after the loading promise resolves:

```typescript
userContext.deviceId(deviceId);
```

## Advanced Pattern: Multiple Databases per Group

For tests that need group-specific databases (like sync tests):

```typescript
async function createTestUserContext(): Promise<UserContext> {
  const userId = newid();
  const deviceId = newid();
  
  // Cache databases by context ID
  const groupDbs: { [dbKey: string]: ISqlDb } = {};
  
  function getDb(dataContextId: string) {
    const dbKey = `${deviceId}_${dataContextId}`;
    if (!groupDbs[dbKey]) {
      groupDbs[dbKey] = new DBLocal(':memory:');
    }
    return groupDbs[dbKey];
  }

  const dataSourceFactory: DataSourceFactory = (
    metaData: ITableMetaData, 
    schema?: z.AnyZodObject, 
    groupId?: string
  ): IDataSource<any> => {
    const dataContextId = groupId || userId;
    const db = getDb(dataContextId);
    return new SQLDataSource(db, metaData, schema);
  };

  const userContext = new UserContext(userId, dataSourceFactory, true);
  await userContext.loadingPromise;
  userContext.deviceId(deviceId);
  
  return userContext;
}
```

## Advanced Pattern: With Change Tracking

For sync-related tests that need change tracking:

```typescript
import { ChangeTrackingTable } from "@peers-app/peers-sdk";
import { TrackedDataSource } from "./tracked-data-source";

async function createTestUserContextWithTracking(): Promise<{
  userContext: UserContext;
  changeTrackingTable: ChangeTrackingTable;
}> {
  const userId = newid();
  const deviceId = newid();
  const db = new DBLocal(':memory:');
  const changeTrackingTable = new ChangeTrackingTable({ db });

  const dataSourceFactory: DataSourceFactory = (
    metaData: ITableMetaData, 
    schema?: z.AnyZodObject, 
    groupId?: string
  ): IDataSource<any> => {
    const sqlDS = new SQLDataSource(db, metaData, schema);
    
    // Skip tracking for local-only tables
    if (metaData.localOnly) {
      return sqlDS;
    }
    
    // Wrap with change tracking for sync
    return new TrackedDataSource(sqlDS, changeTrackingTable);
  };

  const userContext = new UserContext(userId, dataSourceFactory, true);
  await userContext.loadingPromise;
  userContext.deviceId(deviceId);
  
  return { userContext, changeTrackingTable };
}
```

## Example Test

```typescript
describe("My Feature Tests", () => {
  
  it("should do something with UserContext", async () => {
    const userContext = await createTestUserContext();
    
    // Access tables via the data context
    const usersTable = Users(userContext.userDataContext);
    
    // Perform operations
    await usersTable.save({
      userId: userContext.userId,
      name: "Test User",
      publicKey: "...",
      publicBoxKey: "..."
    });
    
    // Verify
    const user = await usersTable.get(userContext.userId);
    expect(user?.name).toBe("Test User");
  });
});
```

## Testing with pvars

For testing persistent variables:

```typescript
import { deviceVar, sleep } from "@peers-app/peers-sdk";

it("should persist a value", async () => {
  const userContext = await createTestUserContext();
  
  const myVar = deviceVar<string>('testVar', { 
    defaultValue: 'initial',
    userContext 
  });
  await myVar.loadingPromise;

  expect(myVar()).toBe('initial');
  
  myVar('updated');
  await sleep(100); // Allow async DB write to complete
  
  expect(myVar()).toBe('updated');
});
```

## Important Notes

1. **File Location**: Tests using `DBLocal` must be in `peers-device` since that's where SQLite bindings are available.

2. **Jest Timeout**: For complex tests, increase the timeout:
   ```typescript
   jest.setTimeout(30_000); // 30 seconds
   ```

3. **Cleanup**: In-memory databases are automatically cleaned up when the test ends. No explicit cleanup needed.

4. **Isolation**: Each call to `createTestUserContext()` creates a completely isolated environment with its own database.

## See Also

- `peers-device/src/connection-manager/connection-manager.test.ts` - Complex example with multiple users
- `peers-device/src/persistent-vars.test.ts` - Simple example for pvar testing
- `peers-device/src/sync-group.test.ts` - Example with SyncGroup and peer connections
