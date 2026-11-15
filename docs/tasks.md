---
title: Tasks
sidebar_position: 9
---

# Tasks

Tasks keeps your to-do list. Each task belongs to a group, or to your personal space, and syncs
to every device in that group. A task can have subtasks, a due date, a snooze, a repeat schedule,
and comments.

On a desktop, Tasks is an outline you zoom into, like a page in Notes. On a phone, it's a list
grouped by status. The outline arrives with Tasks 0.33.10 on the beta channel; on stable, every
screen shows the list until the outline reaches stable.

## The outline (desktop)

The page shows your top-level tasks, each group under its own heading when several groups are in
view. Zoom into a task and it becomes the page: its status, title, group, progress and details at
the top, then its subtasks. The path above the page goes back up. Click the arrow next to a task's
**done/total** count to zoom into it, or press ⌘. (Ctrl+. elsewhere) on it; ⌘, zooms back out.

Each task's status is the shape of its bullet: a half-filled ring is In Progress, a ring is
Queued, a dashed ring is Backlog, a moon is snoozed, and a filled check is done. Click the bullet
to complete the task (or reopen it); a task you complete stays where it was for a moment before
it folds away. Under each list, Backlog tasks fold into one **N later** line and closed tasks into
one **N done** line; click either to show them, and **Hide** to fold them again. The first words
of a task's details show under its title.

**Show** (at the top right) picks what the outline shows:

- **Open:** open tasks, with Backlog and done ones folded (the default).
- **Now:** what's in progress, and the tasks above it, so you see where it sits.
- **Upcoming:** tasks with a due date or a snooze, and the tasks above them.
- **All:** everything, Backlog and done tasks too (the newest 50 done tasks in each list).

### Writing tasks

Click anywhere on a task's row to edit its title. Typing works like a document:

| Keys | Action |
| --- | --- |
| Enter | A new task below (or the first subtask, when the task is expanded). In the middle of a title, it splits the title in two; at its start, the new task goes above. |
| Tab / Shift+Tab | Nest the task under the one above it / move it out from under its parent |
| ⌥↑ / ⌥↓ | Move the task up or down among the tasks with its status |
| ⌘↑ / ⌘↓ | Collapse or expand the task's subtasks |
| ⌘Enter | Complete or reopen the task |
| Shift+Enter | Edit the task's details right under its title (Escape or Shift+Enter goes back) |
| ↑ / ↓ | The task above or below, keeping your place in the line |
| ← at the start, → at the end | The end of the task above, or the start of the task below |
| Backspace on an empty line | Remove it (an empty task with no subtasks, details or comments is deleted) |
| ⌘I | Show or hide the task's details beside the page |
| ⌘P | Search |

A new task starts **Queued** (or Backlog, when you start it among the Backlog). It stays where you
typed it while you keep writing, then moves into the Queued part of its list when you leave it. It
isn't saved until it has a title. The **New task** box at the top of the page adds a Queued task to
the top of the Queued part and stays ready for the next one; the **New task** line at the end of a
list adds one after the last Queued task.

Drag a task by its bullet to move it. Dropped above or below another task's middle, it goes right
there; dropped to the right of a task's bullet, it goes inside as its first subtask. Dropped next
to an open task, it takes that task's status. A task can't be dropped into its own subtasks, or at
the top level of another group (move it between groups from its details instead).

### Details and the dock

**Details** shows the current task beside the page: its title, its status (In progress, Queued,
Backlog, Done or Canceled), its due date, snooze, repeat, parent and group (click one to change
it), its details, its subtasks with a box to add one, and its comments and logged time. The arrows
in its corner open the task as the page. Drag the panel's left edge to resize it.

The dock at the bottom shows your unlogged time. Click it to pause, resume or reset the timer
(paused, you can type a new time), and to log the time to any task in progress. Completing a task
logs the time to it, as before.

Search (⌘P) finds open tasks by their title and details as you type, and closed ones by full text
a moment later; pick one to go to it.

## On a phone: the list

The list is grouped into sections:

- **Due Soon:** Queued and Backlog tasks due within a week.
- **Recently Completed:** what you've finished since you last cleared it.
- **In Progress**, **Snoozed**, **Queued**, **Backlog**, and **Completed.**

A snoozed task waits in **Snoozed** and comes back to In Progress when its time is up. A snoozed
task is always In Progress: snoozing a Queued or Backlog task moves it to In Progress, and moving a
snoozed task out of In Progress (or closing it) clears its snooze. A task with
subtasks shows its first open subtask under it, indented, with **show more** for the rest. You can
check a subtask off right there.

Typing in the search box searches the groups in view once you pause typing. Open matches come
first; completed and canceled matches follow under **Completed**. Press Enter to create a task with
that title instead.

