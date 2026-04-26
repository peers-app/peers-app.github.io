# Phase 1: Foundation (Data Model + Layout Shell)

## Summary

Create the unified task data model, log entries table, three-panel layout container with collapse behavior, and wire up the route/navigation so the Tasks screen is accessible from the sidebar.

## Prerequisites

None — this is the foundational phase.

## Files to Create

### 1. `peers-core/src/data/tasks.ts` — Task Data Model

Define the unified task schema, register the table, and export a factory function.

Follow the pattern from `peers-sdk/src/data/messages.ts`:

```typescript
import { z } from 'zod';
import { zodPeerId } from '@peers-app/peers-sdk';
import { newid, myUserId } from '@peers-app/peers-sdk';
import { ITableMetaData, schemaToFields } from '@peers-app/peers-sdk';
import { registerSystemTableDefinition } from '@peers-app/peers-sdk';
import { getTableContainer } from '@peers-app/peers-sdk';
import { DataContext } from '@peers-app/peers-sdk';

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
  body: z.string().optional(),

  // Status & ordering
  status: z.nativeEnum(TaskStatus).default(TaskStatus.InProgress),
  statusDetails: z.string().optional(),
  sortOrder: z.number().default(() => Date.now()),

  // Dates
  dueDT: z.date().optional(),
  snoozeDT: z.date().optional(),
  completeDT: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),

  // Relationships
  parentTaskId: zodPeerId.optional(),
  assignedTo: z.string().optional(),
  threadIds: z.array(z.string()).optional(),

  // Ownership
  createdByUserId: zodPeerId.default(() => myUserId()),
  groupId: zodPeerId,
});

export type ITask = z.infer<typeof taskSchema>;

const metaData: ITableMetaData = {
  name: 'Tasks',
  description: 'Task management',
  primaryKeyName: 'taskId',
  fields: schemaToFields(taskSchema),
  indexes: [
    { fields: ['groupId'] },
    { fields: ['status'] },
    { fields: ['parentTaskId'] },
    { fields: ['groupId', 'status'] },
    { fields: ['createdByUserId'] },
  ],
};

registerSystemTableDefinition(metaData, taskSchema);

export function Tasks(dataContext?: DataContext) {
  return getTableContainer(dataContext).getTable<ITask>(metaData, taskSchema);
}
```

