# Type IR & Codegen (DRAFT)

> Referenced by: [Package Contracts v2](./package-contracts-v2.md)

## Problem

Contracts need to be pure data — serializable, storable, transferable, sandbox-safe. But developers want typed access (`tasks.tables.Tasks` returning `Table<ITask>`) with autocomplete and compile-time checking. These two goals conflict: pure data can't carry TypeScript types, and Zod schemas (which do carry types) are executable code.

**Solution:** An intermediate representation (IR) for types that is pure data, plus a codegen tool that generates TypeScript types from it.

## Type IR

The IR is a JSON-serializable description of a type. It extends the existing `IField` / `FieldType` system to be expressive enough to represent any type a contract might need.

```typescript
// A complete type definition — pure data, no code
interface ITypeDefinition {
  name: string                    // "ITask", "TaskStatus"
  kind: 'record' | 'enum'
  fields?: ITypeField[]           // for records
  values?: string[]               // for enums
}

// A single field in a record type
interface ITypeField {
  name: string
  type: ITypeRef
  optional?: boolean
  description?: string
}

// A reference to a type — recursive, composable
type ITypeRef =
  | { kind: 'primitive', type: 'string' | 'number' | 'boolean' | 'date' | 'id' | 'any' }
  | { kind: 'enum', name: string }           // reference to a named enum
  | { kind: 'array', items: ITypeRef }
  | { kind: 'object', fields: ITypeField[] } // inline nested object
  | { kind: 'record', name: string }         // reference to a named record type
  | { kind: 'map', values: ITypeRef }        // Record<string, T>
```

### Example: Tasks contract types as IR

```json
{
  "types": [
    {
      "name": "TaskStatus",
      "kind": "enum",
      "values": ["Queued", "In-Progress", "Done", "Canceled", "Backlog"]
    },
    {
      "name": "ITask",
      "kind": "record",
      "fields": [
        { "name": "taskId", "type": { "kind": "primitive", "type": "id" } },
        { "name": "title", "type": { "kind": "primitive", "type": "string" } },
        { "name": "status", "type": { "kind": "enum", "name": "TaskStatus" } },
        { "name": "sortOrder", "type": { "kind": "primitive", "type": "number" } },
        { "name": "dueDT", "type": { "kind": "primitive", "type": "date" }, "optional": true },
        { "name": "completeDT", "type": { "kind": "primitive", "type": "date" }, "optional": true },
        { "name": "createdAt", "type": { "kind": "primitive", "type": "date" } },
        { "name": "groupId", "type": { "kind": "primitive", "type": "id" } }
      ]
    }
  ]
}
```

This is pure data. It can be stored in SQLite, synced between peers, serialized to JSON, and inspected without executing any code.

### Relationship to IField

