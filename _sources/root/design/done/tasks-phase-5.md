# Phase 5: Tools + Integration

## Summary

Add AI-callable tools for task management and update the Shell assistant to be aware of tasks. This enables users to create and manage tasks via chat.

## Prerequisites

Phase 1 complete (data model). Phase 3 complete (task helper functions).

## Files to Create

### 1. `peers-core/src/tools/new-task.tool.ts` — AI-Callable Task Creation

Follow the pattern from `peers-core/src/tools/send-message.tool.ts`.

```typescript
import {
  IOSchemaType, FieldType, ITool, IToolInstance, IWorkflowRunContext,
  newid, myUserId,
} from '@peers-app/peers-sdk';
import { z } from 'zod';
import { newTaskToolId } from '../consts';
import { Tasks, TaskStatus } from '../data/tasks';
import { getUserContext } from '@peers-app/peers-sdk';

const inputSchema = z.object({
  title: z.string().describe('The title of the task'),
  body: z.string().optional().describe('Optional markdown description/details for the task'),
  dueDT: z.string().optional().describe('Optional due date in ISO 8601 format (e.g. "2025-03-15")'),
  status: z.enum(['In-Progress', 'Queued', 'Backlog']).optional()
    .describe('Initial status. Defaults to In-Progress'),
  groupId: z.string().optional()
    .describe('Group ID to create the task in. Defaults to the current group context.'),
});

type IInput = z.infer<typeof inputSchema>;

export const newTaskTool: ITool = {
  toolId: newTaskToolId,
  name: 'new-task',
  code: '',
  usageDescription: 'Create a new task. Use this when the user asks to create a task, todo, or action item.',
  detailedDescription: 'Creates a task that appears in the Tasks app. The task will be visible in the task list and can be managed from the UI. Supports title, description, due date, and initial status.',
  inputSchema: {
    type: IOSchemaType.complex,
    fields: [
      { name: 'title', description: 'The title of the task', type: FieldType.string, required: true },
      { name: 'body', description: 'Optional markdown description', type: FieldType.string },
      { name: 'dueDT', description: 'Optional due date in ISO 8601 format', type: FieldType.string },
      { name: 'status', description: 'Initial status: In-Progress, Queued, or Backlog', type: FieldType.string },
      { name: 'groupId', description: 'Group ID (defaults to current group)', type: FieldType.string },
    ],
  },
  outputSchema: {
    type: IOSchemaType.object,
    fields: [
      { name: 'taskId', description: 'The ID of the created task', type: FieldType.id },
      { name: 'title', description: 'The title of the created task', type: FieldType.string },
    ],
  },
};

export const newTaskToolInstance: IToolInstance = {
  tool: newTaskTool,
  inputSchema,
  toolFn: async (args: IInput, context: IWorkflowRunContext) => {
    const groupId = args.groupId || getUserContext().defaultDataContext().groupId;

    const task = await Tasks().save({
      taskId: newid(),
      title: args.title,
      body: args.body,
      status: (args.status as TaskStatus) || TaskStatus.InProgress,
      dueDT: args.dueDT ? new Date(args.dueDT) : undefined,
      sortOrder: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: myUserId(),
      groupId,
    });

    return { taskId: task.taskId, title: task.title };
  },
};
```

## Files to Modify

### 2. `peers-core/src/tools/index.ts` — Register New Tool

Add the new-task tool to the tool instances array:

```typescript
import { newTaskToolInstance } from './new-task.tool';

export const toolInstances: IToolInstance[] = [
  // ... existing tools
  newTaskToolInstance,
];
```

### 3. `peers-core/src/consts.ts` — Ensure newTaskToolId Exists

Should already be added in Phase 1, but verify:

```typescript
export const newTaskToolId = "00mh0wlipkdbeaw8newtsk001";
```

### 4. `peers-core/src/assistants/shell-assistant.ts` — Add Task Awareness

Update the Shell assistant's system prompt to mention the new-task tool so it knows to use it when users ask about tasks.

Find the system prompt / instructions section of the Shell assistant and add context about task management:

```typescript
// In the system prompt or instructions, add:
// "You can create tasks for the user using the new-task tool when they mention todos, tasks, or action items."
```

The exact edit depends on how the Shell assistant's prompt is structured. The key is ensuring the `toolsToInclude` or prompt mentions `@new-task` so the assistant knows the tool exists.

**If using `Relevant` inclusion strategy** (which Shell uses): The tool's `usageDescription` and `detailedDescription` should be sufficient for the embedding-based tool selection to find it when users mention tasks. No prompt changes may be needed — verify by testing.

**If the tool isn't being picked up automatically**: Add `@new-task` to the Shell assistant's `toolsToInclude` field, or switch to explicitly include it.

## Optional: Additional Tools

These can be added later but are documented here for completeness:

### `search-tasks.tool.ts` — Search Tasks
```typescript
// Input: { search?: string, status?: string, groupId?: string }
// Output: Array of { taskId, title, status }
// Searches tasks by text match on title/body
```

### `get-tasks-in-progress.tool.ts` — List Active Tasks
```typescript
// Input: { groupId?: string }
// Output: Array of { taskId, title, status, dueDT? }
// Returns all non-completed tasks, useful for "what am I working on?"
```

### `update-task.tool.ts` — Update Task
```typescript
// Input: { taskId, title?, body?, status?, dueDT? }
// Output: { taskId, title, status }
// Allows AI to update existing tasks
```

These additional tools are out of scope for this phase but can be added incrementally.

## Verification

1. **Build:** `cd peers-core && npm run build` — compiles successfully
2. **Tool registration:** Verify the tool appears in the tools list. Check via the UI's tools/data explorer, or query `Tools().list()` and confirm `new-task` is present.
3. **Create task via chat:** Send a message like "Create a task to review the PR" to the Shell assistant. The assistant should use the `new-task` tool and create a task.
4. **Task appears in UI:** After AI creates the task, it should appear in the Tasks list panel immediately (reactive via `dataChanged`).
5. **Tool with options:** Send "Create a task called 'Deploy to staging' with status Queued and due date March 15" — verify all fields are set correctly.
6. **Default groupId:** When no groupId is specified, the tool should use the user's default group context.
