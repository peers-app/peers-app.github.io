---
sidebar_position: 5
---

# Workflows

Workflows are sequences of instructions executed on the local device. Each instruction either calls a tool directly or delegates to an assistant. Workflows power both explicit user-initiated automations and implicit assistant replies to messages.

## Key concepts

| Concept | Table | Description |
|---|---|---|
| **Workflow** | `Workflows` | A reusable template: name, description, default assistant, and an ordered list of instructions. |
| **Workflow Run** | `WorkflowRuns` | A single execution of a workflow (or an ad-hoc instruction sequence). Tracks current progress, variables, results, and completion/error state. |
| **Workflow Log** | `WorkflowLogs` | Per-run log entries recording tool calls, timing, errors, and results. |

All three tables are **local-only** (`localOnly: true`) — they are never synced to other devices.

## Data model

### Workflow (`IWorkflow`)

| Field | Type | Description |
|---|---|---|
| `workflowId` | peer ID | Primary key |
| `name` | string | Display name |
| `description` | string | Detailed description for users and assistants |
| `defaultAssistantId` | peer ID | The assistant used when an instruction doesn't specify one |
| `instructions` | `IWorkflowInstruction[]` | Ordered steps — see below |
| `createdBy` | peer ID | Author |
| `createdAt` / `updatedAt` | Date | Timestamps |

### Workflow instruction (`IWorkflowInstruction`)

Each instruction has one of:

- **`directCallToolId`** — call this tool directly, passing args gathered from the run's `vars`.
- **`markdown`** — natural-language instruction; the processor resolves an assistant (from mentions or the default) and rewrites it into a `directCallToolId` step targeting that assistant's runner tool.
- **`subWorkflowId`** — spawn a child workflow run (parent blocks until child completes).

Optional: `onError` — markdown instruction to run if this step fails.

### Workflow run (`IWorkflowRun`)

| Field | Type | Description |
|---|---|---|
| `workflowRunId` | peer ID | Primary key |
| `workflowId` | peer ID? | The source workflow template (if any) |
| `parentMessageId` | peer ID | The message thread this run executes within |
| `instructions` | `IWorkflowInstruction[]` | Mutable instruction list — the processor can insert steps at runtime |
| `currentInstructionIndex` | number | Pointer to the next instruction |
| `instructionResults` | `any[]` | Result of each completed instruction (indexed by instruction) |
| `vars` | object | Scratch-pad key/value store shared across all instructions |
| `inErrorState` | boolean? | Set when a step fails |
| `scheduleDT` | Date? | Deferred execution — run won't start until this time |
| `parentWorkflowRunId` | peer ID? | Links a sub-workflow back to its parent |
| `defaultAssistantId` | peer ID | Fallback assistant for the run |
| `startedAt` / `completedAt` / `createdAt` | Date | Lifecycle timestamps |

### Workflow log (`IWorkflowLog`)

| Field | Type | Description |
|---|---|---|
| `workflowLogId` | peer ID | Primary key |
| `workflowRunId` | peer ID | Parent run |
| `contextId` | peer ID | Groups log entries from a single instruction execution |
| `logDT` | Date | Timestamp |
| `logText` | string | Human-readable log line |
| `toolId` | peer ID? | Which tool produced this entry |
| `toolArgs` | object? | Arguments passed to the tool |
| `toolRunTimeMs` | number? | Execution duration |
| `result` | string? | Stringified result |
| `resultObject` | object? | Structured result data |
| `isError` | boolean? | Whether this entry records an error |

## How workflows are triggered

### 1. User sends a message (most common)

`message-processor.ts` subscribes to new local message inserts. When a user message arrives it determines which assistant(s) should reply (via mentions, thread context, or the primary assistant fallback) and creates a `WorkflowRun` with a single instruction: call that assistant's runner tool. The workflow processor picks it up from there.

### 2. Explicit `runWorkflow()`

The SDK exports `runWorkflow()` which creates a run from a `Workflow` template. It resolves the parent message context, sends a "Running workflow" message, and inserts the `WorkflowRun`. Supports scheduled execution via `scheduleDT`.

### 3. Direct tool call (`runToolDirectly()`)

