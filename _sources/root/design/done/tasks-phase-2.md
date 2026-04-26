# Phase 2: Task List Panel (Left)

## Summary

Build the left panel: search/create bar, categorized collapsible sections, task rows with checkbox/icons/badges, drag-and-drop reordering, and reactive data loading. Also includes the timer widget for time tracking.

## Prerequisites

Phase 1 complete — data model registered, three-panel layout rendering, route active.

## Files to Create

### 1. `peers-core/src/ui/task-list/categorize-tasks.ts` — Section Grouping Logic

Categorizes tasks into display sections. Each task appears in exactly one section based on priority order.

```typescript
import { ITask, TaskStatus } from '../../data/tasks';

export interface TaskSection {
  key: string;
  label: string;
  icon: string;           // Bootstrap icon class
  tasks: ITask[];
  defaultCollapsed: boolean;
}

export function categorizeTasks(tasks: ITask[]): TaskSection[] {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  const completed: ITask[] = [];
  const dueSoon: ITask[] = [];
  const inProgress: ITask[] = [];
  const snoozed: ITask[] = [];
  const queued: ITask[] = [];
  const backlog: ITask[] = [];

  for (const task of tasks) {
    if (task.status === TaskStatus.Done) {
      completed.push(task);
    } else if (task.status === TaskStatus.Canceled) {
      completed.push(task); // Show canceled in completed section
    } else if (task.snoozeDT && task.snoozeDT > now) {
      snoozed.push(task);
    } else if (task.dueDT && task.dueDT <= soon) {
      dueSoon.push(task);
    } else if (task.status === TaskStatus.InProgress) {
      inProgress.push(task);
    } else if (task.status === TaskStatus.Queued) {
      queued.push(task);
    } else {
      backlog.push(task);
    }
  }

  // Sort each section by sortOrder descending (highest = most recent/top)
  const sortDesc = (a: ITask, b: ITask) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  completed.sort(sortDesc);
  dueSoon.sort((a, b) => (a.dueDT?.getTime() ?? 0) - (b.dueDT?.getTime() ?? 0)); // Due soonest first
  inProgress.sort(sortDesc);
  snoozed.sort((a, b) => (a.snoozeDT?.getTime() ?? 0) - (b.snoozeDT?.getTime() ?? 0)); // Waking soonest first
  queued.sort(sortDesc);
  backlog.sort(sortDesc);

  return [
    { key: 'due-soon', label: 'Due Soon', icon: 'bi-alarm', tasks: dueSoon, defaultCollapsed: false },
    { key: 'in-progress', label: 'In Progress', icon: 'bi-play-circle', tasks: inProgress, defaultCollapsed: false },
    { key: 'queued', label: 'Queued', icon: 'bi-clock', tasks: queued, defaultCollapsed: false },
    { key: 'snoozed', label: 'Snoozed', icon: 'bi-moon', tasks: snoozed, defaultCollapsed: true },
    { key: 'backlog', label: 'Backlog', icon: 'bi-inbox', tasks: backlog, defaultCollapsed: true },
    { key: 'completed', label: 'Completed', icon: 'bi-check-circle', tasks: completed, defaultCollapsed: true },
  ].filter(s => s.tasks.length > 0); // Only show sections with tasks
}
```

### 2. `peers-core/src/ui/task-list/search-bar.tsx` — Search/Create Input

Input at the top of the task list. Typing filters tasks, pressing Enter creates a new task.

```tsx
import React, { useState } from 'react';

interface SearchBarProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  onCreateTask: (title: string) => void;
}

export function SearchBar({ searchText, onSearchChange, onCreateTask }: SearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchText.trim()) {
      onCreateTask(searchText.trim());
      onSearchChange('');
    }
  };

  return (
    <div className="p-2">
      <div className="input-group input-group-sm">
        <span className="input-group-text">
          <i className="bi bi-search" />
        </span>
        <input
          type="text"
          className="form-control"
          placeholder="Search or create task..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {searchText && (
          <button
            className="btn btn-outline-secondary"
            onClick={() => onSearchChange('')}
          >
            <i className="bi bi-x" />
          </button>
        )}
      </div>
      {searchText && (
        <small className="text-muted d-block mt-1">
          Press Enter to create "{searchText}"
        </small>
      )}
    </div>
  );
}
```