The existing `IField` / `FieldType` system is a simpler version of this IR. The IR supersedes it for contract definitions but stays backward compatible — an `IField[]` can be losslessly converted to `ITypeField[]` and vice versa (with some loss for types IField can't express like nested objects or enums).

```
IField[]  ←→  ITypeField[]  (lossless for simple types)
IField[]   →  ITypeField[]  (always works)
ITypeField[] → IField[]     (lossy for complex types — enums become strings, nested objects become 'object')
```

The runtime continues to use `IField[]` internally for table metadata. The IR is the richer format used in contract definitions.

## Contract Definitions with IR

Contracts include type definitions as pure data:

```typescript
interface IContractDefinition {
  contractId: string
  version: number
  tag?: string
  name: string
  description: string

  types?: ITypeDefinition[]          // NEW: type definitions as IR
  tables?: IContractTable[]
  tools?: IContractTool[]
  observables?: IContractObservable[]
}

interface IContractTable {
  name: string
  description: string
  primaryKeyName: string
  recordType: string                 // references a named ITypeDefinition
}

interface IContractTool {
  name: string
  usageDescription: string
  inputType?: string                 // references a named ITypeDefinition
  outputType?: string                // references a named ITypeDefinition
}
```

Tables and tools reference types by name. The types themselves are defined once in the `types` array.

## Codegen

A CLI tool generates TypeScript from contract IR:

```bash
peers contract generate-types            # generates types for all installed contracts
peers contract generate-types <path>     # generates types from a specific contract file
```

### Generated Output

From the tasks contract IR above, the tool generates:

```typescript
// generated/tasks-contract.d.ts

export enum TaskStatus {
  Queued = 'Queued',
  'In-Progress' = 'In-Progress',
  Done = 'Done',
  Canceled = 'Canceled',
  Backlog = 'Backlog',
}

export interface ITask {
  taskId: string
  title: string
  status: TaskStatus
  sortOrder: number
  dueDT?: Date
  completeDT?: Date
  createdAt: Date
  groupId: string
}

// Typed contract proxy — used with pkg.consumes()
export interface TasksContractV1 {
  tables: {
    Tasks: Table<ITask>
  }
  tools: {
    'new-task': { input: INewTaskInput, output: INewTaskOutput }
  }
  observables: {
    taskCount: Observable<number>
  }
}
```

### Consumer Usage

```typescript
import type { TasksContractV1 } from './generated/tasks-contract'

export function definePackage(pkg: PackageBuilder) {
  const tasks = pkg.consumes<TasksContractV1>(tasksContractId, 1)

  tasks.tables.Tasks           // Table<ITask> — fully typed
  tasks.observables.taskCount  // Observable<number>
}
```

The generic type parameter on `consumes<T>` types the returned proxy. At runtime it's still a Proxy resolving from the contract registry. The generated types are purely compile-time — they add zero runtime cost and require no code execution.

### Fallback (no codegen)

If a consumer doesn't generate types (or is working dynamically), everything still works untyped:

```typescript
const tasks = pkg.consumes(tasksContractId, 1)
tasks.tables.Tasks             // Table<any>
tasks.tables['Tasks']          // also Table<any>
```

## Authoring Contracts

### How do contract authors define the IR?

Writing raw IR JSON is tedious. Authors should be able to define types naturally and have the IR extracted. Options:

**Option A: Write Zod schemas, extract IR at build time**

Authors write Zod schemas (which they're already doing for table definitions). A build step extracts the IR from the schemas before bundling. The Zod schemas never leave the author's dev environment — only the IR is published.

```typescript
// Author writes this (source)
const taskSchema = z.object({
  taskId: zodPeerId,
  title: z.string(),
  status: z.nativeEnum(TaskStatus),
})

// Build tool extracts this (published)
// → ITypeDefinition { name: 'ITask', fields: [...] }
```

**Option B: Write IR directly with helpers**

SDK provides helper functions that make IR authoring ergonomic:

```typescript
import { types } from '@peers-app/peers-sdk'

const TaskStatus = types.enum('TaskStatus', ['Queued', 'In-Progress', 'Done', 'Canceled', 'Backlog'])

const ITask = types.record('ITask', {
  taskId: types.id,
  title: types.string,
  status: types.ref(TaskStatus),
  dueDT: types.optional(types.date),
})
```

These helpers produce pure data (ITypeDefinition objects), not executable schemas. They're just ergonomic constructors.

**Option C: Both**

Support Zod-based authoring with IR extraction for existing packages, and IR helpers for new packages. Converge on IR helpers over time.

### Recommendation

Start with **Option B** (IR helpers). It's the simplest path that stays true to the "contracts are pure data" principle. Authors don't need Zod at all for contract definitions — the helpers are lightweight pure-data constructors. Zod is still used internally by the runtime for validation, but it's an implementation detail.

## Validation at Runtime

The runtime converts IR type definitions to Zod schemas internally for validation:

```
IR (ITypeDefinition[])  →  Zod schemas (runtime, internal)  →  validate data
```

This is a one-way conversion that happens inside the Peers runtime. Package authors and consumers never see Zod. The IR is the source of truth.

## Open Questions

- **How deep should the IR go?** Unions, intersections, generics? Start minimal (primitives, enums, arrays, objects, maps) and extend as needed.
- **Versioning of the IR itself** — if we add new type kinds, how do older runtimes handle them?
- **Should the codegen tool also generate Zod schemas** for consumers who want runtime validation in their own code?
- **Where do generated files live?** A `generated/` directory? Inside `node_modules`? A `.peers/` directory?

## Summary

| Layer | Format | Purpose |
|-------|--------|---------|
| Contract storage | IR (pure JSON data) | Serializable, sandbox-safe, storable, syncable |
| Contract authoring | IR helpers or Zod extraction | Ergonomic definition |
| Consumer DX | Generated `.d.ts` files | Typed access, autocomplete |
| Runtime validation | Zod schemas (internal) | Data validation on save/sync |

The IR is the single source of truth. Everything else is derived from it.