`tool-call-processor.ts` provides `runToolDirectly()` for invoking a single tool as a one-off workflow run. It pre-creates the `WorkflowRun` before the synthetic message so that `message-processor` skips it (no double-processing). Completion is detected via a cross-context subscription.

## Execution engine

The workflow processor (`peers-electron/src/server/workflow-processor.ts`) is the local execution engine. It is initialized at startup via `initializeWorkflowProcessor()` and has two trigger paths:

1. **Change subscription** — reacts to local `WorkflowRuns` inserts/updates.
2. **60-second polling interval** — catches any runs that weren't triggered by the subscription.

### Processing a run

`tryProcessingWorkflowRun(dataContext, workflowRunId)` is the entry point:

1. **Gate checks** — skip if the run is completed, in error state, or scheduled in the future. Future runs within 60 seconds are re-scheduled via `setTimeout`.
2. **CPU/concurrency gating** — limits parallel runs based on CPU load and core count.
3. **Local lock** — an in-process `Set<string>` (`activeWorkflowRuns`) prevents concurrent processing of the same run. The lock is claimed synchronously before any `await` to avoid TOCTOU races, and released in a `finally` block.
4. **Sub-workflow gate** — if the run has pending child runs, processing is deferred.
5. **Instruction dispatch** — `processNextInstruction()` handles the current step.

### Instruction dispatch

For each instruction at `currentInstructionIndex`:

- **`directCallToolId`**: loads the tool, gathers args from `vars` using the tool's input schema, initializes a wrapped tool instance with a full `IWorkflowRunContext`, and calls `toolFn(args)`. On success, `currentInstructionIndex` advances and the result is appended to `instructionResults`.
- **`markdown` (no directCallToolId)**: resolves an assistant from mentions in the markdown or falls back to the run's default. Inserts a new `directCallToolId` instruction (targeting the assistant's runner tool) at the next index and re-enters.

After each step:

| Outcome | Action |
|---|---|
| **Error** | Sets `inErrorState`, saves, sends error message to parent thread |
| **More instructions remain** | Saves progress, schedules next step via `setTimeout(fn, 0)` (avoids stack overflow from recursive calls) |
| **All instructions complete** | Sets `completedAt`, merges run `vars` back into the parent message's thread vars, sends completion message |

### Variables and args

The run's `vars` object is a shared scratch-pad. `gatherArgs()` maps tool input schema field names to var values. Special implicit vars:

- `workflowRunId` — the current run ID
- `assistantId` — the run's `defaultAssistantId`
- `messageContent` — the current instruction's `markdown`

Variables can also be **references** (e.g. `{ instructionVariableType: "reference", source: "lastOutput" }`) which resolve to the previous instruction's result at runtime.

### Error handling

- Tool errors set `inErrorState` and log via the workflow logger.
- Unexpected exceptions in the outer try/catch also set `inErrorState` (best-effort DB save).
- The local lock is always released in the `finally` block regardless of outcome.
- `haltRun()` allows manual cancellation — it sets `inErrorState`, halts child runs recursively, and sends a cancellation message.
- `clearErrorState()` resets `inErrorState` so the run can be retried by the polling interval.

### Concurrency model

- Runs are processed **locally only** — no cross-device coordination.
- Multiple different runs can execute in parallel, capped by CPU core count.
- Under high CPU load (avg > 30% or max > 70%), at most 2 runs are allowed concurrently.
- The same run ID can never be processed concurrently (enforced by the `activeWorkflowRuns` set).

## Architecture

```
User message
     │
     ▼
message-processor ──► WorkflowRuns.insert()
                            │
     ┌──────────────────────┘
     │          ┌──────────────────────────┐
     ▼          │  workflow-processor       │
  change sub ──►│  tryProcessingWorkflowRun│
  60s poll ────►│  processNextInstruction   │
                │     ├─ directCallToolId   │──► tool-loader ──► tool execution
                │     └─ markdown           │──► resolve assistant ──► re-enter
                └──────────────────────────┘
                            │
                            ▼
                   WorkflowLogs (per-step logs)
                   Messages (completion/error reply)
```
