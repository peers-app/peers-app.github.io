---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection8.md'
---
# RPC Registry - Backward Compatibility Challenge

## The Problem with Global Exports

```typescript
// This gets evaluated at module import time, before any injection
export const rpcServerCalls = getRPCServerCalls(); // ❌ Always uses default registry
```

**Issue:** By the time injection happens, existing code already has references to the default registry objects.

## Potential Solutions

### Option 1: Function Exports (Your Suggestion)
```typescript
// Change from object to function
export const rpcServerCalls = getRPCServerCalls; // Function, not invocation

// All client code must change
await rpcServerCalls().tableGet(tableName, id); // ❌ Breaking change
```

**Pros:** Reliable resolution to injected state
**Cons:** Major breaking change for all RPC usage

### Option 2: Proxy Objects with Late Binding
```typescript
// Create proxy that delegates to current registry
export const rpcServerCalls = new Proxy({}, {
  get(target, prop) {
    const registry = getCurrentRPCRegistry(); // Gets current injected registry
    return registry.getServerCall(prop as string);
  }
});

// Usage stays the same
await rpcServerCalls.tableGet(tableName, id); // ✅ No breaking change
```

**Pros:** Zero breaking changes, reliable late binding
**Cons:** Slightly more complex, runtime overhead

### Option 3: Registry on TableFactory (Minimal Client Changes)
```typescript
// Add RPC access to existing TableFactory pattern
export function getTableFactory() {
  return {
    getTable: ...,
    rpcServerCalls: createRPCServerProxy(this.rpcRegistry),
    rpcClientCalls: createRPCClientProxy(this.rpcRegistry)
  };
}

// Client code updates minimally
const { rpcServerCalls } = getTableFactory();
await rpcServerCalls.tableGet(tableName, id);
```

**Pros:** Leverages existing injection pattern, minimal changes
**Cons:** Still requires some client code updates

### Option 4: Ambient RPC (Like Ambient DI)
```typescript
let _globalRPCRegistry: RPCRegistry | undefined;

export function setGlobalRPCRegistry(registry: RPCRegistry): void {
  _globalRPCRegistry = registry;
  // Update the proxy targets
  updateRPCProxies(registry);
}

// Existing exports use proxies that update when registry changes
export const rpcServerCalls = createUpdatableRPCProxy('server');
export const rpcClientCalls = createUpdatableRPCProxy('client');
```

**Pros:** Zero breaking changes, follows ambient DI pattern
**Cons:** Most complex implementation

## Recommendation: Option 2 (Proxy Objects)

**Why:** 
- Zero breaking changes to client code
- Reliable resolution to injected registry
- Relatively simple implementation
- Runtime overhead is minimal for RPC calls

**Implementation:**
```typescript
function createRPCServerProxy(getRegistry: () => RPCRegistry) {
  return new Proxy({} as any, {
    get(target, prop: string) {
      return getRegistry().getServerCall(prop);
    }
  });
}

export const rpcServerCalls = createRPCServerProxy(() => getGlobalRPCRegistry());
```

This preserves the existing API while ensuring RPC calls always resolve to the currently injected registry, even if injection happens after module import.
