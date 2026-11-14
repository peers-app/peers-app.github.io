---
title: Tasks
sidebar_position: 9
---

# Tasks

Tasks keeps your to-do list. Each task belongs to a group, or to your personal space, and syncs
to every device in that group. A task can have subtasks, a due date, a snooze, a repeat schedule,
and comments.

## The list

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

## Choosing groups

The groups button in the list header (next to the timer) picks which groups the list shows:

- **Current group:** follows the group selected at the top of the app (the default).
- **All groups:** your personal space and every group you're in.
- **Choose groups:** check any set of them, for example Personal and one work group.

With more than one group in view, each task shows its group, and the header shows which groups
are in view. A new task goes into the current group if it's in view, otherwise the first group
listed. Start its title with `#groupname` to put it in a specific group. A subtask always goes in
its parent's group.

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

Right-click a task on desktop, or touch and hold it on a phone, for its menu. Every action is one
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
- Dragging a task by its handle puts it exactly where you drop it.

### On a phone

Swipe a task:

- **Left:** move it down a status (In Progress to Queued, Queued to Backlog).
- **Right:** snooze it until tomorrow morning.

Touch and hold until the task lifts, then:

- **Drag up** to move it to the top, or **down** to move it to the bottom.
- **Let go without moving** to open its menu.

A swipe that doesn't go far enough springs back without doing anything. Scrolling the list works
as usual: start moving up or down without holding first.

### Keyboard shortcuts (desktop)

The shortcuts act on the selected task in the task list. The list menu (☰) shows them too.

| Keys | Action |
| --- | --- |
| ↑ / ↓ (or k / j) | Select the task above or below |
| Shift+← | Move down a status, to the top of the new section |
| Shift+→ | Snooze until tomorrow |
| Shift+↑ / Shift+↓ | Move to the top or bottom |
| Alt+↑ / Alt+↓ | Swap with the task above or below |
| x | Complete or reopen |
| n | Search or create a task |
| Esc | Clear the selection |

When the selected task moves away, the task below it is selected next (or the one above, at the end
of a section). If its section is now empty, the first task in the next section down is selected,
and that section opens. You keep your place in the list: it doesn't scroll to follow the task you
moved.

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
