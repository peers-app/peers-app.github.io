# Task List UX Improvements — Working Document

Collected tasks related to the task list item UX: quick actions, right-click menu, list view indicators, mobile interactions, and the popover redesign.

---

## Core: Quick Actions / Context Menu

These tasks form the heart of this effort — replacing or augmenting how users interact with individual tasks in the list.

### 1. Task list quick actions menu
- **ID:** `00mnwn8mze98n6inpinf2y7hr`
- **Status:** In-Progress
- **Body:** *(none — title only)*
- **Notes:** Umbrella task for adding a quick actions menu to task list items.

### 2. Add a right-click menu for tasks
- **ID:** `00mma5loqgmkb6ciqqsulsyyt`
- **Status:** In-Progress
- **Body:**
  > Add options for:
  > - move to top
  > - move to bottom
  > - submenu to snooze (1 hour, this afternoon, this evening, tomorrow, this/next weekend, next week, next month)
  > - submenu to change status / category (in-progress, queued, etc)
- **Notes:** Most detailed spec. Defines the menu items and snooze submenu structure.

### 3. Change list view to have popover instead of right menu
- **ID:** `00mnkoyocqgpps86y96xlgv0i`
- **Status:** Queued
- **Body:**
  > This will replace the right menu and get rid of the need to double click which is unreliable and not obvious. When you click on a task the tooltip will overlay with task details and the option to view details. Other buttons can be added along the top or side for easy actions like bump up and down, snooze, etc.
- **Notes:** This is the **design direction** — popover replaces the right-side drawer. Quick action buttons live on the popover. Created Oct 2023.

### 4. Quick action: snooze until tomorrow
- **ID:** `00mnwn963m3crbxp4cv6p5nhs`
- **Status:** In-Progress
- **Body:** *(none)*
- **Notes:** Specific quick action — likely the first one to implement since snooze-tomorrow is the most common action.

### 5. Add bump down and bump up to right menu
- **ID:** `00mnkoyocqdehjptqa38og2q3`
- **Status:** Queued
- **Body:** *(none)*
- **Notes:** Reorder actions for the menu/popover.

### 6. Remove "snoozed" selection from status dropdown in right menu
- **ID:** `00mnkoyocq6cpklldozsj579b`
- **Status:** Queued
- **Body:** *(none)*
- **Notes:** Cleanup — snooze is controlled via snoozeDT, not status.

---

## List View Indicators

Tasks about what information is shown on each task row in the list.

### 7. In mobile list view also show indicator that task has content in the description
- **ID:** `00mnwneqbu2op4qrhfh8uh1fm`
- **Status:** In-Progress
- **Body:** *(none)*
- **Notes:** Visual cue (icon/badge) on list items that have a non-empty body/description.

### 8. Add parent task indicator in checkbox area
- **ID:** `00mnkoyocq532vbj16du8ektq`
- **Status:** Queued
- **Body:** *(none)*
- **Notes:** Show that a task has subtasks or is a subtask.

### 9. Due date indicator color coding
- **ID:** `00mnt36blacvz7ohdpnblib0u`
- **Status:** Queued
- **Body (from title):**
  > For due date indicator, tomorrow should be blue and after that should be grey with progressively lighter colors the further out it is.

---

## Mobile-Specific Interactions

### 10. When snoozing a task on mobile automatically go back out to list
- **ID:** `00mnrp88a3q0kvbdbufwowr2m`
- **Status:** Queued
- **Body:**
  > Also make the snooze controls bigger.
  > Also improve the due date picker, ideally the date selector and date input are both immediately visible.
- **Notes:** Mobile UX polish for snooze flow.

---

## List Sections / Structure

Related to how the task list is organized (affects what quick actions are available).

### 11. In-progress and queued and backlog always need to be visible to drag tasks into them
- **ID:** `00mnnwda7qucmki7u641t5zjx`
- **Status:** Queued
- **Body:** *(none)*
- **Notes:** Section headers must remain visible as drop targets during drag-and-drop.

---

## Possibly Related (tangential)

These touch the task list UX but are less directly about quick actions:

| ID | Title | Status |
|----|-------|--------|
| `00mnwl56qv2iy8o6jueksxj20` | #peers #tasks add comments under description (log entries) | In-Progress |
| `00mnksasxh3eq3rdhtxh72bl1` | #Peers add details view for highlighted item in mentions autocomplete | Queued |
| `00mntd2ovi912xtcrfcjbymlv` | #peers add buffer to bottom of task list | In-Progress |
| `00mmdrujcmqm6gu8pr4uj2uu2` | Task sections work (recently completed, inbox, lazy loading, search) | In-Progress |

---

## Summary

**Direct scope (tasks 1–6):** 6 tasks about the quick actions / context menu / popover system
**Indicators (tasks 7–9):** 3 tasks about list item visual indicators
**Mobile (task 10):** 1 task about mobile snooze flow
**Structure (task 11):** 1 task about section visibility during drag

**Total:** 11 directly related tasks (3 In-Progress, 8 Queued)

### Implementation Status

**Context menu (right-click / long-press) — DONE:**
- Component: `peers-core/src/tasks/ui/task-list/task-context-menu.tsx`
- Desktop: right-click opens at cursor position
- Mobile: long-press (500ms) opens at touch position
- Closes on: outside click, Escape, scroll

**Menu actions implemented:**
- Snooze presets: 1 hour, this afternoon (contextual), this evening (contextual), tomorrow, this/next weekend, next week, next month
- Remove snooze (shown when task is snoozed)
- Move to top / Move to bottom
- Bump up / Bump down (within section)
- Set status: In-Progress, Queued, Backlog, Done, Canceled (current status indicated)

**Tasks addressed:** #1, #2, #4, #5 (fully), #6 (partially — snooze is handled via context menu, not status dropdown)

### Remaining Work
- Task #3 (popover instead of right menu) — deferred, separate UI pattern
- Tasks #7–9 (list view indicators) — separate work items
- Task #10 (mobile snooze flow) — separate UX polish
- Task #11 (section visibility during drag) — separate work item
