---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection.md'
---
# Simple Isomorphic DI System for peers-sdk

## Current Problems

1. **Module instantiation coupling**: Functions like `Messages()`, `PersistentVars()` are immediately dependent on `getTableFactory()` being set
2. **Global singleton state**: `_tableFactory` creates tight coupling and prevents multiple instances
3. **Cross-package conflicts**: When peers-ui, peers-electron, etc. all import peers-sdk, they create separate instances but fight over the same global state
4. **Timing dependencies**: Tables and persistentVars are instantiated at module import time, making dependency injection impossible

## Recommended DI Architecture

### Core DI Container

```typescript
// src/di/container.ts
type Constructor<T = any> = new (...args: any[]) => T;
type Factory<T = any> = (...args: any[]) => T;
type Token = string | symbol | Constructor;

export class DIContainer {
  private instances = new Map<Token, any>();
  private factories = new Map<Token, Factory | Constructor>();
  private singletons = new Set<Token>();

  register<T>(token: Token, factory: Factory<T> | Constructor<T>, singleton = true): void {
    this.factories.set(token, factory);
    if (singleton) this.singletons.add(token);
  }

  resolve<T>(token: Token): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No factory registered for token: ${String(token)}`);
    }

    const instance = typeof factory === 'function' && factory.prototype 
      ? new (factory as Constructor<T>)(...this.resolveDependencies(factory))
      : (factory as Factory<T>)(...this.resolveDependencies(factory));

    if (this.singletons.has(token)) {
      this.instances.set(token, instance);
    }

    return instance;
  }

  private resolveDependencies(target: any): any[] {
    return (target.inject || []).map((dep: Token) => this.resolve(dep));
  }
}
```

### Injectable Decorator

```typescript
// src/di/injectable.ts
export function Injectable(...deps: Token[]) {
  return function <T extends Constructor>(target: T) {
    (target as any).inject = deps;
    return target;
  };
}

export const TOKENS = {
  DataSourceFactory: Symbol('DataSourceFactory'),
  TableFactory: Symbol('TableFactory'),
  Container: Symbol('Container'),
} as const;
```

### Refactored Table System

```typescript
// src/data/orm/table-factory.ts (refactored)
@Injectable(TOKENS.DataSourceFactory)
export class TableFactory {
  constructor(private dataSourceFactory: DataSourceFactory) {}
  // ... existing implementation
}

// src/data/messages.ts (refactored)
export function createMessagesAccessor(container: DIContainer) {
  return () => container.resolve<TableFactory>(TOKENS.TableFactory)
    .getTable<IMessage>(metaData, messageSchema);
}

// Usage: const Messages = createMessagesAccessor(container);
```

### Container Setup

```typescript
// src/di/setup.ts
export function createContainer(dataSourceFactory?: DataSourceFactory): DIContainer {
  const container = new DIContainer();
  
  // Register core services
  container.register(TOKENS.DataSourceFactory, dataSourceFactory || defaultDataSourceFactory);
  container.register(TOKENS.TableFactory, TableFactory);
  
  return container;
}

export function createDefaultClientContainer(): DIContainer {
  return createContainer(() => new ClientProxyDataSource());
}
```

### Integration Pattern

```typescript
// In consuming packages (peers-ui, peers-electron, etc.)
import { createDefaultClientContainer, TOKENS } from 'peers-sdk/di';

export class PeersUI {
  private container: DIContainer;
  
  constructor(container?: DIContainer) {
    this.container = container || createDefaultClientContainer();
  }
  
  get messages() {
    return this.container.resolve<TableFactory>(TOKENS.TableFactory)
      .getTable(messageMetaData, messageSchema);
  }
}

// Usage:
const sharedContainer = createDefaultClientContainer();
const ui = new PeersUI(sharedContainer);
const electron = new PeersElectron(sharedContainer);
```

## Migration Strategy

### Phase 1: Add DI Infrastructure
- Create DI container and injectable decorator
- Add container setup utilities
- Keep existing global functions working

### Phase 2: Refactor Core Services  
- Convert TableFactory to use DI
- Update table creation to accept container
- Maintain backward compatibility

### Phase 3: Update Data Access Patterns
- Replace `Messages()` with `container.resolve(Messages)`
- Convert persistentVar to accept container
- Update consuming packages

### Phase 4: Remove Globals
- Remove global `_tableFactory`
- Remove `getTableFactory()` and `setTableFactory()`
- Complete migration

## Benefits

1. **True isolation**: Each package instance gets its own dependency graph
2. **Testability**: Easy to inject mocks and test dependencies
3. **Flexibility**: Different environments can configure different data sources
4. **Isomorphic**: Works in browser, React Native, and Node.js
5. **Type safety**: Full TypeScript support with proper typing
6. **Minimal complexity**: Simple container without reflection dependencies
7. **Backward compatibility**: Gradual migration path

## Key Design Decisions

- **No reflect-metadata**: Explicit dependency declaration for React Native compatibility
- **Constructor injection only**: Simpler than property injection
- **Token-based**: Supports interfaces and abstract types
- **Singleton by default**: Matches current behavior for tables
- **Container passing**: Explicit container passing instead of global lookup
- **Factory functions**: For tables that need specific instantiation logic

This approach solves the module instantiation problem by making dependencies explicit and injectable, while maintaining the simplicity and isomorphic nature required for peers-sdk.
