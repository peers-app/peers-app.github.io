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

## The Inbox

A task is in the **Inbox** until you decide where it belongs. Quick capture puts tasks there:
Desk's Capture and its add box, Notes' **Make task**, Voice Hub, and the Tasks card's quick
create. A task you add inside a list or under another task is already filed, so it starts with
that list's status as before.

The Inbox counts as open, like In Progress, Queued and Backlog, so its tasks show wherever open
tasks do: Due Soon and search, and Desk's **Plan the day** when it's due or overdue, or a
project's next task. To clear a task from it, give it its real status:
**Move down a status** (or a swipe left on a phone) sends it to Backlog, or pick any status from
its menu or details. Menus and pickers list Inbox first.

The Inbox status needs Tasks 0.33.19 or later. A device on an older Tasks keeps an Inbox task, but
doesn't list it under a status, and can only change its status, not edit it.

## The outline (desktop)

The page shows your top-level tasks, each group under its own heading when several groups are in
view. Zoom into a task and it becomes the page: its status, title, group, progress and details at
the top, then its subtasks. The path above the page goes back up. Click the arrow next to a task's
**done/total** count to zoom into it, or press ⌘] (Ctrl+] elsewhere) on it; ⌘[ or ⌘, zooms back
out.

Each task's status is the shape of its bullet: a ring with a dot is in the Inbox, a half-filled
ring is In Progress, a ring is Queued, a dashed ring is Backlog, a moon is snoozed, and a filled
check is done. Click the bullet
to complete the task (or reopen it); a task you complete stays where it was for a moment before
it folds away. Under each list, Backlog tasks fold into one **N later** line and closed tasks into
one **N done** line; click either to show them, and **Hide** to fold them again. The first words
of a task's details show under its title.

**Show** (at the top right) picks what the outline shows:

- **Open:** open tasks, with Backlog and done ones folded (the default).
- **Now:** what's in progress, and the tasks above it, so you see where it sits.
- **Upcoming:** tasks with a due date or a snooze, and the tasks above them.
- **All:** everything, Backlog and done tasks too (the newest 50 done tasks in each list).
- **Done:** what you finished in the last 7 days, newest first, under a heading for each day, in
  place of the outline. Each task says which task it's under and when it was finished; a repeating
  task shows each time you completed it. Zoomed into a task, it shows only what was finished below
  it. **Show 7 more days** goes further back. Click a task for its details, or its bullet to reopen
  it (for a repeating task, to undo that completion).

### Writing tasks

Click anywhere on a task's row to edit its title. Typing works like a document:

| Keys | Action |
| --- | --- |
| Enter | A new task below (or the first subtask, when the task is expanded). In the middle of a title, it splits the title in two; at its start, the new task goes above. |
| Tab / Shift+Tab | Nest the task under the one above it / move it out from under its parent |
| ⌥↑ / ⌥↓ | Move the task up or down among the tasks with its status |
| ⌘↑ / ⌘↓ | Collapse or expand the task's subtasks |
| ⌘Enter or Shift+Enter | Edit the task's details right under its title (Escape or Shift+Enter goes back). On a new task, it saves the title first. |
| ↑ / ↓ | The task above or below, keeping your place in the line |
| ← at the start, → at the end | The end of the task above, or the start of the task below |
| Backspace on an empty line | Remove it (an empty task with no subtasks, details or comments is deleted) |
| ⌘I | Show or hide the side panel with the task's details |
| ⌘P | Search |

No key completes a task: click its bullet, or pick Done in its details.

A new task starts **Queued** (or Backlog, when you start it among the Backlog). It stays where you
typed it while you keep writing, then moves into the Queued part of its list when you leave it. It
isn't saved until it has a title. The **New task** box at the top of the page adds a Queued task to
the top of the Queued part and stays ready for the next one (⌘Enter adds it and goes on to its
details); the **New task** line at the end of a list adds one after the last Queued task.

Drag a task by its bullet to move it. Dropped above or below another task's middle, it goes right
there; dropped to the right of a task's bullet, it goes inside as its first subtask. Dropped next
to an open task, it takes that task's status. A task can't be dropped into its own subtasks, or at
the top level of another group (move it between groups from its details instead).

### Details and the unlogged time

**Details** shows the current task beside the page: its title, its status (Inbox, In progress,
Queued, Backlog, Done or Canceled), its due date, snooze, repeat, parent and group (click one to change
it), its details, its subtasks with a box to add one, and its comments and logged time. The group
chip, and the group's name at the top of the panel, list the groups you can write in: pick one to
move the task there with its comments (a task with subtasks asks whether they go too, or stay
behind as top-level tasks). The tasks it's under are listed at the top; click one to see its
details instead. The arrows in its corner open the task as the page. Drag the panel's left edge
to resize it.

When you've zoomed into a task, its own details are a click away: **Details** beside its progress,
or click into its title or details on the page.

To move a task under another, click its parent chip (**No parent**, or the parent's name) and type
a few words of the new parent's title. Tasks whose titles match come first: the exact name, then
titles that start with what you typed, then titles with every word. Open tasks come before closed
ones, and tasks that already have subtasks come first. Each result shows its group and the tasks
it's under. Tasks whose details match come after. You can also drag a task onto another in the
outline.

Your unlogged time and the **Details** button sit in the middle of the row above the page. Click
the time to pause, resume or reset the timer (paused, you can type a new time), and to log the
time: to the current task (the one selected, or else the page's task), or to one of the open tasks
you logged time to most recently. Completing a task logs the time to it, as before.

Search (⌘P) finds open tasks by their title and details as you type, and closed ones by full text
a moment later; pick one to go to it. Paste a task's id (or a `peers://task/` link) to find just
that task, open or closed, in any of your groups. Going to a task in a group that isn't in view
adds that group to the view.

## On a phone: the list

The list is grouped into sections:

- **Due Soon:** Inbox, Queued and Backlog tasks due within a week.
- **Recently Completed:** what you've finished since you last cleared it.
- **Inbox**, **In Progress**, **Snoozed**, **Queued**, **Backlog**, and **Completed.**

Tap a section's header to open or close it. Due Soon, the Inbox and In Progress start open, and the
rest start closed, except that Queued starts open when In Progress is empty, and Backlog when
Queued is empty too. A task's subtasks start with every status section open, Completed included,
when there are 10 or fewer.

A snoozed task waits in **Snoozed** and comes back to In Progress when its time is up. A snoozed
task is always In Progress: snoozing a Queued or Backlog task moves it to In Progress, and moving a
snoozed task out of In Progress (or closing it) clears its snooze. A task with
subtasks shows its first open subtask under it, indented, with **show more** for the rest. You can
check a subtask off right there.

Typing in the search box searches the groups in view once you pause typing. Open matches come
first; completed and canceled matches follow under **Completed**. Press Enter to create a task with
that title instead. A task's id (or a `peers://task/` link) finds just that task, in any of your
groups.

A task's details show its id at the top, next to its status. Click it to copy the id, a short way
to point someone (or an agent) at that task that stays the same when the title changes.

## Mentions

Type `<` in a task's details or a comment to link a person, another task, or a record from
another package (a note, say), from any of your groups; `@` finds people only. `<task:` (or
`<tasks:`) narrows the search to tasks, and the picker shows the start of the highlighted task's
details. To link a task by its id, copy the id from the task, then type `<` and paste it. The link
shows the record's current title, struck through once a task is Done or Canceled, and a click
opens it. Elsewhere in Peers, `<` finds tasks the same way. See [Mentions](./Packages/mentions).

A link to a task opens it in Tasks without switching groups, from a mention, a notification, or
another app's **Open in Tasks**, since Tasks can show any of your groups (Tasks 0.33.24 and
later). When the task's group isn't in view, Tasks adds it to the groups it shows, next to the
ones already there, and the groups menu changes it back. A record from an app that
shows one group at a time still switches groups to open it.

## Choosing groups

The groups menu picks which groups Tasks shows: in the outline, the arrow next to the first entry
of the path above the page; on a phone, the groups button in the list header (next to the timer).

- **Current group:** follows the group selected at the top of the app (the default).
- **All groups:** your personal space and every group you're in.
- **Choose groups:** check any set of them, for example Personal and one work group.

With more than one group in view, each task shows its group, and the header shows which groups
are in view. Each group has the color and icon it has everywhere else in Peers (Tasks 0.33.26
and later, on Peers 0.33.19 and later; before that, Tasks picks its own colors). Change them in
Peers ([Groups → Colors and icons](./System/Groups#colors-and-icons)). In the outline,
a new task goes into the group of the list you add it to (the **New task** box at the top level
adds to the first group listed). On a phone, a new task goes
into the current group if it's in view, otherwise the first group listed; start its title with
`#groupname` to put it in a specific group. A subtask always goes in its parent's group.

## Repeating tasks

Completing a repeating task doesn't close it. Tasks records the completion, with the time logged,
moves the due date to the next one in the schedule, and puts the task at the top of **Backlog**.
Its due date brings it back when it's needed: in Due Soon, in Desk's **Plan the day**, and on
Calendar. Queued stays for the tasks waiting to be picked up. A task set to repeat with **No
Schedule** has no next date to bring it back, so it goes to the top of Queued instead.

Before Tasks 0.33.27, a completed repeating task went to the top of Queued.

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
tap: move to the top or bottom, move down a status, snooze until tomorrow (3 AM, when Tasks' day
starts) or another time, set the status, or set the due date. Each status shows the icon it has in
the view you opened the menu from. On a phone the menu opens as a sheet from the bottom of the screen.

### Where moved tasks land

- **Move to the top** puts the task at the top of its section. If you moved other tasks to the top
  in the last five minutes, it lands just below them. So when you go down the list picking what
  to do today, your picks stay in the order you picked them.
- **Move to the bottom** works the same way at the other end: the task lands just above the tasks
  you moved to the bottom in the last five minutes.
- **Move down a status** takes In Progress to Queued and Queued to Backlog. The task goes to the
  top of its new section, with the same five-minute rule, and any snooze is cleared. Changing the
  status to a lower one from the menu or the task's details does the same. On an Inbox task it
  clears it to Backlog, keeping its place.
- Dragging a task puts it exactly where you drop it.

### On a phone

Swipe a task:

- **Left:** move it down a status (In Progress to Queued, Queued to Backlog, Inbox to Backlog).
- **Right:** snooze it until 3 AM tomorrow.

Touch and hold until the task lifts, then:

- **Drag up** to move it to the top, or **down** to move it to the bottom.
- **Let go without moving** to open its menu.

A swipe that doesn't go far enough springs back without doing anything. Scrolling the list works
as usual: start moving up or down without holding first.

## For agents and the CLI

Tasks' tools work in the group the call is made in (`-c <groupId>` on the CLI; your personal
space by default).

- **`findTasks`** `{ words }` finds tasks by the words in their title or details, open or
  closed (Task List v2, Tasks 0.33.25 and later). Every word must appear, in any case, and can be
  part of a longer word. Tasks whose title has every word come first, then open before closed.
  Optional: `status`, and `limit` (10 by default, up to 25). Each task's details are cut to 300
  characters; `describe-task` has them whole. Use it to get a task's id from what it's called.
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
  a status other than In-Progress clears its snooze. Completing a task (status Done) logs your
  unlogged time against it, as the checkbox does; add `"logTime": false` to complete it without
  logging, and the timer keeps counting (Tasks 0.33.13 and later). `"status": "Inbox"` puts a
  task in the Inbox (Tasks 0.33.19 and later); a new task without a status goes to Backlog.
- **`write-task-comment`** adds a comment to a task, or deletes one.

```bash
peers tools run findTasks '{"words": "car insurance"}'
peers tools run describe-task '{"taskId": "<taskId>"}'
peers tools run write-task '{"operation": "update", "taskId": "<taskId>", "status": "Done", "openSubtasks": "Done"}'
peers tools run write-task '{"operation": "update", "taskId": "<taskId>", "status": "Done", "logTime": false}'
```

Lists of tasks (`list-tasks`, `get-task`'s subtask ids, `describe-task`, and the Tasks card in
Voice Hub) come in one order: Inbox, In Progress, then snoozed, Queued, Backlog, then Done and
Canceled, each by position.

## For packages that use Tasks

Since Tasks 0.33.19 a task's status can be **Inbox**.

- **Reading.** Tasks v1's table gives `status` as stored, and so does `get-task` through Tasks v2
  and v3, so they can return `"Inbox"`. Treat a status you don't know as open: everything but
  Done and Canceled is. Task List v1 and Tasks Screen v1 to v3 show an Inbox task as Backlog.
- **Writing Inbox.** Consume Tasks v4 (`peers contracts add 00mp287gdl5atltgs5bh0vm9z@4`) and call
  its `write-task` with `"status": "Inbox"`. Task List v2 and Tasks Screen v4 take Inbox too.
- **Groups on an older Tasks** don't provide v4, and the call fails with "No contract provider
  registered for 00mp287gdl5atltgs5bh0vm9z v4" (or "… is not a registered provider for …"). Fall
  back to v1, with Backlog, only on that error for that contract and version. Any other failure
  may come after the task was written, so retrying it could make the task twice. Desk and Notes do
  this with a small `orOlderVersion` helper.

### Showing a task's details in your screen

Since Tasks 0.33.29, Tasks provides **Task Details v1** (`00mwx82nexo2a4jfj0holtsa2`), a
[UI contract](./Packages/ui-contracts) with one view, `details`: the panel Tasks shows beside its
outline, for one task. Desk's side panel uses it, so a task opened in Desk looks and works as it
does in Tasks.

- **Add it** with `peers contracts add 00mwx82nexo2a4jfj0holtsa2@1`, and consume it as optional:
  `pkg.consumes(TaskDetailsUI, { optional: true })`.
- **Make the client in the task's group:**
  `hostUIContract<typeof TaskDetailsUI>("00mwx82nexo2a4jfj0holtsa2", 1, { dataContextId: groupId })`.
- **Props:** `taskId`; `comments`, which is `all` (the default), `latest` (what people wrote, the
  latest first, with Show earlier) or `none`; `closable`, for a close button; and
  `focusDescription`, to put the keyboard in the description when it shows.
- **Events:** `moved` (`{ taskId, groupId }`) when the task turns up in another group, so you can
  follow it; `closed` from its close button; and `open` for a task in its path, a subtask or a
  mention. Return `true` from `open` to show it yourself, or `false` to let Peers open it as usual.
- **Edits are Tasks' own.** Status, title, description, subtasks and comments are saved by Tasks,
  as Tasks, in the task's group. Your screen doesn't need Tasks' API contracts for them, and the
  view never changes what the Tasks screen has selected.
- **Give it a fallback.** A group whose Tasks is older than 0.33.29 has no Task Details, so show
  something useful there, such as the task's title and a button that opens it in Tasks.
