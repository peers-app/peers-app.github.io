# Package Contracts v2

## Problem

Packages currently reference each other's tables and tools by hardcoded IDs. This creates tight coupling — upgrading, replacing, or swapping a package can break consumers. We need an abstraction layer so packages interact through stable, versioned interfaces rather than concrete implementations.

## Core Concept

A **Contract** is a versioned interface definition — like a TypeScript interface or a REST API spec. It declares the shape of tables, tools, and observables without any implementation. Packages **provide** (implement) contracts and **consume** (depend on) contracts. The Peers runtime resolves consumers to providers at the group level.

```
Consumer Package  →  Contract (interface)  ←  Provider Package
                         ↑
                    Another Provider
```

Multiple packages can provide the same contract. A group picks which provider to use. Swapping providers is safe because both conform to the same contract.

## Package Definition (Builder API)

Every package exports a `definePackage` function. The builder ensures that every package defines at least one contract, and that the contract definition and implementation are a single step — no redundant declarations.

```typescript
// package.ts
export function definePackage(pkg: PackageBuilder) {
  // Define and implement a contract in one step
  const tasks = pkg.contract(tasksContractId, 1)
  tasks.tables = [tasksTableDefinition]
  tasks.tools = [newTaskToolInstance, editTaskToolInstance]
  tasks.observables = [taskCountObservable]

  // Declare backward compatibility with prior versions (for when you're on v2+)
  tasks.alsoImplements(tasksContractId, { from: 1, to: 3 })  // implements v1, v2, v3
  tasks.alsoImplements(otherContractId, 2)                    // single version also works

  // Declare consumption of another package's contract
  pkg.consumes(knowledgeContractId, 1)

  // Package-level items (not part of any contract — direct assignment)
  pkg.assistants = [myAssistant]
  pkg.appNavs = [{ name: 'Tasks', iconClassName: 'bi bi-list-task', navigationPath: 'app' }]
}
```

When the builder function returns, the runtime:
1. Extracts the contract shape from each `pkg.contract()` (fields, schemas, signatures)
2. Builds the `IPeersPackage` implementation (registers tables, tools, etc.)
3. Freezes the contract (if not beta) — stores the shape so future versions are validated against it

Contract names are extracted from the implementations themselves — `metaData.name` for tables, `tool.name` for tools. No redundant string parameters. A single table definition simultaneously:
- Defines the table's shape in the contract (extracted from its fields/schema)
- Maps it as a provider implementation
- Registers it in the package for the runtime

### Multiple Contracts

A package can define and implement multiple contracts. Each `pkg.contract()` returns a scoped builder:

```typescript
export function definePackage(pkg: PackageBuilder) {
  const tasks = pkg.contract(tasksContractId, 2)
  tasks.alsoImplements(tasksContractId, 1)
  tasks.tables = [tasksTableDefinition]
  tasks.tools = [newTaskToolInstance]

  const notes = pkg.contract(notesContractId, 1)
  notes.tables = [notesTableDefinition]
  notes.tools = [newNoteToolInstance]

  pkg.assistants = [myAssistant]
}
```

### Implementing External Contracts

A package can implement contracts defined by other packages using `alsoImplements`. This is how you build a drop-in replacement:

```typescript
export function definePackage(pkg: PackageBuilder) {
  // Define our own contract
  const fancyTasks = pkg.contract(fancyTasksContractId, 1)
  fancyTasks.tables = [fancyTasksTableDefinition]  // has extra fields: priority, tags, etc.
  fancyTasks.tools = [fancyNewTaskToolInstance]

  // Also satisfy all versions of the original tasks contract
  fancyTasks.alsoImplements(tasksContractId, { from: 1, to: 3 })
}
```

The runtime validates that `fancyTasksTableDefinition` is a superset of every version in the range — all required fields present with matching types for each of tasks:v1, tasks:v2, and tasks:v3. If any version fails validation, the error identifies which version and what's missing.

## Contract Shape

The contract shape is automatically extracted from the implementation and stored as pure data (no executable code). Types are represented using a data-only IR (intermediate representation) that is JSON-serializable, storable, and sandbox-safe. Consumers get TypeScript types via codegen from this IR.

> See [Type IR & Codegen](./type-ir-codegen.md) for the full IR specification, codegen tool design, and authoring workflow.

