# Phase 6: Polish

## Summary

Refinements, resizable panels, edge case handling, and end-to-end testing. This phase takes the functional implementation from Phases 1-5 and makes it production-ready.

## Prerequisites

Phases 1-5 complete.

## Tasks

### 1. Resizable Panels with react-split-pane

Replace the fixed-width flexbox layout in `tasks.tsx` with `react-split-pane` for user-resizable dividers.

**File:** `peers-core/src/ui/tasks.tsx`

`react-split-pane` is already available in peers-ui (used in `main-content-container.tsx`). Add a vertical SplitPane between the left panel and center+right, and optionally between center and right.

```tsx
import SplitPane from 'react-split-pane';

// Persist split positions to localStorage (same pattern as main-content-container.tsx)
const leftSplitKey = 'tasks:leftSplitPos';
const rightSplitKey = 'tasks:rightSplitPos';

// Use SplitPane for left/center split and center/right split
// Only render SplitPane when both panels on either side are expanded
```

**Considerations:**
- When the left panel is collapsed, no split pane for that side (just the collapsed strip)
- When the center panel is hidden (no task selected), the left panel fills available space
- When the right panel is collapsed, no split pane for that side
- Persist split positions to `localStorage` (not deviceVar — localStorage is simpler for pixel values)

### 2. Drag-and-Drop with SortableList

Integrate `SortableList` from `peers-ui/src/components/sortable-list.tsx` into the task list sections.

**File:** `peers-core/src/ui/panels/task-list-panel.tsx`

```tsx
import { SortableList } from '@peers-app/peers-ui';

// Each section wraps its tasks in SortableList:
<SortableList
  items={section.tasks}
  renderItem={({ item, sortHandle }) => (
    <TaskRow
      task={item}
      isSelected={item.taskId === currentTaskId}
      onSelect={handleSelect}
      onToggleComplete={handleToggleComplete}
      sortHandle={sortHandle}
    />
  )}
  onUpdate={async ({ items, ixMoved }) => {
    // Save updated sortOrder for moved items
    for (const ix of ixMoved) {
      await Tasks().save({
        ...items[ix],
        updatedAt: new Date(),
      });
    }
  }}
  dragHandleClassName="task-drag-handle"
/>
```

**Notes:**
- `SortableList` requires items to have a `sortOrder` property — `ITask` already has this
- The `dragHandleClassName` should match the class on the grip icon in `TaskRow`
- Cross-section dragging (e.g., moving a task from Queued to In Progress) would require `listsGroup` and `onAdd` — implement this if `SortableList` supports it, or leave as a future enhancement

### 3. Markdown Description with MarkdownEditor

Upgrade the plain textarea in `ContentPanel`'s `EditableBody` to use the `MarkdownEditor` component from peers-ui for rich markdown editing.

**File:** `peers-core/src/ui/panels/content-panel.tsx`

```tsx
// Replace the <textarea> in EditableBody with:
import { MarkdownEditor } from '@peers-app/peers-ui';
import { observable } from '@peers-app/peers-sdk';

// Use an observable for the body content
const [bodyObs] = useState(() => observable(task.body || ''));

<MarkdownEditor
  value={bodyObs}
  hideToolbar={false}
  autoFocus={false}
/>
```

**Auto-save strategy:** Subscribe to the observable and debounce saves (e.g., 1 second after last change). This replaces the click-to-edit / blur-to-save pattern with a more fluid editing experience.

### 4. Keyboard Shortcuts

Add keyboard shortcuts for common operations:

| Shortcut | Action |
|----------|--------|
| `n` | Focus search bar (when not in an input) |
| `Escape` | Close detail panel / deselect task |
| `j` / `k` | Move selection down/up in task list |
| `Enter` | Open selected task detail |
| `x` | Toggle complete on selected task |

**File:** `peers-core/src/ui/tasks.tsx` — add a `useEffect` with `keydown` listener

### 5. Responsive Behavior

Handle narrow viewport widths gracefully:

- Below 900px: Auto-collapse the right panel
- Below 600px: Auto-collapse both side panels, show only center content
- Ensure minimum widths prevent panels from becoming unusable

**File:** `peers-core/src/ui/tasks.tsx` — add `window.innerWidth` check and `resize` listener

### 6. Edge Cases

- **Task deleted while selected:** If the selected task is deleted, clear `selectedTaskId` and show empty state
- **Group changes:** If the user switches groups, reload tasks for the new group
- **Empty thread IDs:** Handle `threadIds: []` same as `threadIds: undefined`
- **Long task titles:** Ensure ellipsis truncation works correctly in both the list and detail views
- **Rapid clicking:** Debounce task saves to prevent race conditions
- **Thread creation failure:** Show error toast if thread creation fails, revert `threadIds` update

### 7. Visual Polish

- **Hover states:** Add subtle hover background on task rows (`:hover` via inline style `onMouseEnter`/`onMouseLeave`)
- **Transitions:** Smooth collapse/expand animations (CSS transition on width, or use a library)
- **Loading states:** Show skeleton/spinner while tasks are loading on first render
- **Empty states:** Ensure all three panels have meaningful empty states with appropriate icons

### 8. Accessibility

- Tab navigation through task list
- ARIA labels on interactive elements
- Screen reader announcements for status changes
- Focus management when panels open/close

## Verification — End-to-End Test Scenarios

### Scenario 1: Basic Task Lifecycle
1. Open Tasks from sidebar
2. Type "Review PR #42" in search bar, press Enter
3. Task appears in "In Progress" section
4. Click the task — detail panel opens
5. Edit the title to "Review PR #42 - auth changes"
6. Add description: "Check the OAuth flow changes"
7. Click checkbox — task moves to "Completed" section
8. Click checkbox again — task moves back to "In Progress"

### Scenario 2: Conversation Thread
1. Select a task
2. Right panel shows "Start conversation" button
3. Click it — thread is created, compose input appears
4. Type "Need to discuss approach" and send
5. Message appears in thread
6. Select a different task — right panel switches to that task's thread (or empty state)
7. Go back to first task — original thread is still there

### Scenario 3: Panel Collapse Persistence
1. Collapse the left panel by clicking chevron
2. Collapse the right panel
3. Reload the page
4. Both panels should still be collapsed
5. Click the collapsed strips to expand
6. Reload — panels should be expanded

### Scenario 4: AI Task Creation
1. Open chat/thread and say "Create a task to deploy the new feature by Friday"
2. Shell assistant uses `new-task` tool
3. Task appears in Tasks list with title and due date set
4. Click the task to see details

### Scenario 5: Drag-and-Drop Reorder
1. Create 3 tasks in the "In Progress" section
2. Drag a task from position 3 to position 1 using the grip handle
3. Reload the page — new order persists
4. Verify `sortOrder` values updated correctly

### Scenario 6: Timer / Time Tracking
1. Select a task
2. Click the play button on the timer
3. Wait 5+ seconds
4. Click stop
5. Open task detail — time log shows the entry
6. Total time is calculated correctly

### Scenario 7: Status and Sections
1. Create tasks in different statuses (In-Progress, Queued, Backlog)
2. Verify each appears in the correct section
3. Change a task's status via the detail panel dropdown
4. Verify it moves to the new section in the list
5. Set a due date within 48 hours — verify it appears in "Due Soon"
6. Set a snooze date in the future — verify it appears in "Snoozed"

### Scenario 8: Search/Filter
1. Create 5 tasks with different titles
2. Type a partial title in the search bar
3. Only matching tasks should show
4. Clear search — all tasks reappear
5. Press Enter while searching — new task created with search text as title
