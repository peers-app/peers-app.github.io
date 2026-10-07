---
sidebar_position: 12
---

# System Scheduler

System Scheduler (`system.scheduler`) wakes an isolated package's own tool at a time, on this device. The guest has no `setTimeout` that survives the worker. It calls `schedule`, and the host stores the wake-up and invokes the tool.

The desktop app and `peers-headless` provide it by importing `@peers-app/peers-device/scheduler`.

## Calls

`schedule` takes `at` (epoch milliseconds), `contractId`, `version`, `toolName`, and an optional JSON `payload`. The host returns `scheduleId`. `cancel` removes one schedule owned by the calling package. `list` returns schedules in the call's data context. An isolated caller sees only its own.

A package can schedule only a tool on a contract it provides. The host invokes that tool as Self, starting the worker if it is stopped. The payload is capped at 32,000 characters. `at` must fall within 366 days.

## Device local

Schedules live in the device persistent variable `system:scheduler`. They do not sync. A timer created on another device gets a local alarm on this device only when something on this device schedules it, or when a screen or widget on this device is open and does the work itself.

The host re-arms a `setTimeout` that would exceed the platform maximum. A time that is already past fires on the next turn.
