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