### 3. `peers-core/src/ui/task-list/task-row.tsx` — Task List Item

Individual task row with checkbox, status icon, title, body preview, and badges.

```tsx
import React from 'react';
import { ITask, TaskStatus } from '../../data/tasks';
import { DueBadge } from './due-badge';

interface TaskRowProps {
  task: ITask;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (task: ITask) => void;
  sortHandle: string; // CSS class name for drag handle
}

const statusIcons: Record<string, string> = {
  [TaskStatus.InProgress]: 'bi-play-circle-fill text-primary',
  [TaskStatus.Queued]: 'bi-clock text-warning',
  [TaskStatus.Backlog]: 'bi-inbox text-secondary',
  [TaskStatus.Done]: 'bi-check-circle-fill text-success',
  [TaskStatus.Canceled]: 'bi-x-circle text-muted',
};

export function TaskRow({ task, isSelected, onSelect, onToggleComplete, sortHandle }: TaskRowProps) {
  const isDone = task.status === TaskStatus.Done || task.status === TaskStatus.Canceled;
  const isSnoozed = task.snoozeDT && task.snoozeDT > new Date();

  return (
    <div
      id={task.taskId}
      onClick={() => onSelect(task.taskId)}
      style={{
        padding: '6px 10px',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'var(--bs-primary-bg-subtle)' : undefined,
        borderLeft: isSelected ? '3px solid var(--bs-primary)' : '3px solid transparent',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
      }}
      className="task-row"
    >
      {/* Drag handle */}
      <i
        className={`bi bi-grip-vertical text-muted ${sortHandle}`}
        style={{ cursor: 'grab', marginTop: '2px', fontSize: '0.9rem' }}
      />

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isDone}
        onChange={(e) => { e.stopPropagation(); onToggleComplete(task); }}
        style={{ marginTop: '3px', cursor: 'pointer' }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <i className={`bi ${statusIcons[task.status] || 'bi-circle'}`} style={{ fontSize: '0.75rem' }} />
          <span style={{
            textDecoration: isDone ? 'line-through' : undefined,
            opacity: isDone ? 0.6 : 1,
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {task.title}
          </span>
        </div>

        {/* Body preview */}
        {task.body && !isDone && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--bs-secondary-color)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '1px',
          }}>
            {task.body.substring(0, 80)}
          </div>
        )}

        {/* Badges row */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
          {task.dueDT && <DueBadge dueDT={task.dueDT} />}
          {isSnoozed && (
            <span className="badge bg-info-subtle text-info-emphasis" style={{ fontSize: '0.65rem' }}>
              <i className="bi bi-moon me-1" />
              Snoozed
            </span>
          )}
          {task.assignedTo && (
            <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ fontSize: '0.65rem' }}>
              <i className="bi bi-person me-1" />
              {task.assignedTo}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4. `peers-core/src/ui/task-list/due-badge.tsx` — Due Date Badge

Shows relative due date with color coding.

```tsx
import React from 'react';

interface DueBadgeProps {
  dueDT: Date;
}

