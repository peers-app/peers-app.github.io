# Design Doc: Unified Task Management in peers-core

## Summary

Merge the `tasks` plugin and `yoke` plugin into `peers-core` as a unified **"Tasks"** experience. The new screen replaces peers-core's placeholder app screen with a three-panel layout: task list (left), content detail (center), and conversation (right). All three panels are collapsible.

## Naming

**Decision: "Tasks"** — simple, clear, everyone understands it. The name can evolve later as the center panel gains more content types beyond task details.

## Current State

### Tasks Plugin (`tasks/`)
- Full-featured task management: statuses (In-Progress, Queued, Backlog, Canceled), due dates, snoozing, repeating tasks, subtasks, time tracking
- Rich UI: collapsible sections (Completed, Due Soon, In Progress, Snoozed, Queued, Backlog), drag-and-drop reordering, search/create bar
- Data model: `ITask` with `taskId`, `title`, `body`, `status`, `sortOrder`, `dueDT`, `snoozeDT`, `completeDT`, `repeats`, `parentTaskId`, `createdByUserId`, `groupId`
- Tools: `new-task` tool callable by AI assistants
- Time logging: `LogEntries` table, timer UI, auto-log on completion
- No task detail view (just `console.log('Open detail for task:', task.taskId)`)

### Yoke Plugin (`yoke/`)
- Agent-oriented task management: simpler statuses (backlog, blocked, ready, in-progress, ready-for-review, canceled, done)
- Two-panel layout: task list (left 350px), task detail (right flex)
- Task detail view: inline-editable title, markdown description (via PeersUI), status selector, comments system, metadata bar
- Data model: `ITask` with `taskId`, `title`, `body`, `status`, `statusDetails`, `createdBy`, `assignedTo`, `sortOrder`, `comments[]`
- Agent orchestration: subscribes to task changes, auto-assigns "ready" tasks to agents
- No time tracking, no repeating tasks, no due dates, no snoozing

### Peers-Core (`peers-core/`)
- Currently a placeholder app screen ("Hello peers-core!")
- Route is commented out (not active)
- Provides core tools: send-message, run-workflow, search-workflows, etc.
- Provides Shell assistant and event types
- No tables, no UI of substance

## Design

### Three-Panel Layout

```
+-------------------+---------------------------+-------------------+
|                   |                           |                   |
|   TASK LIST       |   CONTENT (Detail)        |   CONVERSATION    |
|   (Left Panel)    |   (Center Panel)          |   (Right Panel)   |
|                   |                           |                   |
|   - Search bar    |   - Task title (editable) |   - Thread view   |
|   - Status filter |   - Status / metadata     |   - Message input |
|   - Sections:     |   - Description (md)      |   - AI responses  |
|     Completed     |   - Comments              |                   |
|     Due Soon      |   - Time tracking         |                   |
|     In Progress   |   - Subtasks              |                   |
|     Snoozed       |                           |                   |
|     Queued        |   (or empty state)        |                   |
|     Backlog       |   (or future: other       |                   |
|                   |    content types)         |                   |
|                   |                           |                   |
+-------------------+---------------------------+-------------------+
```

### Collapse Behavior

Each panel can be collapsed independently:

**Left Panel (Task List) — collapsed:**
- Minimizes to a thin vertical strip (~40px wide)
- Shows a vertical icon `bi-list-task` and the text "Tasks" rotated vertically
- Click the strip to expand back to full width
- Default width when expanded: 350px (matching Yoke)

**Center Panel (Content) — collapsed:**
- Collapsed by deselecting content: clicking an X button in the top-right corner of the center panel
- When no content is selected, the center panel is hidden entirely (zero width)
- The task list expands to fill the space 
- Re-opens when a task is selected (double-click or click from list)

