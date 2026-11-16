---
sidebar_position: 12
---

# System Scheduler

Use System Scheduler (`system.scheduler`) to run one of your isolated package's tools later on this device. Call `schedule` with the time and the tool to wake.

It is available on desktop, headless and the PWA. On the PWA, scheduled work runs only while
the app is open and the browser allows it to run. Overdue schedules catch up when the page
resumes or the app is reopened. Keep the owning Peers tab open for timely alarms.

## Calls

`schedule` takes `at` (epoch milliseconds), `contractId`, `version`, `toolName`, and an optional JSON `payload`. The host returns `scheduleId`. `cancel` removes one schedule owned by the calling package. `list` returns schedules in the call's data context. An isolated caller sees only its own.

A package can schedule only a tool on a contract it provides. The tool runs using the signed-in user's current access level, subject to the delegated limits described below. Normal tool authorization still applies. The payload is capped at 32,000 characters. `at` must fall within 366 days.

### Who a wake-up runs as

When a person's call leads to the schedule, the wake-up runs as that person. That covers someone using the package's screen, the CLI, or another of their own devices, with the package scheduling as part of that work. It has to be the user signed in on this device. The scheduled tool can then call another package's exposed tools (as through their Voice Skill), within the original call's delegated limits. Access is checked again when it wakes: a lowered role applies, but a raised one doesn't add access the original call didn't have. Schedule each follow-up from the tool handling that step to carry the user forward.

Work a package schedules on its own wakes without a user. That includes a schedule made from a wake-up that wasn't for a person, from an event or table subscription set up at startup, or from another group member's call. Such a wake-up can run the package's own tools and use its own data, but calls that need a signed-in user are refused. `list` doesn't say which kind a schedule is.

Official Timers' `fire-timer` and News' `refresh` require Writer (40), matching their
ordinary write/refresh operations. Writers may call these tools directly as well. Losing
Writer access can stop their scheduled callbacks; scheduling does not grant Self authority.

## Device local

Schedules stay on the device where they were created. They do not sync. A timer created on another device gets a local alarm on this device only when something on this device schedules it, or when a screen or widget on this device is open and does the work itself.

When every device books the same thing for itself, such as a reminder, each one fires it. If the scheduled tool notifies, send it with System Notifications' `once` and a key that names the occurrence, so the copies are one notification ([Notifications](./Notifications.md)).

A time that is already past runs as soon as possible.

## Delivery

Pending schedules survive closing and reopening Peers. You do not need to open a package's
screen or schedule another call to resume them. Future wake-ups wait until their due time;
overdue wake-ups run after Peers starts.

Schedules are one-shot attempts, not guaranteed delivery. A missing package, denied access,
or failed tool does not block other schedules. A crash at delivery time can lose a wake-up.
If your package schedules another attempt, make the tool safe to run more than once.
