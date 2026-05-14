---
sidebar_position: 4
---

# Tools

**Tools** are callable functions that assistants and workflows invoke at runtime. Each tool has a schema describing its inputs and outputs, metadata for AI discovery, and a function that does the actual work.

## Anatomy of a tool

A tool has two parts:

| Type | Purpose |
| --- | --- |
| **`ITool`** | Metadata record: name, descriptions, input/output schemas (`IField[]`), and an ID. Stored in the `Tools` table and surfaced to assistants for reasoning. |
| **`IToolInstance`** | Runtime pair of an `ITool` and its `toolFn` implementation. Optionally carries a Zod `inputSchema` for TypeScript type inference. |

## Defining tool schemas

Every tool needs an `inputSchema` and `outputSchema` on the `ITool` record. These are `IOSchema` objects containing an array of `IField[]` that describe each parameter's name, type, optionality, and description.

**Define your schema once as a Zod object, then use `schemaToFields()` to derive the `IField[]`.** This keeps a single source of truth and prevents drift between the TypeScript types and the contract-facing metadata.

```typescript
import {
  IOSchemaType,
  type ITool,
  type IToolInstance,
  type IWorkflowRunContext,
  schemaToFields,
} from "@peers-app/peers-sdk";
import { z } from "zod";

// 1. Define schemas once with Zod — descriptions flow into IField[]
const inputSchema = z.object({
  query: z.string().describe("Search query text"),
  limit: z.number().optional().describe("Max results to return"),
});

type IInput = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  results: z.string().describe("Matching results"),
});

// 2. Derive IField[] from Zod — no hand-written field arrays
export const myTool: ITool = {
  toolId: "your-25-char-peer-id-here",
  name: "my-tool",
  code: "",
  usageDescription: "Short description for AI reasoning",
  inputSchema: {
    type: IOSchemaType.complex,
    fields: schemaToFields(inputSchema),
  },
  outputSchema: {
    type: IOSchemaType.complex,
    fields: schemaToFields(outputSchema),
  },
};

// 3. Register the instance with the same Zod schema
export const myToolInstance: IToolInstance = {
  tool: myTool,
  inputSchema,
  toolFn: async (args: IInput, _context: IWorkflowRunContext) => {
    // implementation
    return { results: "..." };
  },
};
```

### Why `schemaToFields`?

The `schemaToFields` utility (from `@peers-app/peers-sdk`) walks a Zod object schema and produces an `IField[]` array with the correct `FieldType`, optionality, array flags, descriptions, and defaults. It handles `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodDate`, `ZodObject`, `ZodArray`, `ZodOptional`, `ZodNativeEnum`, and nested wrappers.

Without it, you'd maintain two parallel declarations of the same schema — one Zod (for TypeScript), one `IField[]` (for the `ITool` record). These can drift silently, causing the contract to advertise a different API than the function actually accepts.

### Descriptions are important

Use `.describe("...")` on every Zod field. These descriptions become the `IField.description` that assistants read when deciding how to call your tool. Clear, specific descriptions lead to better tool invocation by AI.

## Tool IDs

Tool IDs are 25-character alphanumeric peer IDs. Use `newid()` from `@peers-app/peers-sdk` to generate them. For well-known built-in tools, hardcoded IDs (e.g. `000peers0tool00toolsearch`) are acceptable.

## Tools in contracts

When a tool is part of a **package contract**, `extractToolShape` pulls the `IField[]` from `ITool.inputSchema` and `ITool.outputSchema` into the contract definition as `IContractTool`. The contract validation system (`validateProviderSatisfiesContract`) checks field-level compatibility between contract providers.

Using `schemaToFields` ensures the fields that end up in the contract match exactly what the Zod schema (and therefore the `toolFn`) expects.

See [Package contracts](../Packages/contracts) for more on contracts.

## Related topics

- **[System: Workflows](./Workflows)** — tools run inside workflow runs.
- **[Package contracts](../Packages/contracts)** — how tools fit into versioned package interfaces.
- **[System: Tables](./Tables)** — `schemaToFields` is also used for table definitions.
