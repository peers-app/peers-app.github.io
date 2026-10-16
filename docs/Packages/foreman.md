---
title: Foreman task handoffs
---

Foreman creates draft coding jobs from Tasks comments. Install Foreman and Tasks in
the same group and run one Foreman daemon for that group. Post a comment whose entire
text is `foreman` (case-insensitive; surrounding whitespace is allowed). The resulting
draft keeps the task's title and body unchanged and credits the comment author.
Review the draft and choose Plan or Implement before any agent work starts.
Plan asks which planner to use and defaults to Sol. Implement asks which implementer
to use. The choices are Grok, Sol, Opus, Astra, and Fable. Opus and Fable run through
Claude Code on the daemon machine's Claude subscription. Those runs stay on that
login: Foreman does not pass API keys or Claude settings, loads no MCP servers, read-only calls
cannot edit or run commands, and the calls do not write into the interactive Claude
session. An unknown model blocks the job.

After the daemon activates Foreman at startup, local comment inserts are handled
immediately. Every 30 seconds the daemon also sweeps all pending comments, covering
remote/PWA comments, edits, and comments synchronized later from devices that cannot
run isolated providers. Each sweep queries comments containing `foreman`, checks
for exact trimmed matching, and reads all matching pages from the beginning. Ordinary comments do not use recovery
RPC pages. Tasks is an optional dependency; missing or delayed registration is retried without blocking Foreman.
Ordinary UI comments use this live path even when optional fields, such as logged time,
are unset; the Tasks contract omits undefined fields before transporting the event.

The trigger's comment ID is also the job ID, so listener/recovery races converge on
one job. The trigger comment link is immutable after job creation. The job is saved
first, then Tasks receives a system acknowledgement with a link to it, and the trigger is soft-deleted. Failed acknowledgements or deletions are
retried without recreating the job. A task that has not synchronized yet remains
pending. Recovery does not require task creation-device metadata or a checkpoint file.

Foreman posts best-effort system comments when a plan or branch is ready for review,
when a job is done (with merged refs), or when it is blocked (with the reason). Tasks
comment failures do not undo job transitions. Follow the acknowledgement's job link,
or **Open task** in the Foreman header, to navigate between the two. These links use
`?jobId=` and `?taskId=` in the current group, including when the destination tab is
already open. Links also open jobs beyond the list's first 500 records: Foreman fetches
the selected job directly and keeps it current on refresh. Foreman saves pending document
edits and waits for an in-progress detail action before switching jobs; a failed save
keeps the current job and its unsaved edits
open for retry and restores the URL to that job. Open the same link again to retry
saving and navigation. This also applies to the first external job link after a cold load,
before you have selected any jobs manually. Foreman keeps
its current `jobId` in the tab link, updates it when you select another job, and clears it
when you close or delete the job. This preserves selection while the UI loads and when
switching tabs. Tasks saves its selection and opens task details on mobile before removing
`taskId` from the link, including when you were viewing the task list or subtasks. Ordinary
mobile list selection still uses two taps to open details. Tasks
contract writes stay in the authorized group, use the authenticated caller for authorship,
and reject extra arguments that could impersonate another author or IDs from other groups.

**Use one daemon per group.** Deterministic job IDs prevent duplicate records but do
not prevent two daemons from executing the same job. Multiple active daemons require
a future lease/leader-election design. The local PID file is not a distributed lock.

## Sequential child batches

On a job that has only draft children, Children can stay on **Review each child**
or switch to **Run sequentially, review once**. Start is available from a draft
or a plan that is ready for review. Every direct child must still be a draft,
and no child may depend on a later sibling, even through an outside job.
The parent cannot depend on its own snapshot children, and a child cannot
depend on the parent. An unfinished outside job waits for the batch to merge,
so a child also cannot reach an earlier sibling or the parent through one. Parent dependencies must
finish before children start and before combined review opens; a canceled
dependency blocks the run. Other outside dependency waits keep the parent in
Needs You.

**Start sequential run** asks which planner and implementer every child should use,
defaulting to the parent's choices. Foreman writes those models onto each child before
the run begins, so a model changed later on one child cannot send that child to a
different agent mid-run. The parent's conversation records the models each child was
routed to.

Foreman then plans and implements those children one at a time. It still runs
checks and model review for each child, and it does not stop for a human plan
or implementation review. The reviewer asks for another round on any `must`
finding, and on `should` findings when it judges the change not ready; the
implementer fixes each one or explains why it rejects it, and a new review
confirms the result. A child is never included on an unreviewed fix.
Successful children are collected onto one parent
branch. When the last child finishes, the parent opens a single review. Stage
for review, approve, and merge work the same way as any other job.

If a child fails, raises a blocking open question during planning or implementation,
or tries to split again, the batch pauses. Earlier children stay included. A blocking
question is a product or scope decision only a person can make, or a problem that keeps
the work from being trustworthy. Checks the agent could not run, such as live device or
hardware verification, an environment or permission it did not have, or a failure that
is unrelated or pre-existing, are recorded as verification notes instead. They stay in
the child's summary for the reviewer and for you, and they do not pause the run.

A child paused on blocking questions shows them in its header and offers two ways on.
**Continue without changes** keeps the implementation already on the branch, records your
optional reason, and runs checks and review on that work; use it when the answer does
not change the code. **Retry implementation** runs the implementer again; add a note
first when the answer should change the code. If a change request arrives during checks,
review, or a repair, Foreman runs the implementer with that feedback and checks and reviews
the result before including the child. A withdrawn decision requires implementation again,
even after a restart; the saved acceptance line alone cannot approve continuation.
Retry plan replans the child, or cancel the run. A retry can select a new model; an omitted or null
model keeps the frozen route and an invalid model is rejected.
Canceling the parent, including from the combined review, also cancels children
that are not already done. A child reopened as a draft after that cancel can
run on its own through later planning and implementation, including automatic
merge when eligible. A merging child prevents cancellation before any other
child is saved as canceled. Interrupted cancellations finish after restart.
A child in the run cannot be deleted, moved to another parent,
started ahead of the child Foreman is waiting on, or turned into its own
sequential run. An included child is canceled only by canceling the batch. If
a snapshotted child goes missing, the batch pauses; restore that child and
press Resume sequential run, or cancel the batch. Empty or unreadable snapshots
permit only Cancel. Once all children are included, failures during the parent’s
own work offer the normal Retry plan, Retry implementation, and Retry merge
actions. Direct or indirect later sibling dependencies added after the run
starts are rejected. A paused batch does not offer a partial subset as the
final review. The fixed snapshot can start again from
draft or plan-review only when every direct child is a draft again.