```typescript
interface IContractDefinition {
  contractId: string           // peerId (same format as all other IDs in Peers)
  version: number              // 1, 2, 3... integer, each version is independent
  tag?: string                 // 'beta' = mutable. Absent = frozen
  name: string                 // Human-readable: "Task Management"
  description: string

  types?: ITypeDefinition[]    // Type definitions as pure-data IR
  tables?: IContractTable[]
  tools?: IContractTool[]
  observables?: IContractObservable[]
}

// Table shape — references a named type from the types array
interface IContractTable {
  name: string                 // Logical name: "Tasks"
  description: string
  primaryKeyName: string
  recordType: string           // references a named ITypeDefinition
}

// Tool signature — references named types for input/output
interface IContractTool {
  name: string                 // Logical name: "new-task"
  usageDescription: string
  inputType?: string           // references a named ITypeDefinition
  outputType?: string          // references a named ITypeDefinition
}

// Observable — a single reactive value
interface IContractObservable {
  name: string                 // Logical name: "taskCount"
  description: string
  valueType: ITypeRef          // pure-data type reference
  writable: boolean            // Can consumers write to it?
}
```

### Typed Consumer Access

When types are available (via codegen), consumers get fully typed access:

```typescript
import type { TasksContractV1 } from './generated/tasks-contract'

const tasks = pkg.consumes<TasksContractV1>(tasksContractId, 1)
tasks.tables.Tasks              // Table<ITask> — fully typed, autocomplete works
tasks.observables.taskCount     // Observable<number>
```

When types aren't available, everything still works untyped:

```typescript
const tasks = pkg.consumes(tasksContractId, 1)
tasks.tables.Tasks              // Table<any>
```

## Versioning

Contract versions are **integers** (1, 2, 3...) with an optional **tag** for pre-release.

```typescript
pkg.contract(contractId, 1, 'beta')    // v1 beta — mutable, can change between builds
pkg.contract(contractId, 1)            // v1 stable — frozen on return
```

A version number is always required. New packages should start at version 1 with the `'beta'` tag, then drop the tag when they're ready to commit.

### Rules

- **Versions must be positive integers** (1, 2, 3...). No decimals — each version is a distinct, independent contract. Use the `'beta'` tag for iteration within a version.
- **Version + `'beta'` tag:** Contract is mutable. Can be installed in a group, but consumers are warned it may change. Good for iterating before committing. This is the default for new packages.
- **Version + no tag (stable):** Contract is **frozen permanently**. The shape is stored and all future versions of the package are validated against it. This is the commitment point.
- `{contractId, version}` is a unique key — once a stable version is published, it cannot be changed
- New versions are completely independent — `tasks:v2` doesn't need to resemble `tasks:v1`
- Conventionally, new versions evolve from prior versions (like API v1 → v2), but this is not enforced
- `contractId` is a peerId (consistent with all other IDs in Peers — prevents collisions between independently authored contracts)

### Lifecycle

```
beta (version + 'beta')  →  stable (version, no tag)
       mutable                     frozen forever
     installable                  installable
```

## Consuming Contracts

A consumer declares what contracts it depends on:

```typescript
export function definePackage(pkg: PackageBuilder) {
  pkg.consumes(tasksContractId, 1)

  const projects = pkg.contract(projectsContractId, 1)
  projects.tables = [projectsTableDefinition]
  projects.tools = [{
    tool: newProjectTool,
    toolFn: async (args) => {
      // Access tasks through the contract — not by hardcoded table ID
      const tasks = peers.contract(tasksContractId, 1)
      const tasksTable = tasks.table<ITask>('Tasks')

      const project = await Projects().save({ name: args.name })
      await tasksTable.save({
        title: `Setup: ${args.name}`,
        status: 'Queued',
        groupId: args.groupId,
      })
      return project
    }
  }]
}
```

At runtime, the consumer accesses contract capabilities through a typed proxy (see [Type IR & Codegen](./type-ir-codegen.md)):

```typescript
// With generated types — fully typed, autocomplete
const tasks = pkg.consumes<TasksContractV1>(tasksContractId, 1)
tasks.tables.Tasks.save({ title: 'Hello', ... })     // Table<ITask>
tasks.tools['new-task'].run({ title: 'Hello' })
tasks.observables.taskCount()                          // Observable<number>
tasks.observables.taskCount.subscribe(v => {})

// Without generated types — untyped fallback
const tasks = pkg.consumes(tasksContractId, 1)
tasks.tables.Tasks.save({ title: 'Hello', ... })     // Table<any>
```

## Contract Lifecycle

### Providing

When a package is installed in a group:
1. Runtime checks each contract defined by the package
2. Validates the implementation satisfies the contract shape (fields, schemas)
3. Registers the package as a provider for that contract in the group
4. If another provider already exists for the same contract, the user chooses which to activate (only one active provider per contract per group)

### Consuming

