# Schema Definition Guide

How table schemas are defined in Peers using Zod schemas and IField arrays.

## Overview

Every table in Peers has a schema that defines its columns, types, and validation rules. There are two complementary ways to define a schema:

1. **Zod schema** — TypeScript-first validation with runtime type checking
2. **IField[] array** — Serializable field definitions that can be stored and synced between peers

These two representations are interchangeable and can be used individually or together.

## The Two Representations

### Zod Schema

A [Zod](https://zod.dev/) object schema that provides:
- Static TypeScript type inference via `z.infer<typeof schema>`
- Runtime validation with descriptive error messages
- Rich validation rules (refinements, transforms, defaults)
- Composable with other Zod features

```typescript
import { z } from 'zod';
import { zodPeerId } from '../types/zod-types';

export const taskSchema = z.object({
  taskId: zodPeerId,
  title: z.string().describe('The title of the task'),
  completed: z.boolean().default(false),
  assignedTo: zodPeerId.optional().describe('The user assigned to this task'),
  createdAt: z.date().default(() => new Date()),
  tags: z.string().array().optional(),
});

export type ITask = z.infer<typeof taskSchema>;
```

### IField[] Array

A plain data array describing each field's name, type, and metadata:

```typescript
import { FieldType, IField } from '../types/field-type';

const taskFields: IField[] = [
  { name: 'taskId', type: FieldType.id },
  { name: 'title', type: FieldType.string, description: 'The title of the task' },
  { name: 'completed', type: FieldType.boolean, defaultValue: false },
  { name: 'assignedTo', type: FieldType.id, optional: true, description: 'The user assigned to this task' },
  { name: 'createdAt', type: FieldType.Date },
  { name: 'tags', type: FieldType.string, isArray: true, optional: true },
];
```

The `IField` interface:

```typescript
interface IField {
  name: string;
  type: FieldType;          // 'id' | 'string' | 'number' | 'boolean' | 'Date' | 'object' | 'blob' | 'any'
  description?: string;
  defaultValue?: any;
  optional?: boolean;
  isArray?: boolean;
  subType?: string;
}
```

## Converting Between Representations

### Zod → IField[] (`schemaToFields`)

```typescript
import { schemaToFields } from './orm/types';

const fields: IField[] = schemaToFields(taskSchema);
```

This traverses the Zod schema's internal type tree and maps each property to an `IField`. It detects:
- `zodPeerId` → `FieldType.id` (via the `_fieldType` brand on the Zod definition)
- `z.string()` → `FieldType.string`
- `z.number()` → `FieldType.number`
- `z.boolean()` → `FieldType.boolean`
- `z.date()` → `FieldType.Date`
- `z.object()` → `FieldType.object`
- `z.nativeEnum()` → `FieldType.number` or `FieldType.string` depending on enum values
- Optional, array, default, and description modifiers are all preserved

### IField[] → Zod (`fieldsToSchema`)

```typescript
import { fieldsToSchema } from './orm/types';

const schema = fieldsToSchema(taskFields);
```

This builds a Zod object schema from the field definitions. Each `FieldType` maps to a Zod type, and `FieldType.id` produces a `z.string().refine(isid)` equivalent (with the `_fieldType` brand set).

### Merging: IField[] + Code Schema

When both are provided, `fieldsToSchema` can merge them:

```typescript
const mergedSchema = fieldsToSchema(fields, codeSchema);
```

The merged schema uses `z.intersection()` to combine:
- **Structure** from `IField[]` (what columns exist and their basic types)
- **Validation** from the code schema (refinements, custom validators)
- **Function defaults** from the code schema (e.g., `() => new Date()`) which can't be serialized in `IField[]`

This is how the `Table` class works internally — it always produces a merged schema from the metadata fields and the optional code schema.

## How Tables Use Schemas

### Registering a Table

The standard pattern for defining a system table:

```typescript
import { z } from 'zod';
import { zodPeerId } from '../types/zod-types';
import { ITableMetaData, schemaToFields } from './orm/types';
import { registerSystemTableDefinition } from './orm/table-definitions.system';

// 1. Define the Zod schema (source of truth for types and validation)
export const taskSchema = z.object({
  taskId: zodPeerId,
  title: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
});

export type ITask = z.infer<typeof taskSchema>;

// 2. Create table metadata (fields are derived from the schema)
const metaData: ITableMetaData = {
  name: 'Tasks',
  description: 'Task items',
  primaryKeyName: 'taskId',
  fields: schemaToFields(taskSchema),  // ← Zod → IField[] conversion
  indexes: [
    { fields: ['completed'] },
  ],
};

// 3. Register the table definition
registerSystemTableDefinition(metaData, taskSchema);

// 4. Export accessor function
export function Tasks(dataContext?: DataContext) {
  return getTableContainer(dataContext).getTable<ITask>(metaData, taskSchema);
}
```

### What Happens at Runtime

When `registerSystemTableDefinition(metaData, schema)` is called:
1. If no schema is provided, one is generated from `metaData.fields` via `fieldsToSchema()`
2. The table definition (metadata + schema) is stored in the system registry
3. When the table is first accessed, a `Table` instance is created
4. The `Table` constructor calls `fieldsToSchema(metaData.fields, codeSchema)` to build the final merged schema
5. All `save()` / `insert()` / `update()` operations validate records against this merged schema

### Three Definition Strategies

| Strategy | When to Use | Example |
|----------|------------|---------|
| **Zod schema only** | System tables defined in code (most common) | Define schema, derive fields via `schemaToFields()` |
| **IField[] only** | User-defined tables, synced table definitions | Fields come from database or user input, schema generated via `fieldsToSchema()` |
| **Both** | When serialized fields need to be augmented with code-level validation | Table definitions synced between peers, then merged with local code schema |

## ID Fields and zodPeerId

All record IDs in Peers follow a specific format: 25-character alphanumeric strings with an embedded timestamp (generated by `newid()`).

Use `zodPeerId` for any field that holds a Peers record ID:

```typescript
import { zodPeerId } from '../types/zod-types';

const schema = z.object({
  recordId: zodPeerId,                          // Primary key
  userId: zodPeerId,                            // Foreign key to Users
  parentId: zodPeerId.optional(),               // Optional foreign key
  relatedIds: zodPeerId.array().optional(),     // Array of IDs
});
```

`zodPeerId` does two things:
1. **Validates** the string matches the 25-char alphanumeric format with a valid timestamp
2. **Brands** the field with `FieldType.id` so `schemaToFields()` correctly maps it to `FieldType.id` instead of `FieldType.string`

Do **not** use `zodPeerId` for:
- Non-ID strings (names, descriptions, URLs, hashes, signatures, crypto keys)
- IDs from external systems that don't follow the Peers ID format
- Table definition IDs that may be human-readable names

### How the Branding Works

```typescript
// zodPeerId sets _fieldType on its Zod definition
export const zodPeerId = z.string().refine(value => isid(value), {
  message: "Invalid peer id, it must be a 25 character alphanumeric string",
});
(zodPeerId._def as any)._fieldType = FieldType.id;
```

When `schemaToFields()` processes a field, it checks for `_fieldType` in the Zod definition chain. If found, it uses that instead of the default type mapping. This is how a `z.string().refine(...)` gets mapped to `FieldType.id` instead of `FieldType.string`.

When `fieldsToSchema()` encounters `FieldType.id`, it generates the equivalent refinement:
```typescript
case 'id':
  propertyType = z.string().refine((id => isid(id)), { message: 'Invalid id' });
  (propertyType._def as any)._fieldType = FieldType.id;
  break;
```

This ensures round-trip consistency: `Zod → IField[] → Zod` preserves the ID validation.

## Field Types Reference

| FieldType | Zod Equivalent | SQLite Type | Notes |
|-----------|---------------|-------------|-------|
| `id` | `zodPeerId` | TEXT | 25-char alphanumeric with timestamp |
| `string` | `z.string()` | TEXT | |
| `number` | `z.number()` | REAL | |
| `boolean` | `z.boolean()` | INTEGER (0/1) | |
| `Date` | `z.date()` | TEXT (ISO) | Stored as ISO 8601 string |
| `object` | `z.object({})` | TEXT (JSON) | Serialized as JSON |
| `blob` | — | BLOB | Binary data |
| `any` | `z.any()` | TEXT (JSON) | Serialized as JSON |
