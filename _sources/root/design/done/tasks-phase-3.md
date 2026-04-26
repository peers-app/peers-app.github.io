# Phase 3: Content Panel (Center)

## Summary

Build the center panel: task detail view with inline-editable title, markdown description, status selector, metadata bar, time tracking section, and close button. Also create the task helper functions used throughout the UI.

## Prerequisites

Phase 1 complete (data model, layout shell). Phase 2 complete (task list panel populates `selectedTaskId`).

## Files to Create

### 1. `peers-core/src/data/task-helpers.ts` — Task CRUD Helpers

Reusable helper functions for common task operations. Used by both UI components and tools.

```typescript
import { ITask, Tasks, TaskStatus } from './tasks';
import { LogEntries } from './log-entries';
import { newid, myUserId } from '@peers-app/peers-sdk';

/** Create and save a new task */
export async function newTask(
  title: string,
  groupId: string,
  opts?: Partial<ITask>
): Promise<ITask> {
  const task: ITask = {
    taskId: newid(),
    title,
    status: TaskStatus.InProgress,
    sortOrder: Date.now(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdByUserId: myUserId(),
    groupId,
    ...opts,
  };
  return await Tasks().save(task);
}

/** Toggle a task between Done and InProgress */
export async function taskToggleComplete(task: ITask): Promise<ITask> {
  const isDone = task.status === TaskStatus.Done;
  return await Tasks().save({
    ...task,
    status: isDone ? TaskStatus.InProgress : TaskStatus.Done,
    completeDT: isDone ? undefined : new Date(),
    updatedAt: new Date(),
  });
}

/** Set a task's status */
export async function setTaskStatus(task: ITask, status: TaskStatus): Promise<ITask> {
  return await Tasks().save({
    ...task,
    status,
    completeDT: status === TaskStatus.Done ? new Date() : task.completeDT,
    updatedAt: new Date(),
  });
}

/** Snooze a task until a given date */
export async function snoozeTask(task: ITask, untilDT: Date): Promise<ITask> {
  return await Tasks().save({
    ...task,
    snoozeDT: untilDT,
    updatedAt: new Date(),
  });
}

/** Unsnooze a task (clear snoozeDT) */
export async function unsnoozeTask(task: ITask): Promise<ITask> {
  return await Tasks().save({
    ...task,
    snoozeDT: undefined,
    updatedAt: new Date(),
  });
}

/** Delete a task by ID */
export async function deleteTask(taskId: string): Promise<void> {
  await Tasks().delete(taskId);
}

/** Update a task's title */
export async function updateTaskTitle(task: ITask, title: string): Promise<ITask> {
  return await Tasks().save({
    ...task,
    title,
    updatedAt: new Date(),
  });
}

/** Update a task's body/description */
export async function updateTaskBody(task: ITask, body: string): Promise<ITask> {
  return await Tasks().save({
    ...task,
    body,
    updatedAt: new Date(),
  });
}
```

### 2. `peers-core/src/ui/panels/content-panel.tsx` — Task Detail View

The center panel displaying full task details. Loads the selected task by ID. Includes editable title, markdown body, status/metadata bar, and close button.

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ITask, Tasks, TaskStatus } from '../../data/tasks';
import { LogEntries, ILogEntry } from '../../data/log-entries';
import { selectedTaskId } from '../task-state';
import {
  updateTaskTitle,
  updateTaskBody,
  setTaskStatus,
  snoozeTask,
  deleteTask,
} from '../../data/task-helpers';

