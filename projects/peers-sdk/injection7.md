---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection7.md'
---
# RPC Registry Solution Plan

## Current Problem

`rpcServerCalls` and `rpcClientCalls` are global objects that get mutated when handlers are registered:

```typescript
export const rpcServerCalls = {
  ping: async (msg: string) => `pong: ${msg}`,
  tableGet: rpcStub('tableGet') as (tableName: string, id: string) => Promise<any>,
  // ... other handlers
};

export const rpcClientCalls = {
  ping: async (msg: string) => `pong: ${msg}`, 
  emitEvent: rpcStub('emitEvent') as ((event: IEventData) => Promise<boolean>),
  // ... other handlers
};
```

**Issue:** Multiple peers-sdk instances overwrite each other's RPC handlers.

## Solution: RPC Registry Pattern

Follow the same pattern as EventRegistry - create a registry that manages shared RPC handlers.

### 1. Create RPCRegistry Class
```typescript
// src/rpc/rpc-registry.ts
export class RPCRegistry {
  private serverCalls = new Map<string, Function>();
  private clientCalls = new Map<string, Function>();
  
  setServerCall(name: string, handler: Function): void
  getServerCall(name: string): Function
  setClientCall(name: string, handler: Function): void  
  getClientCall(name: string): Function
}
```

### 2. Update TableFactory Integration
```typescript
export class TableFactory {
  private readonly eventRegistry = new EventRegistry();
  private readonly rpcRegistry = new RPCRegistry();
  
  constructor(dataSourceFactory: DataSourceFactory) {}
}
```

### 3. Create RPC Accessor Functions
```typescript
// Replace global objects with functions that use shared registry
export function getRPCServerCalls(registry?: RPCRegistry) {
  const rpc = registry || getGlobalRPCRegistry();
  return createRPCServerProxy(rpc);
}

export function getRPCClientCalls(registry?: RPCRegistry) {
  const rpc = registry || getGlobalRPCRegistry();  
  return createRPCClientProxy(rpc);
}
```

### 4. Maintain Backward Compatibility
```typescript
// Keep existing exports working
export const rpcServerCalls = getRPCServerCalls();
export const rpcClientCalls = getRPCClientCalls();
```

## Implementation Steps

1. Create RPCRegistry class with handler management
2. Add RPCRegistry to TableFactory (piggyback on existing DI)
3. Create proxy objects that delegate to shared registry
4. Update existing global exports to use shared registry
5. Test cross-package RPC handler sharing

## Benefits

- RPC handlers shared across package instances
- Zero breaking changes to existing code
- Follows established EventRegistry pattern
- Leverages existing TableFactory sharing mechanism
