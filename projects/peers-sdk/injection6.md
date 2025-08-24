---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection6.md'
---
# Remaining Global State Conflicts

Now that EventRegistry solves table event sharing, here are the remaining global state issues that will cause conflicts across packages:

## 1. PersistentVars (Highest Priority)

**Problem:** Module-level instantiations create separate instances per peers-sdk package.

```typescript
// Each peers-sdk instance creates its own observables
export const myUserId = persistentVar('myUserId', { defaultValue: '' });
export const thisDeviceId = persistentVar('thisDeviceId', { defaultValue: '' });
export const activeGroupId = persistentVar('activeGroupId', { defaultValue: '' });
export const packagesRootDir = persistentVar('packagesRootDir', { defaultValue: '~/peers-packages' });
export const trustedServers = persistentVar('trustedServers', { defaultValue: [...] });
```

**Impact:** peers-electron and peers-device get different observables for the same persistent data. Changes in one package don't propagate to the other.

## 2. RPC Call Objects (Medium Priority)

**Problem:** Global objects that get mutated when handlers are registered.

```typescript
export const rpcServerCalls = { ... };
export const rpcClientCalls = { ... };
```

**Impact:** Multiple packages may overwrite each other's RPC handlers.

## 3. Memoized Functions (Medium Priority) 

**Problem:** Per-instance memoization doesn't share across packages.

```typescript
export const waitForTableFactory = memoizePromise(async () => new Promise<TableFactory>(...));
```

**Impact:** Different packages wait for different TableFactory instances instead of sharing one.

## 4. Window/Global Assignments (Lower Priority)

**Problem:** Multiple instances overwrite global assignments.

```typescript
// In rpc-types.ts
_window['rpc'] = rpcServerCalls;

// In table.ts  
window[`PeersDB_${metaData.name}`] = this;
```

**Impact:** Last package loaded wins, breaking debugging/development tools.

## Next Steps

**PersistentVars** is the biggest issue - it's fundamental to application state management. Without sharing these, packages can't coordinate on basic things like `myUserId` or `activeGroupId`.

**RPC handlers** are second priority - conflicts here could break communication between client/server components.

The others are lower impact but should eventually be addressed for a clean implementation.