**Right Panel (Conversation) — collapsed:**
- Minimizes to a thin vertical strip (~40px wide)
- Shows a vertical icon (e.g., `bi-chat-dots`) or "Chat" rotated vertically
- Click the strip to expand back to full width
- Default width when expanded: 350-400px

**All collapsed states are persisted to `deviceVar`** so they survive page reloads.

The sections should be able to be resized by the user


### Unified Data Model

Merge the best of both task schemas. The Tasks plugin's model is more mature (repeating tasks, due dates, snoozing, subtasks, time tracking). Yoke adds `assignedTo`, `statusDetails`, and `updatedAt`.

```typescript
// Unified task statuses
export enum TaskStatus {
  InProgress = 'In-Progress',
  Queued = 'Queued',
  Backlog = 'Backlog',
  Done = 'Done',
  Canceled = 'Canceled',
}

export const taskSchema = z.object({
  taskId: zodPeerId.default(() => newid()),
  title: z.string(),
  body: z.string().optional(),           // markdown description

  // Status & ordering
  status: z.nativeEnum(TaskStatus).default(TaskStatus.InProgress),
  statusDetails: z.string().optional(),  // from Yoke - additional status info
  sortOrder: z.number().default(() => Date.now()),

  // Dates
  dueDT: z.date().optional(),
  snoozeDT: z.date().optional(),
  completeDT: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),

  // Relationships
  parentTaskId: zodPeerId.optional(),    // subtasks
  assignedTo: z.string().optional(),     // from Yoke - user/agent assignment
  threadIds: z.array(z.string()).optional(), // message thread associations

  // Repeating
  repeats: repeatsSchema,               // from Tasks plugin

  // Ownership
  createdByUserId: zodPeerId.default(() => myUserId()),
  groupId: zodPeerId,
});
```

**Key decisions:**
- **`threadIds: string[]`** — tasks can be associated with one or more message threads. The right panel conversation view loads the thread(s) associated with the selected task. A new thread can be created from the conversation panel and auto-linked to the task.
- **Comments removed from schema** — task-specific discussion will use the existing message thread system (`threadIds`) rather than a bespoke comments array. This leverages the mature messaging infrastructure already in Peers.
- **No data migration needed** — existing Tasks/Yoke data is all test data. New table ID, clean start.

### Status Unification — DECIDED

**Decision:** 5 statuses: `In-Progress`, `Queued`, `Backlog`, `Done`, `Canceled`.

When a task is completed:
- Set `status = Done` **AND** set `completeDT` to the current timestamp
- This gives easy filtering (`status === 'Done'`) plus the timestamp for repeating task logic and "when was this completed?" history
- The "Completed" section in the task list filters by `status === 'Done'`

**Not included (for now):**
- `Blocked` and `Ready-For-Review` — these were Yoke-specific for agent orchestration. Can be added later if needed for human workflows, or handled via the agent orchestration layer when that gets redesigned.
- `Ready` — was a Yoke trigger for auto-assignment, conflates task status with orchestration signals. Will be handled differently when agent orchestration is redesigned.

### Component Architecture

```
peers-core/src/
├── consts.ts                    # Add new IDs
├── package.ts                   # Add tableDefinitions, appNavs
├── routes.ts                    # Activate the app screen route
├── uis.ts                       # Export the main UI
├── data/
│   ├── tasks.ts                 # Unified task model + helpers
│   ├── log-entries.ts           # Time logging (from Tasks plugin)
│   └── task-prefs.ts            # User/device preferences
├── tools/
│   ├── index.ts                 # Add new-task tool
│   └── new-task.tool.ts         # AI-callable task creation
├── ui/
│   ├── tasks.tsx                # Main three-panel layout container
│   ├── panels/
│   │   ├── task-list-panel.tsx  # Left panel - task list with sections
│   │   ├── content-panel.tsx    # Center panel - content router
│   │   └── conversation-panel.tsx # Right panel - thread view
│   ├── collapsed-strip.tsx      # Reusable thin collapsed strip
│   ├── task-list/
│   │   ├── search-bar.tsx       # Search/create input
│   │   ├── task-section.tsx     # Collapsible section container
│   │   ├── task-row.tsx         # Individual task in list
│   │   ├── sortable-task.tsx    # Drag-and-drop wrapper
│   │   └── due-badge.tsx        # Due date badge
│   ├── task-detail/
│   │   ├── task-detail.tsx      # Full task detail view
│   │   └── unlogged-time.tsx    # Timer widget
│   └── index.ts
├── assistants/
└── events/
```

