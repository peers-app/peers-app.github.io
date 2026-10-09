---
sidebar_position: 12
---

# System Scheduler

System Scheduler (`system.scheduler`) wakes an isolated package's own tool at a time, on this device. The guest has no `setTimeout` that survives the worker. It calls `schedule`, and the host stores the wake-up and invokes the tool.

The desktop app and `peers-headless` provide it by importing `@peers-app/peers-device/scheduler`.

## Calls

`schedule` takes `at` (epoch milliseconds), `contractId`, `version`, `toolName`, and an optional JSON `payload`. The host returns `scheduleId`. `cancel` removes one schedule owned by the calling package. `list` returns schedules in the call's data context. An isolated caller sees only its own.

A package can schedule only a tool on a contract it provides. The host invokes that tool using the signed-in user's current access level, starting the worker if it is stopped. Normal tool authorization still applies. The payload is capped at 32,000 characters. `at` must fall within 366 days.

Official Timers' `fire-timer` and News' `refresh-feeds` require Writer (40), matching their
ordinary write/refresh operations. Writers may call these tools directly as well. Losing
Writer access can stop their scheduled callbacks; scheduling does not grant Self authority.

## Device local

Schedules live in the device persistent variable `system:scheduler`. They do not sync. A timer created on another device gets a local alarm on this device only when something on this device schedules it, or when a screen or widget on this device is open and does the work itself.

The host re-arms a `setTimeout` that would exceed the platform maximum. A time that is already past fires on the next turn.

## Host lifecycle

Electron and headless call `startScheduler(userContext)` after package loading and system-data
initialization. This restores persisted schedules without requiring a screen, widget, or another
scheduler call. Future calls are armed for their due time; overdue calls run on the next timer turn.
Repeated starts and concurrent first contract calls share one restoration.
Hosts await restoration during initialization; a rejection from `startScheduler` propagates
to startup rather than allowing the host to proceed without restored schedules.

Hosts await `disposeScheduler(userContext)` before stopping isolated runtimes and closing storage.
Disposal stops timers and rejects new work, then drains saves and invocations already in progress.
If shutdown begins while a due call's removal is being saved, a successful save is still followed
by its tool invocation; shutdown waits for that invocation to settle. Calls whose removal has not
started remain persisted for the next startup. Repeated disposal calls wait for the same drain,
and a pending load cannot arm timers afterward. Forced termination can still interrupt this drain.

Schedules are one-shot attempts: the host removes a due schedule before invoking it. A missing
package, denied access, or failed tool is logged and does not block other schedules. Failed calls
are not retried automatically, and a crash between removing a schedule and executing its tool can
lose that invocation. Packages needing retries should design idempotent operations and explicit
reconciliation.

If saving the removal fails, the host logs the error, retains the pending record, and retries
the save after 1 second, doubling the delay up to 30 seconds. The tool runs only after removal
is saved successfully. Other schedule writes preserve the pending record; it remains visible
in `list`, can be cancelled, and is restored after restart. Disposal stops retry timers.
This retries storage failures only, not failed tool invocations, and does not close the crash
window between a successful removal and invoking the tool.

Schedule creation, cancellation, and due-call removal share a serialized save queue and update
in-memory records only after persistence succeeds. A failed create or cancel rejects its caller
without changing the in-memory schedule list. The scheduler writes the existing device-scoped
`system:scheduler` row through the persistent-variable table API so a rejected observable write
promise cannot prevent later save attempts.
