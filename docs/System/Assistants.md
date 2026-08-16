---
sidebar_position: 6
title: Assistants
---

# Assistants

Assistants are named workers that reply in normal Peers threads. A user
@mentions an Assistant, the host creates a workflow run, and the Assistant's
runner tool (hosted inference or a local CLI) decides what to say and which
tools to call.

Built-in Assistants include **Shell**, **Shell v2**, **Admin**, **Voice Hub
Agent**, and the local coding Assistants (**Cursor Agent**, **Claude Code**,
**OpenCode**). Packages can install more. Unclassified package Assistants
default to access level **100 (Self)** until someone sets a lower level.

## Access levels

Every Assistant has an integer `accessLevel` from **0–100**. That value is
both:

1. the **minimum user role** required to invoke the Assistant, and
2. the Assistant's **automatic delegated authority** when it runs tools.

Named presets match group roles:

| Level | Name | Typical use |
|---|---|---|
| 0 | None | Infrastructure / runners |
| 20 | Reader | Diagnostics and search |
| 40 | Writer | Ordinary domain writes (Shell, Voice Hub Agent) |
| 60 | Admin | Privileged diagnosis and repair (Admin) |
| 80 | Owner | Host filesystem and high-risk device operations |
| 100 | Self | Personal-context / founder authority; local coding CLIs |

Personal context always resolves to **100**. In a group, the current member
role is mapped onto the same scale (`Founder` → `Self` / 100). Custom integers
between named tiers are allowed (for example `45` displays as `Writer+`).

If the current user's level is below the Assistant's level, invocation is
**denied**. The host does not silently degrade the Assistant to a weaker tool
set.

## How tools are authorized

For a tool call, Peers compares three numbers:

- **U** — current user's access in this data context
- **A** — the Assistant's `accessLevel`
- **T** — the tool's `accessLevel`

Rules:

- `U < A` — the user cannot start that Assistant
- `T > U` — the tool is hidden from the model and denied at execution
- `T <= A` — the tool runs automatically
- `A < T <= U` — the Assistant may request the tool; the user must approve a
  scoped grant before it runs

Direct user calls (CLI `peers tools run`, Device Operations `runTool`, or an
explicit UI tool call) use the user ceiling only: allow when `T <= U`.

Nested workflows inherit the parent run's Assistant id and do **not** escalate
authority. The user's role is re-read at approve and execute time. Access
identity vars are host-owned: `set-variable` cannot write them, and a
raised `accessAssistantId` is capped at the run's default Assistant.

## Step-up approval

When a model requests a tool in the `A < T <= U` band, the host creates a
local-only approval row and returns `approval_required` to the model. The
workflow is **not** paused. An inline card on the thread offers:

- **Allow once** — execute this exact frozen call; it is not reused later in
  the thread
- **Allow in thread** — same tool for the rest of this thread (the thread
  root, including later replies)
- **Allow in this context** — same tool in this data context
- **Deny**

Approval consumes a one-time nonce, rechecks the user's role and the stored
tool metadata, and executes only the frozen arguments in a new host-owned run.
Denial and expiry cannot be replayed. Approve / reject are host-only contract
tools; Assistants never see them.

Access levels do **not** sandbox package top-level code. Review of package
manifests is a separate, later project.

## Configuration

Assistant and tool screens show named presets plus a custom 0–100 editor.
The Assistant list still shows Assistants the current user cannot invoke, with
a badge explaining the required level.

Shipped defaults:

- Shell, Shell v2, Voice Hub Agent — **40**
- Admin — **60**
- Cursor Agent, Claude Code, OpenCode — **100**
- Hosted / voice / CLI runners and workflow plumbing — **0**