### Task List Panel (Left)

Combines the best of both UIs:
- **Search bar** with Enter-to-create (from both)
- **Categorized sections** (from Tasks plugin): Completed, Due Soon, In Progress, Snoozed, Queued, Backlog
- **Drag-and-drop reordering** within sections (from Tasks plugin)
- **Task rows** with checkbox, icons, title, body preview, due badge, snooze badge (from Tasks plugin)
- **Click** a task to select it and open in center panel
- **Timer widget** in the header area (from Tasks plugin)
- Reactive data via `Tasks().dataChanged.subscribe()` (from Tasks plugin — better than Yoke's 5-second polling)

### Content Panel (Center)

Starts as a task detail view (from Yoke's `TaskDetail`), but designed to be extensible:

- **Task Detail** (initial content type):
  - Metadata bar: status selector, creator, dates, assignment
  - Editable title (inline, from Yoke)
  - Markdown description via `PeersUI` (from Yoke)
  - Status details alert (from Yoke)
  - Time tracking section (from Tasks plugin — log entries)
  - Close button (X) in top-right to deselect/collapse

- **Future content types** (not in scope for initial implementation):
  - Workflow run details
  - File viewer
  - Subtask sub-list
  - Any content renderable by a registered `PeersUI` component

### Conversation Panel (Right)

Embeds the existing Peers message thread system. The following components are available in `peers-ui`:

**Available components:**
- **`ThreadMessageList`** (`peers-ui/src/components/messages/thread-message-list.tsx`) — displays all messages within a thread by `threadId`. Includes message compose form for replies. Supports auto-scroll and infinite scroll. **This is the primary component to embed.**
- **`MessageCompose`** (`peers-ui/src/components/messages/message-compose.tsx`) — standalone message composition with markdown, mentions, draft persistence
- **`ThreadContainer`** (`peers-ui/src/components/messages/thread-view.tsx`) — manages multiple open threads with dropdown switcher, includes new thread creation button
- **`ChannelMessages`** (`peers-ui/src/components/messages/channel-view.tsx`) — full channel conversation view

**Integration approach:**
- Use `ThreadMessageList` with the task's `threadIds[0]` to display the conversation
- When no thread exists for a task, show a "New Thread" button that creates a new thread and adds its ID to the task's `threadIds`
- If a task has multiple threads, show a thread switcher (or use `ThreadContainer`)
- Thread data uses the existing Messages table and sync infrastructure — no new data layer needed

### Collapsed Strip Component

A reusable component for the collapsed left/right panels:

```tsx
interface CollapsedStripProps {
  icon: string;          // Bootstrap icon class
  label: string;         // Text to show (rotated or as tooltip)
  onClick: () => void;   // Expand handler
  side: 'left' | 'right';
}
```

- Width: ~40px
- Full height of container
- Background: subtle (var(--bs-secondary-bg))
- Border on the inner side
- Icon centered vertically
- Hover: slight background change
- Click: expands the panel

### State Management

All panel state persisted via `deviceVar`:

```typescript
// Panel collapse states
const leftPanelCollapsed = deviceVar<boolean>('tasks:leftPanelCollapsed', { defaultValue: false });
const rightPanelCollapsed = deviceVar<boolean>('tasks:rightPanelCollapsed', { defaultValue: false });

// Selected task (center panel shows detail when set, hidden when null)
const selectedTaskId = deviceVar<string | null>('tasks:selectedTaskId', { defaultValue: null });

// Status filter
const statusFilter = deviceVar<string>('tasks:statusFilter', { defaultValue: 'all' });
```

### Styling

Continue the existing convention:
- **Bootstrap 5** utility classes for layout and components
- **Bootstrap Icons** for all iconography
- **Inline styles** for dynamic/custom styling
- **CSS variables** (`var(--bs-*)`) for theme compatibility
- **No custom CSS files** — all styling inline or via Bootstrap classes
- Flexbox for the three-panel layout

## Implementation Plan

### Phase 1: Foundation (Data + Layout Shell)
1. Create unified task data model in `peers-core/src/data/tasks.ts`
2. Port task preferences and log entries from Tasks plugin
3. Create the three-panel layout container (`tasks.tsx`) with collapse behavior
4. Create the `CollapsedStrip` component
5. Wire up `deviceVar` persistence for panel states
6. Register the route and app nav in `package.ts` and `routes.ts`

### Phase 2: Task List Panel (Left)
7. Port `SearchBar` from Tasks plugin
8. Port `TaskSection` (collapsible sections) from Tasks plugin
9. Port `Task` row component from Tasks plugin (with checkbox, icons, badges)
10. Port `SortableTask` (drag-and-drop) from Tasks plugin
11. Port `DueBadge` from Tasks plugin
12. Implement task categorization logic (from Tasks plugin's `categorizeTasks`)
13. Add status filter dropdown (from Yoke)
14. Port `UnloggedTime` timer widget from Tasks plugin
15. Wire up reactive data loading via `dataChanged` subscription

### Phase 3: Content Panel (Center)
16. Port `TaskDetail` from Yoke (editable title, markdown description, metadata bar)
17. Add time tracking section (log entries from Tasks plugin)
18. Add close button (X) to deselect task and collapse center panel
19. Wire task selection: click task in list -> show detail in center

### Phase 4: Conversation Panel (Right)
20. Embed `ThreadMessageList` from peers-ui with task's `threadIds[0]`
21. Add "Start conversation" button that creates a thread and links it to the task
22. Add thread switcher if task has multiple `threadIds`
23. Wire conversation to selected task context (changes when task selection changes)

### Phase 5: Tools + Integration
24. Port `new-task` tool (AI-callable) into peers-core
25. Port task helper functions: `newTask()`, `taskToggleComplete()`, `snoozeTask()`, `setTaskStatus()`, `nextOccurrence()`
26. Port log entry creation logic
27. Update Shell assistant to be aware of tasks
28. Test end-to-end: create task via chat, manage in UI, track time, converse

### Phase 6: Polish
29. Ensure responsive behavior (panels adapt to narrow screens)
30. Verify drag-and-drop works correctly in the narrower left panel
31. Test all collapse state combinations
32. Verify `deviceVar` persistence across reloads
33. Verify `dataChanged` subscriptions handle all CRUD operations

## Out of Scope (Future)

- Kanban/board view for tasks
- Task templates
- Bulk operations on tasks
- Calendar view for due dates
- Agent auto-assignment (will be redesigned separately, see reference notes above)
- Multiple content types in the center panel (beyond task detail)
- Resizable panels (drag to resize) — possible future enhancement

## Resolved Questions

1. **Naming** — "Tasks"
2. **Conversation component** — `ThreadMessageList` from peers-ui is embeddable. Note: "conversation thread" and "message thread" are the same concept in Peers.
3. **Task thread association** — `threadIds: string[]` on task schema
4. **Status unification** — 5 statuses: In-Progress, Queued, Backlog, Done, Canceled. Setting Done also sets `completeDT`. No Blocked/Ready-For-Review for now.
5. **Data migration** — No migration needed, all test data
6. **Agent orchestration** — Not moving to peers-core. Reference notes captured above. Will be redesigned separately.