**Notes:**
- `repeats` field is intentionally omitted for now (repeatsSchema doesn't exist yet). Will be added in a future phase.
- Imports should be adjusted to match the actual export paths in peers-sdk (the package re-exports from various submodules).

### 2. `peers-core/src/data/log-entries.ts` — Time Log Entries

```typescript
import { z } from 'zod';
import { zodPeerId, newid, myUserId } from '@peers-app/peers-sdk';
import { ITableMetaData, schemaToFields } from '@peers-app/peers-sdk';
import { registerSystemTableDefinition } from '@peers-app/peers-sdk';
import { getTableContainer } from '@peers-app/peers-sdk';
import { DataContext } from '@peers-app/peers-sdk';

export const logEntrySchema = z.object({
  logEntryId: zodPeerId.default(() => newid()),
  taskId: zodPeerId,
  startDT: z.date(),
  endDT: z.date().optional(),
  durationMinutes: z.number().optional(),
  note: z.string().optional(),
  createdByUserId: zodPeerId.default(() => myUserId()),
  groupId: zodPeerId,
});

export type ILogEntry = z.infer<typeof logEntrySchema>;

const metaData: ITableMetaData = {
  name: 'LogEntries',
  description: 'Time log entries for tasks',
  primaryKeyName: 'logEntryId',
  fields: schemaToFields(logEntrySchema),
  indexes: [
    { fields: ['taskId'] },
    { fields: ['groupId'] },
  ],
};

registerSystemTableDefinition(metaData, logEntrySchema);

export function LogEntries(dataContext?: DataContext) {
  return getTableContainer(dataContext).getTable<ILogEntry>(metaData, logEntrySchema);
}
```

### 3. `peers-core/src/ui/task-state.ts` — UI State Management

All panel state persisted via `deviceVar` so it survives page reloads.

```typescript
import { deviceVar } from '@peers-app/peers-sdk';

// Panel collapse states
export const leftPanelCollapsed = deviceVar<boolean>('tasks:leftPanelCollapsed', { defaultValue: false });
export const rightPanelCollapsed = deviceVar<boolean>('tasks:rightPanelCollapsed', { defaultValue: false });

// Selected task (center panel shows detail when set, hidden when null)
export const selectedTaskId = deviceVar<string | null>('tasks:selectedTaskId', { defaultValue: null });

// Status filter
export const statusFilter = deviceVar<string>('tasks:statusFilter', { defaultValue: 'all' });
```

### 4. `peers-core/src/ui/collapsed-strip.tsx` — Collapsed Panel Strip

Reusable thin vertical strip shown when a panel is collapsed.

```tsx
import React from 'react';

interface CollapsedStripProps {
  icon: string;          // Bootstrap icon class e.g. "bi-list-task"
  label: string;         // Text to show rotated
  onClick: () => void;   // Expand handler
  side: 'left' | 'right';
}

export function CollapsedStrip({ icon, label, onClick, side }: CollapsedStripProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '40px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backgroundColor: 'var(--bs-secondary-bg)',
        borderLeft: side === 'right' ? '1px solid var(--bs-border-color)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--bs-border-color)' : undefined,
        userSelect: 'none',
      }}
    >
      <i className={`bi ${icon}`} style={{ fontSize: '1.2rem', marginBottom: '8px' }} />
      <span
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontSize: '0.8rem',
          color: 'var(--bs-secondary-color)',
          letterSpacing: '1px',
        }}
      >
        {label}
      </span>
    </div>
  );
}
```

### 5. `peers-core/src/ui/tasks.tsx` — Three-Panel Layout Container

The main component that replaces the placeholder `app.tsx`. Uses flexbox with three sections.

```tsx
import React, { useState, useEffect } from 'react';
import { appScreenId } from '../consts';
import { IPeersUI, zodAnyObjectOrArray } from '@peers-app/peers-sdk';
import { CollapsedStrip } from './collapsed-strip';
import { leftPanelCollapsed, rightPanelCollapsed, selectedTaskId } from './task-state';

// Placeholder panel components (will be replaced in phases 2-4)
function TaskListPanelPlaceholder() {
  return <div className="p-3"><h5>Task List</h5><p className="text-muted">Coming in Phase 2</p></div>;
}
function ContentPanelPlaceholder() {
  return <div className="p-3"><h5>Task Detail</h5><p className="text-muted">Coming in Phase 3</p></div>;
}
function ConversationPanelPlaceholder() {
  return <div className="p-3"><h5>Conversation</h5><p className="text-muted">Coming in Phase 4</p></div>;
}

export function TasksScreen() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Sync with deviceVar on mount
  useEffect(() => {
    leftPanelCollapsed.loadingPromise.then(() => setLeftCollapsed(leftPanelCollapsed() ?? false));
    rightPanelCollapsed.loadingPromise.then(() => setRightCollapsed(rightPanelCollapsed() ?? false));
    selectedTaskId.loadingPromise.then(() => setTaskId(selectedTaskId() ?? null));

    const subs = [
      leftPanelCollapsed.subscribe(v => setLeftCollapsed(v ?? false)),
      rightPanelCollapsed.subscribe(v => setRightCollapsed(v ?? false)),
      selectedTaskId.subscribe(v => setTaskId(v ?? null)),
    ];
    return () => subs.forEach(s => s.unsubscribe());
  }, []);

  const toggleLeft = () => { leftPanelCollapsed(!leftCollapsed); };
  const toggleRight = () => { rightPanelCollapsed(!rightCollapsed); };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Panel — Task List */}
      {leftCollapsed ? (
        <CollapsedStrip icon="bi-list-task" label="Tasks" onClick={toggleLeft} side="left" />
      ) : (
        <div style={{
          width: '350px',
          minWidth: '250px',
          borderRight: '1px solid var(--bs-border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Collapse button in header */}
          <div className="d-flex align-items-center justify-content-between p-2 border-bottom">
            <strong>Tasks</strong>
            <button className="btn btn-sm btn-link p-0" onClick={toggleLeft}>
              <i className="bi bi-chevron-left" />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <TaskListPanelPlaceholder />
          </div>
        </div>
      )}

      {/* Center Panel — Content Detail */}
      {taskId && (
        <div style={{
          flex: 1,
          borderRight: '1px solid var(--bs-border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <ContentPanelPlaceholder />
        </div>
      )}

      {/* If no task selected and left panel is expanded, let it fill */}
      {!taskId && !leftCollapsed && (
        <div style={{ flex: 1 }} />
      )}

      {/* Right Panel — Conversation */}
      {rightCollapsed ? (
        <CollapsedStrip icon="bi-chat-dots" label="Chat" onClick={toggleRight} side="right" />
      ) : (
        <div style={{
          width: '380px',
          minWidth: '280px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Collapse button in header */}
          <div className="d-flex align-items-center justify-content-between p-2 border-bottom">
            <strong>Chat</strong>
            <button className="btn btn-sm btn-link p-0" onClick={toggleRight}>
              <i className="bi bi-chevron-right" />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ConversationPanelPlaceholder />
          </div>
        </div>
      )}
    </div>
  );
}

export const TasksScreenUI: IPeersUI = {
  peersUIId: appScreenId,
  content: TasksScreen,
  propsSchema: zodAnyObjectOrArray,
};
```

**Notes:**
- The three placeholder components will be replaced in phases 2-4.
- `react-split-pane` for resizable dividers can be added in Phase 6 (polish). For now, fixed widths with flex center keep it simple.
- Panel header includes collapse chevron button. Collapsed state shows `CollapsedStrip`.

## Files to Modify

### 6. `peers-core/src/consts.ts` — Add New IDs

Add table IDs and tool IDs. Generate real IDs with `newid()` at dev time or use descriptive placeholder IDs.

```typescript
// Add to existing file:
export const tasksTableId = "00mh0wlipkdbeaw8tasks0001";
export const logEntriesTableId = "00mh0wlipkdbeaw8logent001";
export const newTaskToolId = "00mh0wlipkdbeaw8newtsk001";
```

### 7. `peers-core/src/package.ts` — Add tableDefinitions and appNavs

```typescript
import type { IPeersPackage } from "@peers-app/peers-sdk";
import { packageId, packageName } from "./consts";
import { toolInstances } from "./tools";
import { assistants } from "./assistants";
import { events } from "./events";

// Import data models to trigger registerSystemTableDefinition
import './data/tasks';
import './data/log-entries';

const peersPackage: IPeersPackage = {
  packageId,
  toolInstances,
  assistants,
  events,
  appNavs: [
    {
      name: 'Tasks',
      iconClassName: 'bi bi-list-task',
      navigationPath: 'app',
    },
  ],
};

(exports as any).exports = peersPackage;
```

**Note:** Importing the data files triggers `registerSystemTableDefinition()` which registers the tables globally. No need for `tableDefinitions` array on the package since system table registration handles it.

### 8. `peers-core/src/routes.ts` — Activate Route

Uncomment the route:

```typescript
const routes: IPeersPackageRoutes = {
  routes: [
    appScreenRoute   // <-- uncomment this
  ]
};
```

### 9. `peers-core/src/uis.ts` — Export TasksScreen UI

Replace the commented `AppScreenUI` with the new `TasksScreenUI`:

```typescript
import type { IPeersPackageUIs } from "@peers-app/peers-sdk";
import { TasksScreenUI } from "./ui/tasks";

const uis: IPeersPackageUIs = {
  uis: [
    TasksScreenUI
  ]
};

declare const exportUIs: (uis: IPeersPackageUIs) => void;
exportUIs(uis);
```

## Verification

1. **Build:** `cd peers-core && npm run build` — all three bundles (package, routes, uis) should compile without errors
2. **UI Reload:** `peers ui reload` — the UI should reload
3. **Navigation:** A "Tasks" item with `bi-list-task` icon should appear in the sidebar
4. **Click Tasks:** The three-panel layout should render with placeholder content
5. **Collapse left panel:** Click the chevron — left panel collapses to a 40px strip with "Tasks" label. Click strip to expand.
6. **Collapse right panel:** Click the chevron — right panel collapses to a 40px strip with "Chat" label. Click strip to expand.
7. **Reload page:** Collapse states should persist (verify via devtools that `deviceVar` values are saved)
