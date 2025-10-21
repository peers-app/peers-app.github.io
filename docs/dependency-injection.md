# Dependency Injection Refactor Plan

## Overview
Replace the current DataContext "god object" pattern with a simple, lightweight DI system that makes table extension easy while eliminating circular dependencies.

## Core Design Principles

1. **Simple Constructor Signatures**: Custom tables should only need `(metaData, deps)`
2. **Explicit Dependencies**: No hidden coupling or circular references  
3. **Easy Testing**: Simple to mock dependencies
4. **No External Libraries**: Built with plain TypeScript

## Implementation Steps

### Step 1: Define Dependency Interfaces

Create clear contracts for what each component needs:

```typescript
// src/data/orm/table-dependencies.ts
export interface TableDependencies {
  dataSource: IDataSource<any>;
  eventRegistry: EventRegistry;
  schema: z.AnyZodObject;
}

export interface DataContextDependencies {
  userContext: UserContext;
  groupId?: string;
  dataSourceFactory?: DataSourceFactory;
}
```

### Step 2: Refactor Table Constructor

Update Table to use explicit dependency injection:

```typescript
// src/data/orm/table.ts
export class Table<T extends { [key: string]: any }> implements IDataSource<T> {
  public readonly tableName: string;
  public readonly primaryKeyName: string;
  public readonly schema: z.AnyZodObject;
  protected readonly dataChangedEmitter: Emitter<IDataChangedEvent<T>>;
  public readonly dataChanged: Event<IDataChangedEvent<T>>;
  public readonly dataSource: IDataSource<T>;

  constructor(
    public readonly metaData: ITableMetaData,
    protected readonly deps: TableDependencies
  ) {
    // Move all initialization logic here
    this.dataSource = deps.dataSource;
    this.tableName = getFullTableName(metaData);
    this.schema = deps.schema;
    this.primaryKeyName = metaData.primaryKeyName;
    
    // Event setup
    const eventName = this.tableName + "_DataChanged";
    this.dataChangedEmitter = deps.eventRegistry.getEmitter(eventName);
    this.dataChanged = this.dataChangedEmitter.event;
    
    // Rest of initialization...
  }
}
```

### Step 3: Create Dependency Factory

Transform DataContext into a pure dependency factory:

```typescript
// src/context/data-context.ts
export class DataContext {
  private _eventRegistry: EventRegistry;
  private _tableFactory: TableFactory;

  constructor(
    public readonly userContext: UserContext,
    public readonly groupId?: string,
    public readonly dataSourceFactory: DataSourceFactory = userContext.dataSourceFactory
  ) {
    // No circular dependencies - initialize in order
    this._eventRegistry = new EventRegistry(this.dataContextId);
    this._tableFactory = new TableFactory(this);
  }

  public get dataContextId(): string {
    return this.groupId || this.userContext.userId();
  }

  public get eventRegistry(): EventRegistry {
    return this._eventRegistry;
  }

  public get tableFactory(): TableFactory {
    return this._tableFactory;
  }

  // Factory method for table dependencies
  public createTableDependencies<T>(metaData: ITableMetaData, schema?: z.AnyZodObject): TableDependencies {
    return {
      dataSource: this.dataSourceFactory(metaData, schema, this.groupId),
      eventRegistry: this._eventRegistry,
      schema: schema || fieldsToSchema(metaData.fields)
    };
  }

  // Convenience method for creating tables
  public createTable<T extends { [key: string]: any }>(
    metaData: ITableMetaData,
    schema?: z.AnyZodObject,
    TableClass: new (metaData: ITableMetaData, deps: TableDependencies) => Table<T> = Table as any
  ): Table<T> {
    const deps = this.createTableDependencies(metaData, schema);
    return new TableClass(metaData, deps);
  }
}
```

### Step 4: Update TableFactory

Simplify TableFactory to use the DI pattern:

```typescript
// src/data/orm/table-factory.ts
export class TableFactory {
  private readonly tableDefinitions: { [tableId: string]: ITableDefinition<any> } = {};
  private tableInstances: { [tableName: string]: Table<any> } = {}

  constructor(
    private readonly context: DataContext
  ) { }

  public getTable<T extends { [key: string]: any }>(
    metaData: ITableMetaData,
    schema?: z.AnyZodObject,
    tableConstructor?: TableConstructor<T>
  ): Table<T> {
    const tableName = getFullTableName(metaData);
    
    if (!this.tableInstances[tableName]) {
      // Use context's factory method
      const TableClass = tableConstructor || Table<T>;
      this.tableInstances[tableName] = this.context.createTable(metaData, schema, TableClass);
    }
    
    return this.tableInstances[tableName] as Table<T>;
  }
}
```

### Step 5: Update Custom Table Pattern

Show how users can now easily extend tables:

```typescript
// Example: Custom table extension becomes simple
export class NotesTable extends Table<INote> {
  constructor(metaData: ITableMetaData, deps: TableDependencies) {
    super(metaData, deps);
    // Only focus on business logic here
    this.setupCustomBehavior();
  }

  private setupCustomBehavior() {
    // Custom initialization without worrying about infrastructure
  }

  // Custom business methods
  async findByTitle(title: string): Promise<INote[]> {
    return this.list({ title });
  }

  async getRecentNotes(days: number = 7): Promise<INote[]> {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.list({ createdAt: { $gte: cutoff } });
  }
}
```

### Step 6: Update Test Patterns

Show how testing becomes easier:

```typescript
// Testing becomes much simpler
describe('NotesTable', () => {
  let table: NotesTable;
  
  beforeEach(() => {
    const mockDeps: TableDependencies = {
      dataSource: new MockDataSource(),
      eventRegistry: new MockEventRegistry(),
      schema: notesSchema
    };
    
    table = new NotesTable(notesMetaData, mockDeps);
  });

  it('should find notes by title', async () => {
    // Test only business logic, infrastructure is mocked
  });
});
```

## Migration Strategy

### Phase 1: Add New Pattern (Non-Breaking)
- Add `TableDependencies` interface
- Add `createTableDependencies()` method to DataContext
- Keep existing constructors working

### Phase 2: Update Internal Usage
- Update TableFactory to use new pattern internally
- Update system tables to use new pattern
- Keep public API unchanged

### Phase 3: Deprecate Old Pattern
- Add deprecation warnings to old constructors
- Update documentation to show new pattern
- Provide migration guide

### Phase 4: Remove Old Pattern
- Remove deprecated constructors
- Clean up circular dependency code
- Simplify DataContext

## Benefits After Implementation

1. **For Users**: Simple `(metaData, deps)` constructor signature
2. **For Testing**: Easy to mock just the `deps` object
3. **For Architecture**: No circular dependencies, explicit relationships
4. **For Maintenance**: Clear separation of concerns, easier to modify

## Files to Modify

1. `src/data/orm/table-dependencies.ts` (new file)
2. `src/data/orm/table.ts` (constructor refactor)
3. `src/context/data-context.ts` (remove circular deps)
4. `src/data/orm/table-factory.ts` (simplify)
5. Test files (update mock patterns)

## Rollback Plan

If issues arise, we can:
1. Keep both constructor patterns during transition
2. Use feature flags to switch between approaches
3. Have fallback logic that uses old pattern if new fails

---

**Would you like to proceed with implementing this step by step? We can start with Step 1 (defining interfaces) and validate the approach before going further.**