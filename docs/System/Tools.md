---
sidebar_position: 7
title: Tools and access
---

# Tools and access

Tools are the actions Assistants and users can run: send a message, write a
task, search workflows, query a device database, and so on. Each tool record
has an integer `accessLevel` from **0–100**. Missing or unclassified tools
default to **100 (Self)** so a new package tool cannot run until someone
explicitly lowers it.

Access levels are **authorization**, not sandboxing. Package top-level code
still loads on the host. Manifest review and package sandboxing are a later
project.

## Policy

Compare the current user's context role (**U**), the Assistant's level
(**A**), and the tool's level (**T**):

| Condition | Result |
|---|---|
| `T > U` | Hidden from the model and denied at execution |
| `T <= A` | Runs automatically |
| `A < T <= U` | Assistant may request it; user must approve |
| Direct user call, `T <= U` | Runs (CLI, UI, Device Operations `runTool`) |

The model only receives tools the current user could approve (`T <= U`).
Tool metadata in the Tools table remains broadly visible in the UI.

Contract tools use the same levels. Level **0** tools do not need a caller
identity. Higher levels resolve **U** in the provider's data context — not
the process-wide user-context singleton — so a remote device call cannot
hang waiting for a context that belongs to another device in the same
process. Missing identity or a missing user context fails closed.

## Remote access level

`accessLevel` decides who may run a tool on the device where it lives. A
second, optional field, `remoteAccessLevel`, decides whether callers on
**other devices** may run it at all. It uses the same 0–100 scale and is
compared against the caller's role in the shared group the call names.

| `remoteAccessLevel` | Callers on other devices |
|---|---|
| omitted (default) | Local-only. Denied unless the caller is Self-trusted by the provider. |
| `n` | Verified group members with role level `>= n` (and `> 0`) may run it; Self-trusted callers always may. |

Both checks apply on the executing device: a remote group member must clear
`remoteAccessLevel` to be admitted and `accessLevel` to run. Tools whose
`accessLevel` is Self stay effectively local-only for other accounts even if
`remoteAccessLevel` is set. Remote callers never receive step-up approval
prompts; a denied call simply fails. Packages reach remote tools through
`pkg.remote(contractId, version)` and then `remote.device(deviceId).tools.<name>(...)` — see
[Package contracts](../Packages/contracts#remote-tool-calls-across-devices).

## Step-up approval

Approvals are local-only records. They store the tool id, a sanitized
argument preview, a hash of the frozen arguments, a nonce, an expiry, and a
scope. They do not store secrets or raw logs. Pending approvals expire after
15 minutes. Reusable thread and context grants receive a fresh 15-minute
window when approved.

Default approval is **one exact frozen call**. That grant is not stored on
the thread — a later request for the same tool needs a new approval, or a
reusable thread/context grant. A thread grant follows the thread root, so a
later reply in the same conversation does not need another prompt. Optional
scopes allow the same tool for the current thread or data context without
raising the Assistant globally during that 15-minute window.

Approve and reject are exposed only through the local host
**System Tool Access Control** contract. Remote device connections cannot
resolve that contract. Host tickets used to execute the frozen call
(`hostApprovedApprovalId`, `directUserInvocation`) stay on that run and are
not copied onto thread message vars. Models cannot raise authority by
writing those keys — or `accessAssistantId` / `assistantId` — through
`set-variable` or child workflow vars. A missing Assistant record fails
closed (level 0), not open to Self.

On approve, the host rechecks the user's role, consumes the nonce, and
executes only the stored arguments in a new host-owned run. Replay of a
used, denied, or expired nonce fails.

## Shipped classifications

Unlisted package tools stay at **100**. Mixed-operation tools use the highest
required level until destructive operations are split.

| Level | Examples |
|---|---|
| 0 | Hosted / voice / CLI runners, `throw-error`, `set-variable`, `new-id` |
| 20 | `tool-search`, `search-workflows`, `app-version`, `list-timers`, device status / list / get, network diagnostics |
| 40 | `send-message`, tasks, groceries, timer writes, notifications, `dispatch-voice-action`, `query-database` |
| 60 | Network control (connect, disconnect, refresh, sync) |
| 80 | `run-a-workflow`, filesystem path tools, `cd`, `queryDatabase`, device `runTool`, `deleteDevice`, `resetChangeTracking`, voice device-local operations |
| 100 | Unclassified package tools |

Runner tools are infrastructure level **0**, but they still validate that the
current user may invoke the **target Assistant**.

## Configuration

The tool info screen has the same named presets and custom 0–100 editor as
Assistants. Changing a tool's level takes effect on the next discovery and
execution check; it does not rewrite historical workflow logs.

## Authority propagation and dynamic dispatch

`accessLevel` sets the role required to enter a tool. `authorityPropagation` controls the authority it may pass to a dynamically selected target. The default is `"cap"`: in strict dispatch the outgoing ceiling is the minimum of the current signed caller role, inherited ceiling, consume ceiling, and ordinary calling tool level. A `"preserve"` tool omits only its own level from that minimum. It cannot raise an inherited ceiling.

Both values are declared in the tool's metadata (`toolSchema({ authorityPropagation: "preserve" })` for host tools, `tools[].authorityPropagation` in an isolated manifest) and the runtime honors the declaration the same way it honors the declared level: **installing the package is the trust decision.** There is no separate operator grant, permission table, or installation generation to approve; the mode is reread from the live tool metadata on every call, so a package update that changes the declaration takes effect as soon as the new version loads. Review a package's tool levels and propagation modes before installing it into a group. A follow-up security audit of this install-time trust model is tracked in the project task list.

A Reader preserving router admits Readers and above; a direct Admin can dispatch Admin targets, but an Admin arriving through an ordinary Reader tool remains capped at Reader. A preserving router's Writer admission still rejects Readers. Omitted admission resolves to None (0) for a `preserve` tool; ordinary unclassified tools retain Self (100). None preserving entry still requires trusted identity and execution context and permits a level-0 caller to select only level-0 targets.

The `cap` ceiling from an ordinary tool's own level applies inside the strict dispatch scope: whenever a `preserve` tool is on the chain, or the caller already runs under a strict frame (checked `dispatchAction`, an inherited strict principal). A direct package-to-package `callConsumedTool` from an ordinary tool outside that scope keeps the pre-existing user/assistant/tool policy. Declared tool levels, consume ceilings, and group roles always apply.

Host providers select public tools through `context.dispatchTool({contractId, version, toolName, providerPackageId}, args)`. Checked package aliases use `context.dispatchAction`; isolated providers use `callConsumedTool`. They share the runtime authorizer. Consumed-contract declarations and ceilings still apply; private canonical actions stay pinned to their owner. Target admission levels are read live, separately for each provider. Arguments cannot provide a numeric role, user identity, or propagation mode.

Catalog filtering is advisory and execution rechecks the current role, ceiling, target metadata, and declared propagation mode. Strict calls deny approval-required outcomes and unsupported remote or cross-context forwarding. General table/observable writes remain outside this bounded dispatch scope.