export function DueBadge({ dueDT }: DueBadgeProps) {
  const now = new Date();
  const diffMs = dueDT.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  let colorClass: string;

  if (diffDays < 0) {
    label = `${Math.abs(diffDays)}d overdue`;
    colorClass = 'bg-danger-subtle text-danger-emphasis';
  } else if (diffDays === 0) {
    label = 'Today';
    colorClass = 'bg-warning-subtle text-warning-emphasis';
  } else if (diffDays === 1) {
    label = 'Tomorrow';
    colorClass = 'bg-warning-subtle text-warning-emphasis';
  } else if (diffDays <= 7) {
    label = `${diffDays}d`;
    colorClass = 'bg-info-subtle text-info-emphasis';
  } else {
    label = dueDT.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    colorClass = 'bg-secondary-subtle text-secondary-emphasis';
  }

  return (
    <span className={`badge ${colorClass}`} style={{ fontSize: '0.65rem' }}>
      <i className="bi bi-calendar-event me-1" />
      {label}
    </span>
  );
}
```

### 5. `peers-core/src/ui/task-list/unlogged-time.tsx` — Timer Widget

Shows a running timer for the selected task. Start/stop creates log entries.

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { ITask } from '../../data/tasks';
import { LogEntries } from '../../data/log-entries';
import { newid, myUserId } from '@peers-app/peers-sdk';

interface UnloggedTimeProps {
  task: ITask | null;
}

export function UnloggedTime({ task }: UnloggedTimeProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when task changes
  useEffect(() => {
    stop(false); // don't save log entry on task change
    setElapsed(0);
  }, [task?.taskId]);

  function start() {
    if (!task) return;
    startTimeRef.current = new Date();
    setRunning(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
      }
    }, 1000);
  }

  function stop(saveEntry = true) {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (saveEntry && running && task && startTimeRef.current) {
      const endDT = new Date();
      const durationMinutes = Math.round((endDT.getTime() - startTimeRef.current.getTime()) / 60000);
      if (durationMinutes > 0) {
        LogEntries().save({
          logEntryId: newid(),
          taskId: task.taskId,
          startDT: startTimeRef.current,
          endDT,
          durationMinutes,
          createdByUserId: myUserId(),
          groupId: task.groupId,
        });
      }
    }
    setRunning(false);
    startTimeRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => () => stop(false), []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!task) return null;

  return (
    <div className="d-flex align-items-center gap-2 px-2 py-1 border-bottom" style={{ fontSize: '0.8rem' }}>
      <i className="bi bi-stopwatch" />
      <span className="font-monospace">{formatTime(elapsed)}</span>
      {running ? (
        <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => stop(true)}>
          <i className="bi bi-stop-fill" />
        </button>
      ) : (
        <button className="btn btn-sm btn-outline-success py-0 px-1" onClick={start}>
          <i className="bi bi-play-fill" />
        </button>
      )}
    </div>
  );
}
```

### 6. `peers-core/src/ui/panels/task-list-panel.tsx` — Complete Left Panel

Assembles all task list sub-components. Loads tasks reactively, filters by search text, renders categorized sections with drag-and-drop.

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ITask, Tasks, TaskStatus } from '../../data/tasks';
import { selectedTaskId, statusFilter } from '../task-state';
import { SearchBar } from '../task-list/search-bar';
import { TaskRow } from '../task-list/task-row';
import { UnloggedTime } from '../task-list/unlogged-time';
import { categorizeTasks, TaskSection } from '../task-list/categorize-tasks';
import { newid, myUserId } from '@peers-app/peers-sdk';
// SortableList from peers-ui (imported at runtime — check exact import path)
// import { SortableList } from '@peers-app/peers-ui/components/sortable-list';

interface TaskListPanelProps {
  groupId: string;
  onCollapseToggle: () => void;
}

