---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection2.md'
---
# Maintaining Ergonomics with DI

## The Problem
You're absolutely right - explicit DI container passing destroys the developer experience that makes peers-sdk easy to use. The original `Users().get(myUserId())` is clean and intuitive.

## Solution: Ambient DI with Global Fallback

Keep the original API intact while enabling DI injection:

```typescript
// src/di/ambient.ts
let _globalContainer: DIContainer | undefined;

export function setGlobalContainer(container: DIContainer): void {
  _globalContainer = container;
}

export function getGlobalContainer(): DIContainer {
  if (!_globalContainer) {
    // Auto-create default container for zero-config usage
    _globalContainer = createDefaultClientContainer();
  }
  return _globalContainer;
}
```

## Updated Implementation Pattern

```typescript
// src/data/users.ts (updated)
export function Users(container?: DIContainer): UsersTable {
  const di = container || getGlobalContainer();
  return di.resolve<TableFactory>(TOKENS.TableFactory)
    .getTable<IUser>(metaData, schema) as UsersTable;
}

// src/data/persistent-vars.ts (updated)  
export function persistentVar<T>(name: string, opts?: PersistentVarOptions, container?: DIContainer): PersistentVar<T> {
  const di = container || getGlobalContainer();
  // ... existing logic using di instead of global getTableFactory()
}

export const myUserId = persistentVar('myUserId', { defaultValue: '' });
```

## Usage Patterns

### Simple Usage (unchanged)
```typescript
import { myUserId, Users } from "peers-sdk";

function getMyUserObject() {
  const user = Users().get(myUserId());
  return user;
}
```

### Advanced Usage (explicit DI)
```typescript
import { myUserId, Users, createContainer } from "peers-sdk";

const customContainer = createContainer(customDataSourceFactory);

function getMyUserObject() {
  const user = Users(customContainer).get(myUserId());
  return user;
}
```

### Package-level Configuration
```typescript
// In peers-ui main setup
import { setGlobalContainer, createDefaultClientContainer } from "peers-sdk";

const container = createDefaultClientContainer();
setGlobalContainer(container);

// Now all peers-ui code uses the same container instance
// while still maintaining the simple API
```

## Benefits

1. **Zero breaking changes**: Existing code continues to work unchanged
2. **Simple onboarding**: New users can start immediately without DI knowledge  
3. **DI when needed**: Advanced users can inject custom containers
4. **Shared state**: Multiple packages can share the same container instance
5. **Testability**: Tests can inject mock containers easily

## Migration Strategy

1. Add ambient DI infrastructure
2. Update table/persistentVar functions to accept optional container
3. Keep all existing exports and signatures
4. Consuming packages can opt into shared containers via `setGlobalContainer()`
5. No API changes required for end users

This approach gives you the isolation benefits of DI while preserving the ergonomics that make peers-sdk approachable.