export function ContentPanel() {
  const [task, setTask] = useState<ITask | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<ILogEntry[]>([]);

  // Sync selected task ID
  useEffect(() => {
    selectedTaskId.loadingPromise.then(() => setTaskId(selectedTaskId() ?? null));
    const sub = selectedTaskId.subscribe(v => setTaskId(v ?? null));
    return () => sub.unsubscribe();
  }, []);

  // Load task when ID changes
  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    async function load() {
      const t = await Tasks().get(taskId!);
      setTask(t || null);
      // Load log entries
      const entries = await LogEntries().list({ taskId: taskId! }, { sortBy: ['-startDT'] });
      setLogEntries(entries);
    }
    load();

    // Reactive updates
    const sub = Tasks().dataChanged.subscribe((evt) => {
      if (evt.dataObject.taskId === taskId) load();
    });
    const logSub = LogEntries().dataChanged.subscribe((evt) => {
      if (evt.dataObject.taskId === taskId) {
        LogEntries().list({ taskId: taskId! }, { sortBy: ['-startDT'] }).then(setLogEntries);
      }
    });
    return () => { sub.unsubscribe(); logSub.unsubscribe(); };
  }, [taskId]);

  if (!task) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 text-muted">
        <div className="text-center">
          <i className="bi bi-card-text d-block mb-2" style={{ fontSize: '2rem' }} />
          <p>Select a task to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with close button */}
      <div className="d-flex align-items-center justify-content-between p-2 border-bottom">
        <StatusSelector task={task} />
        <button
          className="btn btn-sm btn-link text-muted p-0"
          onClick={() => selectedTaskId(null)}
          title="Close detail"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Status details alert */}
        {task.statusDetails && (
          <div className="alert alert-info py-2 px-3" style={{ fontSize: '0.85rem' }}>
            {task.statusDetails}
          </div>
        )}

        {/* Editable Title */}
        <EditableTitle task={task} />

        {/* Metadata bar */}
        <MetadataBar task={task} />

        {/* Description */}
        <div className="mt-3">
          <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>Description</label>
          <EditableBody task={task} />
        </div>

        {/* Time Tracking */}
        {logEntries.length > 0 && (
          <div className="mt-3">
            <label className="form-label text-muted" style={{ fontSize: '0.75rem' }}>Time Log</label>
            <TimeLog entries={logEntries} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatusSelector({ task }: { task: ITask }) {
  const statuses = Object.values(TaskStatus);

  return (
    <select
      className="form-select form-select-sm"
      style={{ width: 'auto' }}
      value={task.status}
      onChange={async (e) => {
        await setTaskStatus(task, e.target.value as TaskStatus);
      }}
    >
      {statuses.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function EditableTitle({ task }: { task: ITask }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (value.trim() && value !== task.title) {
      await updateTaskTitle(task, value.trim());
    } else {
      setValue(task.title);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="form-control form-control-lg border-0 p-0"
        style={{ fontWeight: 600, fontSize: '1.4rem' }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(task.title); setEditing(false); }}}
      />
    );
  }

  return (
    <h4
      onClick={() => setEditing(true)}
      style={{ cursor: 'text', fontWeight: 600, margin: 0 }}
      title="Click to edit"
    >
      {task.title}
    </h4>
  );
}

function MetadataBar({ task }: { task: ITask }) {
  const formatDate = (d?: Date) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="d-flex flex-wrap gap-3 mt-2" style={{ fontSize: '0.8rem', color: 'var(--bs-secondary-color)' }}>
      <div>
        <i className="bi bi-calendar-plus me-1" />
        Created {formatDate(task.createdAt)}
      </div>
      {task.dueDT && (
        <div>
          <i className="bi bi-calendar-event me-1" />
          Due {formatDate(task.dueDT)}
        </div>
      )}
      {task.completeDT && (
        <div>
          <i className="bi bi-check2-circle me-1" />
          Completed {formatDate(task.completeDT)}
        </div>
      )}
      {task.assignedTo && (
        <div>
          <i className="bi bi-person me-1" />
          {task.assignedTo}
        </div>
      )}
      {task.snoozeDT && task.snoozeDT > new Date() && (
        <div>
          <i className="bi bi-moon me-1" />
          Snoozed until {formatDate(task.snoozeDT)}
        </div>
      )}
    </div>
  );
}

function EditableBody({ task }: { task: ITask }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.body || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setValue(task.body || ''); }, [task.body]);
  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (value !== (task.body || '')) {
      await updateTaskBody(task, value);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="form-control"
        rows={8}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Add a description..."
        style={{ fontSize: '0.9rem' }}
      />
    );
  }

  if (!task.body) {
    return (
      <div
        className="text-muted p-2 border rounded"
        style={{ cursor: 'text', fontSize: '0.9rem', minHeight: '60px' }}
        onClick={() => setEditing(true)}
      >
        Click to add a description...
      </div>
    );
  }

  return (
    <div
      className="p-2 border rounded"
      style={{ cursor: 'text', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}
      onClick={() => setEditing(true)}
    >
      {task.body}
    </div>
  );
}

function TimeLog({ entries }: { entries: ILogEntry[] }) {
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <div>
      <div className="mb-2" style={{ fontSize: '0.85rem' }}>
        <strong>Total: </strong>
        {hours > 0 && `${hours}h `}{mins}m
      </div>
      {entries.slice(0, 10).map(entry => (
        <div key={entry.logEntryId} className="d-flex gap-2 mb-1" style={{ fontSize: '0.8rem' }}>
          <span className="text-muted">
            {new Date(entry.startDT).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span>{entry.durationMinutes}m</span>
          {entry.note && <span className="text-muted">— {entry.note}</span>}
        </div>
      ))}
      {entries.length > 10 && (
        <small className="text-muted">+ {entries.length - 10} more entries</small>
      )}
    </div>
  );
}
```

**Notes:**
- The body editor uses a plain textarea for now. A future enhancement could use `MarkdownEditor` from peers-ui for rich editing with preview. This keeps Phase 3 simpler.
- The `EditableTitle` uses a borderless input that looks like the heading when editing.
- `StatusSelector` is a simple dropdown. Status change immediately saves.

## Files to Modify

### 3. `peers-core/src/ui/tasks.tsx` — Replace Placeholder Center Panel

Replace `ContentPanelPlaceholder` with the real `ContentPanel`:

```tsx
import { ContentPanel } from './panels/content-panel';

// Replace the center panel section — swap <ContentPanelPlaceholder /> for <ContentPanel />
```

## Verification

1. **Build:** `cd peers-core && npm run build` — compiles successfully
2. **Select task:** Click a task in the left panel — center panel opens with task detail
3. **Edit title:** Click the title text — it becomes an editable input. Type new title, press Enter or click away — title saves
4. **Edit description:** Click the description area — textarea appears. Type content, click away — body saves
5. **Change status:** Use the status dropdown — task status updates, task moves to correct section in left panel
6. **Close detail:** Click X button — center panel collapses, `selectedTaskId` becomes null
7. **Time log:** If log entries exist for the task, they display with total time
8. **Metadata bar:** Created date, due date (if set), assigned to (if set) all display
9. **Status details:** If `statusDetails` is set on a task, an info alert shows at the top
10. **Reactive updates:** Edit task in another context — detail panel updates automatically via `dataChanged`