export function TaskListPanel({ groupId, onCollapseToggle }: TaskListPanelProps) {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [searchText, setSearchText] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Load tasks reactively
  useEffect(() => {
    async function load() {
      const allTasks = await Tasks().list(
        { groupId, parentTaskId: null }, // Top-level tasks only
        { sortBy: ['-sortOrder'] }
      );
      setTasks(allTasks);
    }
    load();

    const sub = Tasks().dataChanged.subscribe(() => load());
    return () => sub.unsubscribe();
  }, [groupId]);

  // Sync selected task
  useEffect(() => {
    selectedTaskId.loadingPromise.then(() => setCurrentTaskId(selectedTaskId() ?? null));
    const sub = selectedTaskId.subscribe(v => setCurrentTaskId(v ?? null));
    return () => sub.unsubscribe();
  }, []);

  // Filter tasks by search text
  const filteredTasks = searchText
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        t.body?.toLowerCase().includes(searchText.toLowerCase())
      )
    : tasks;

  const sections = categorizeTasks(filteredTasks);

  // Create task
  const handleCreateTask = useCallback(async (title: string) => {
    const task: ITask = {
      taskId: newid(),
      title,
      status: TaskStatus.InProgress,
      sortOrder: Date.now(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: myUserId(),
      groupId,
    };
    await Tasks().save(task);
    selectedTaskId(task.taskId);
  }, [groupId]);

  // Toggle complete
  const handleToggleComplete = useCallback(async (task: ITask) => {
    const isDone = task.status === TaskStatus.Done;
    await Tasks().save({
      ...task,
      status: isDone ? TaskStatus.InProgress : TaskStatus.Done,
      completeDT: isDone ? undefined : new Date(),
      updatedAt: new Date(),
    });
  }, []);

  // Select task
  const handleSelect = useCallback((taskId: string) => {
    selectedTaskId(taskId);
  }, []);

  // Toggle section collapse
  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedTask = tasks.find(t => t.taskId === currentTaskId) || null;

  return (
    <>
      <SearchBar
        searchText={searchText}
        onSearchChange={setSearchText}
        onCreateTask={handleCreateTask}
      />

      <UnloggedTime task={selectedTask} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map(section => {
          const isCollapsed = collapsedSections[section.key] ?? section.defaultCollapsed;
          return (
            <div key={section.key}>
              {/* Section header */}
              <div
                className="d-flex align-items-center gap-2 px-2 py-1"
                style={{
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--bs-secondary-color)',
                  userSelect: 'none',
                  backgroundColor: 'var(--bs-tertiary-bg)',
                }}
                onClick={() => toggleSection(section.key)}
              >
                <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down'}`}
                   style={{ fontSize: '0.7rem' }} />
                <i className={`bi ${section.icon}`} />
                <span>{section.label}</span>
                <span className="badge bg-secondary rounded-pill ms-auto" style={{ fontSize: '0.65rem' }}>
                  {section.tasks.length}
                </span>
              </div>

              {/* Section tasks */}
              {!isCollapsed && (
                <div>
                  {section.tasks.map(task => (
                    <TaskRow
                      key={task.taskId}
                      task={task}
                      isSelected={task.taskId === currentTaskId}
                      onSelect={handleSelect}
                      onToggleComplete={handleToggleComplete}
                      sortHandle={`sort-handle-${section.key}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredTasks.length === 0 && !searchText && (
          <div className="text-center text-muted p-4">
            <i className="bi bi-list-task d-block mb-2" style={{ fontSize: '2rem' }} />
            <p>No tasks yet</p>
            <small>Type in the search bar and press Enter to create one</small>
          </div>
        )}
      </div>
    </>
  );
}
```

**Notes on drag-and-drop:** The `SortableList` component from `peers-ui/src/components/sortable-list.tsx` uses `sortablejs` and expects items with a `sortOrder` property. Integration approach:
- Import `SortableList` from peers-ui (check if it's exported from the package or needs a direct import)
- Wrap each section's task list in `<SortableList>` with `onUpdate` that saves new `sortOrder` values
- Use `dragHandleClassName` matching the sort handle class in `TaskRow`
- If the import isn't straightforward, replicate the sortablejs integration locally in the task list

## Files to Modify

### 7. `peers-core/src/ui/tasks.tsx` — Replace Placeholder Left Panel

Replace `TaskListPanelPlaceholder` with the real `TaskListPanel` component. Pass `groupId` from the user context (get default group ID).

```tsx
// Replace the placeholder import and usage:
import { TaskListPanel } from './panels/task-list-panel';

// In the left panel section, replace <TaskListPanelPlaceholder /> with:
<TaskListPanel groupId={groupId} onCollapseToggle={toggleLeft} />
```

The `groupId` should come from the user's default data context. Use `getUserContext().defaultDataContext().groupId` or equivalent.

## Verification

1. **Build:** `cd peers-core && npm run build` — compiles successfully
2. **Task list renders:** Open Tasks screen, see the empty state with "No tasks yet"
3. **Create task:** Type "My first task" in search bar, press Enter — task appears in "In Progress" section
4. **Create multiple tasks:** Create tasks in different states (change status via code/tools) — they appear in correct sections
5. **Search/filter:** Type in search bar — tasks filter by title match
6. **Select task:** Click a task row — it highlights with blue left border, `selectedTaskId` updates
7. **Toggle complete:** Click checkbox — task moves to "Completed" section
8. **Collapse sections:** Click section headers — they collapse/expand, showing count badge
9. **Timer:** Select a task, click play — timer runs. Click stop — log entry is saved to LogEntries table
10. **Reactive updates:** Open a second window or modify task via code — list updates automatically via `dataChanged` subscription
