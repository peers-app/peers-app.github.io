---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection4.md'
---
# DI Integration for events.ts (Table Events)

## Current Implementation
Tables use `Emitter` and `Event` from events.ts to notify subscribers of data changes:

```typescript
// In table.ts
this.dataChangedEmitter = new Emitter(this.tableName + "_DataChanged");
this.dataChanged = this.dataChangedEmitter.event;

// Usage
Messages().dataChanged.subscribe(event => { ... });
```

## The Problem
Each peers-sdk instance creates its own event emitters. When peers-electron and peers-device both create `Messages()` tables, they get different `dataChanged` events even if using the same underlying data.

## Minimal DI Solution

### 1. Event Registry in Container
```typescript
// src/di/event-registry.ts
export class EventRegistry {
  private emitters = new Map<string, Emitter<any>>();
  
  getEmitter<T>(eventName: string): Emitter<T> {
    if (!this.emitters.has(eventName)) {
      this.emitters.set(eventName, new Emitter<T>(eventName));
    }
    return this.emitters.get(eventName)!;
  }
}

// src/di/tokens.ts
export const TOKENS = {
  // ... existing
  EventRegistry: Symbol('EventRegistry'),
};
```

### 2. Update Table Constructor (Minimal Change)
```typescript
// src/data/orm/table.ts
export class Table<T extends { [key: string]: any }> {
  constructor(
    public readonly metaData: ITableMetaData,
    schema: z.AnyZodObject | undefined,
    public readonly dataSource: IDataSource<T>,
    private eventRegistry?: EventRegistry  // Optional parameter
  ) {
    // ... existing code

    if (this.eventRegistry) {
      // Get shared emitter from registry
      this.dataChangedEmitter = this.eventRegistry.getEmitter(this.tableName + "_DataChanged");
    } else {
      // Fallback to current behavior
      this.dataChangedEmitter = new Emitter(this.tableName + "_DataChanged");
    }
    this.dataChanged = this.dataChangedEmitter.event;
  }
}
```

### 3. Update TableFactory
```typescript
// src/data/orm/table-factory.ts
@Injectable(TOKENS.DataSourceFactory, TOKENS.EventRegistry)
export class TableFactory {
  constructor(
    private dataSourceFactory: DataSourceFactory,
    private eventRegistry: EventRegistry
  ) {}

  public getTable<T>(...): Table<T> {
    // ... existing logic
    table = new TableClass(metaData, schema, dataSource, this.eventRegistry);
  }
}
```

### 4. Register in Container
```typescript
// src/di/setup.ts
export function createContainer(dataSourceFactory?: DataSourceFactory): DIContainer {
  const container = new DIContainer();
  
  container.register(TOKENS.EventRegistry, () => new EventRegistry());
  container.register(TOKENS.DataSourceFactory, dataSourceFactory || defaultDataSourceFactory);
  container.register(TOKENS.TableFactory, TableFactory);
  
  return container;
}
```

## Result
- Multiple peers-sdk instances using the same container share the same event emitters
- `Messages().dataChanged` in peers-electron and peers-device subscribe to the same event
- Zero breaking changes to existing subscriber code
- Events.ts core classes remain unchanged

## Usage (Unchanged)
```typescript
// This continues to work exactly the same
Messages().dataChanged.subscribe(event => {
  console.log('Message changed:', event.dataObject);
});
```

The shared EventRegistry ensures all table instances with the same name use the same emitter, solving the cross-package event isolation problem.
