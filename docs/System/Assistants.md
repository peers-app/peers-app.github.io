---
sidebar_position: 6
title: Assistants
---

# Assistants

Assistant runners and included tools execute through contract providers. Historical
unresolved tool references remain visible but unavailable; their catalog message
explains whether to upgrade the package or migrate to a resolver. Runner flags and
configuration schemas are supplemental metadata, preserved independently of executable
code. See [Legacy execution removed](./Tools.md#legacy-execution-removed).

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
2. in your personal context, the Assistant's **automatic delegated authority** when it runs tools.

In a shared group, an Assistant's settings can be edited by other members. Its automatic
tool authority is therefore **None (0)**. Tools above None require your approval for each
exact call. Setting a shared Assistant to Admin or Self does not authorize those calls.
CLI coding Assistants run only in your personal context. Open a personal thread to use
Cursor Agent, Claude Code, or OpenCode; shared settings cannot select a command to run on
your computer.

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
- **A** — the Assistant's `accessLevel` in your personal context, or 0 in a shared group
- **T** — the tool's `accessLevel`

Rules:

- `U < A` — the user cannot start that Assistant
- `T > U` — the tool is hidden from the model and denied at execution
- `T <= A` — the tool runs automatically
- `A < T <= U` — the Assistant may request the tool; the user must approve a
  scoped grant before it runs

Direct user calls (CLI `peers tools run`, Device Operations `runTool`, or an
explicit UI tool call) use the user ceiling only: allow when `T <= U`. An explicit
CLI `--assistant` uses the Assistant’s ceiling and the existing approval path.

Nested workflows inherit the parent run's Assistant id and do **not** escalate
authority. The user's role is re-read at approve and execute time. Access
identity vars are host-owned: `set-variable` cannot write them, and a
raised `accessAssistantId` is capped at the run's default Assistant.

Tool discovery and execution use the permanent catalog. Package tools may run on
the host or in isolation; system tools are limited to Host Tools and Desktop Tools.
Administrative systems, including Tool Access Control, are never offered to a
workflow. The live tool level must fit the user’s role; explicit skipped mentions
are logged. Equal aliases become one tool. Inference names are unique, contain
only letters, digits, `_` or `-`, and fit the 64-character API limit.

## Step-up approval

When a model requests a tool in the `A < T <= U` band, the host creates a
local-only approval row and returns `approval_required` to the model. The
workflow is **not** paused. An inline card on the thread offers:

- **Allow once** — execute this exact frozen call; it is not reused later in
  the thread
- **Allow in thread (15 min)** — same tool at the thread root, including
  later replies, for 15 minutes from approval
- **Allow in this context (15 min)** — same tool in this data context for
  15 minutes from approval
- **Deny**

Shared groups offer **Allow once** and **Deny**. Thread and context approvals are available
only in your personal context; earlier reusable approvals in groups no longer authorize calls.

Approval consumes a one-time nonce, rechecks the user's role and the stored
tool metadata, and executes only the frozen arguments in a new host-owned run.
Denial and expiry cannot be replayed. Approve / reject are host-only contract
tools; Assistants never see them.

Access levels do **not** sandbox package top-level code. Review of package
manifests is a separate, later project.

Provider changes are checked again when approving and executing frozen calls.
If a new provider requires a higher level than the recorded approval, execution
fails and the thread receives a failure notice. Reusable grants never cover a
higher live level. Provider switching does not reset or increase the Assistant’s
ceiling.

## Configuration

Assistant configuration shows named access presets plus a custom 0–100 editor.
Tool screens show read-only live policy and provider metadata. Unavailable runners
are hidden from runner selection when the host catalog is available. An assistant's
currently selected unavailable runner stays visible with an unavailable label and a
disabled option, so its configuration remains understandable until a replacement
is selected.
The Assistant list still shows Assistants the current user cannot invoke, with
a badge explaining the required level.

Shipped defaults:

- Shell, Shell v2, Voice Hub Agent — **40**
- Admin — **60**
- Cursor Agent, Claude Code, OpenCode — **100**
- Hosted / voice / CLI runners and workflow plumbing — **0**