When a package is installed:
1. Runtime checks each `consumes` declaration
2. Verifies an active provider exists for each required contract in the group
3. If a required contract has no provider, installation fails with a clear error

### Upgrading/Replacing

- **Upgrade a provider**: Install new version. Runtime validates it still satisfies all contracts it claims to provide. If it drops a contract, warn the user about affected consumers
- **Replace a provider**: Install alternative package that provides the same contract (via `alsoImplements`). Swap the active provider. Consumer code doesn't change because it uses contract IDs, not package IDs
- **Remove a provider**: Runtime checks if any installed consumer depends on its contracts. Block removal if consumers exist (or warn/confirm)

## Runtime Resolution

The Peers runtime maintains a contract registry per group:

```typescript
// Internal — managed by the runtime
interface IContractRegistry {
  getProvider(contractId: string, version: number): IResolvedContract | undefined
}

interface IResolvedContract {
  contractId: string
  version: number
  providerPackageId: string
  tables: Record<string, Table<any>>           // contract name → live Table instance
  tools: Record<string, IToolInstance>         // contract name → live tool
  observables: Record<string, Observable<any>> // contract name → live observable
}
```

The `peers.contract(id, version)` call that consumers use is a convenience wrapper around this registry.

## Validation

On package install/update, the runtime validates:

**Provider validation:**
- Every field in the contract table exists in the implementation table (extra fields OK if they are optional or have default values)
- Field types match
- Every tool in the contract exists with compatible input/output schemas (input - extra optional fields okay, output - extra fields okay)
- Every observable in the contract exists with a compatible value type 
- If the contract marks an observable as writable, the implementation must support writes

**Consumer validation:**
- Every consumed contract has an active provider in the group

**Contract immutability:**
- If a stable contract definition already exists (same contractId + version, no tag), the new definition must be identical
- Beta contracts can change freely

**`alsoImplements` validation:**
- Accepts a single version (`alsoImplements(id, 3)`) or a range (`alsoImplements(id, { from: 1, to: 5 })`)
- The implementation must be a superset of **every version** in the range
- All required fields, tools, and observables from each referenced contract version must be present with compatible types
- Validation errors identify the specific version and missing element

## Example: Full Package

```typescript
import { tasksContractId } from './consts'
import { tasksTableDefinition } from './data/tasks'
import { newTaskToolInstance } from './tools/new-task'
import { taskCountObservable } from './observables'
import { taskAssistant } from './assistants'

export function definePackage(pkg: PackageBuilder) {
  // Define the tasks contract at v1
  const tasks = pkg.contract(tasksContractId, 1)
  tasks.tables = [tasksTableDefinition]
  tasks.tools = [newTaskToolInstance]
  tasks.observables = [taskCountObservable]

  // Package-level items (not part of the contract)
  pkg.assistants = [taskAssistant]
  pkg.appNavs = [{ name: 'Tasks', iconClassName: 'bi bi-list-task', navigationPath: 'app' }]
}
```

The runtime extracts the contract shape (table fields, tool schemas, observable types) and stores it. The full implementation (indexes, code, toolFn) stays in the package.

## What This Doesn't Cover (Yet)

- **Contract discovery/marketplace** — how users find contracts and providers
- **Migration between providers** — data migration when swapping one provider for another
- **Contract inheritance** — one contract extending another
- **Access control** — which packages can provide which contracts
- **Inter-package events** — deliberately omitted for now. Reactive table subscriptions (`dataChanged`) cover the same use cases since consumers can subscribe to contract tables. The older “Peer Events” tables (`PeerEventTypes` / `PeerEventHandlers` / `PeerEvents`) were removed for the same reason—they did not map to distributed semantics. Can be added later if a real need emerges
- **Optional dependencies** — a `consumesOptional` that returns a nullable handle for contracts that enhance but aren't required. Currently all consumed contracts are required.
- **UI contracts** — the current design only covers tables, tools, and observables. UI routes/components may need their own contract mechanism

## Summary

| Concept | What it is |
|---------|-----------|
| Contract | Versioned interface (table shapes, tool signatures, observables) |
| Builder | `definePackage` function that defines contracts and implementation in one step |
| Provider | Package that implements a contract |
| Consumer | Package that depends on a contract |
| `alsoImplements` | Declaration that a contract implementation also satisfies another contract |
| Registry | Per-group mapping of contract → active provider |
| Resolution | Runtime lookup: contract ID → provider's actual implementation |
| Versioning | Integer versions. No tag = frozen. `'beta'` tag = mutable. No version = draft/dev only |

The key invariant: **consumers never reference providers directly**. All cross-package interaction goes through contracts. This makes packages safely upgradeable, replaceable, and swappable.