A task's details show its id at the top, next to its status. Click it to copy the id, a short way
to point someone (or an agent) at that task that stays the same when the title changes.

## Mentions

Type `@` or `<` in a task's details or a comment to link a person, another task, or a record from
another package (a note, say), from any of your groups. `@task:` narrows the search to tasks, and
the picker shows the start of the highlighted task's details. To link a task by its id, copy the
id from the task, then type `<` and paste it. The link shows the record's current title, struck
through once a task is Done or Canceled, and a click opens it, switching groups when it's in
another one. Elsewhere in Peers, `@` and `<` find tasks the same way. See
[Mentions](./Packages/mentions).

## Choosing groups

The groups menu picks which groups Tasks shows: in the outline, the arrow next to the first entry
of the path above the page; on a phone, the groups button in the list header (next to the timer).

- **Current group:** follows the group selected at the top of the app (the default).
- **All groups:** your personal space and every group you're in.
- **Choose groups:** check any set of them, for example Personal and one work group.

With more than one group in view, each task shows its group, and the header shows which groups
are in view. In the outline, a new task goes into the group of the list you add it to (the
**New task** box at the top level adds to the first group listed). On a phone, a new task goes
into the current group if it's in view, otherwise the first group listed; start its title with
`#groupname` to put it in a specific group. A subtask always goes in its parent's group.

## Closing a task with subtasks

A task closes (Done or Canceled) only with its subtasks. Closing one that still has open subtasks,
at any level, asks first: **Complete them too**, **Cancel them too**, or **Keep it open**. Each
subtask closed this way gets a comment saying which task it was closed with. A repeating subtask
closes too, rather than moving to its next date. The unlogged time goes to the task you closed,
not to its subtasks.

The question counts subtasks in every group in view, so a subtask kept in another group from its
parent is included when that group is in view. This applies to repeating tasks as well, even
though completing one moves it to its next date.

## Moving tasks around

Right-click a task on desktop, or touch and hold it on a phone, for its menu. In the outline you
can also drag a task by its bullet (see [Writing tasks](#writing-tasks)). Every action is one
tap: move to the top or bottom, move down a status, snooze until tomorrow or another time, set the
status, or set the due date. On a phone the menu opens as a sheet from the bottom of the screen.

### Where moved tasks land

- **Move to the top** puts the task at the top of its section. If you moved other tasks to the top
  in the last five minutes, it lands just below them. So when you go down the list picking what
  to do today, your picks stay in the order you picked them.
- **Move to the bottom** works the same way at the other end: the task lands just above the tasks
  you moved to the bottom in the last five minutes.
- **Move down a status** takes In Progress to Queued and Queued to Backlog. The task goes to the
  top of its new section, with the same five-minute rule, and any snooze is cleared. Changing the
  status to a lower one from the menu or the task's details does the same.
- Dragging a task puts it exactly where you drop it.

### On a phone

Swipe a task:

- **Left:** move it down a status (In Progress to Queued, Queued to Backlog).
- **Right:** snooze it until tomorrow morning.

Touch and hold until the task lifts, then:

- **Drag up** to move it to the top, or **down** to move it to the bottom.
- **Let go without moving** to open its menu.

A swipe that doesn't go far enough springs back without doing anything. Scrolling the list works
as usual: start moving up or down without holding first.

## For agents and the CLI

Tasks' tools work in the group the call is made in (`-c <groupId>` on the CLI; your personal
space by default).

- **`describe-task`** `{ taskId }` writes a task up as Markdown: its status, where it sits, its
  details and plan, its subtasks, its newest comments with who wrote them, the time logged (its
  own, and with its subtasks), and what keeps it from closing. Optional: `subtaskDepth` (1 by
  default, up to 5; 0 lists none), `includeComments` (true by default), `commentLimit` (20 by
  default, up to 100).
- **`get-task`** `{ taskId, includeSubtaskIds? }` returns a task's stored fields, and its direct
  subtasks' ids if asked.
- **`write-task`** creates, updates, or deletes a task. An update that closes a task with open
  subtasks fails unless it says how to close them: `"openSubtasks": "Done"` or `"Canceled"`. A
  `snoozeDT` makes the task In-Progress, so a call that snoozes it with another status fails, and
  a status other than In-Progress clears its snooze.
- **`write-task-comment`** adds a comment to a task, or deletes one.

```bash
peers tools run describe-task '{"taskId": "<taskId>"}'
peers tools run write-task '{"operation": "update", "taskId": "<taskId>", "status": "Done", "openSubtasks": "Done"}'
```

Lists of tasks (`list-tasks`, `get-task`'s subtask ids, `describe-task`, and the Tasks card in
Voice Hub) come in one order: In Progress, then snoozed, Queued, Backlog, then Done and Canceled,
each by position.
