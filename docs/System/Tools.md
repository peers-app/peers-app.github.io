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

Access levels are **authorization**, separate from isolation. Legacy package
bundles evaluate on the host; isolated provider code starts in its worker on
first invocation.

## Permanent runtime catalog

The Runtime owns `Tools` as the permanent index of every public contract tool.
It derives rows from validated system, host and isolated contract definitions,
without starting workers, calling resolvers or creating executable tool instances.
Each personal and group context gets system catalog rows, regardless of role.
Local and remote contract routing waits for catalog readiness before selecting a
provider or checking a group's remote tool policy. A first call on a cold context
waits for persistence; initialization failure rejects that call and can be retried.
This includes a failed SQLite schema initialization on the same data source.
Readiness rechecks the complete system catalog before publishing any system
provider, watching for identity changes throughout that final snapshot.

A canonical target is the exact case-sensitive tuple `(contractId, version,
toolName)`. Provider, package version, group, device, installation order and
presentation text do not affect its identity. Without an explicit legacy mapping,
its ID is `000tool0` plus 17 lowercase base36 characters. The frozen SDK protocol
hashes UTF-8 compact `JSON.stringify(["peers.tools-catalog.v1", contractId, version,
toolName])` with SHA-512, interprets the digest as an unsigned big-endian integer,
and takes its residue modulo `36^17`, padded to 17 characters. Names are not
trimmed or normalized; malformed Unicode and non-positive/unsafe versions fail.
Global peer-ID validation is unchanged. Catalog validation alone accepts the
shipped 26-character Tool Access Control contract ID (`000peers0toolaccessctl0001`)
and Scheduler `list` tool ID (`00muxgugn661g0qmpuwafrmsi4`).

This is the approved permanent protocol from the Tools Catalog Foreman specification
(2026-10-13). The SDK uses its existing `tweetnacl.hash` SHA-512 implementation.
The `000tool0` prefix places the timestamp-sensitive `isid()` prefix in 1970–1972;
the result is exactly 25 alphanumeric characters and also passes `zodPeerId`.

Fixed compatibility vectors below use contract ID `00mp287gdl5atltgs5bh0vm9z`.
Names are shown as JSON strings to make whitespace and Unicode composition explicit.
The tests also check exact UTF-8 bytes; these outputs have been cross-checked with
Node's independent SHA-512 implementation.

| Version | Tool name (JSON) | Derived ID |
|---|---|---|
| 1 | `"read"` | `000tool0m6n9qqflttd2vhqt0` |
| 2 | `"read"` | `000tool0hz4s7a3bzw0hx7h6e` |
| 1 | `"Read"` | `000tool0tkbtut20wcn4p2n9c` |
| 1 | `"é🛠"` | `000tool0w8lfnvvspj7cl3u9x` |
| 1 | `"\u00e9"` | `000tool0hcab9lwucf1sls3uk` |
| 1 | `"e\u0301"` | `000tool0m71grpdum3oh5ak0e` |
| 1 | `" read "` | `000tool03ja6984o18ycrskkz` |
| 9007199254740991 | `"read"` | `000tool0yk5ipn4g8azf6c6yt` |

With the uppercase contract ID `00MP287GDL5ATLTGS5BH0VM9Z`, version 1 and
`"read"` instead produce `000tool0xd9tnb6xvxcvtrojg`.

Reviewed legacy mappings take precedence: **every** explicit ID is preserved as
an equal alias and no additional deterministic row is created. Tasks and Groceries,
for example, retain both legacy IDs for Voice Skill v1 `invoke`; there is no primary
winner. The tuple index is non-unique. Deterministic catalog IDs are an explicit
exception to `newid()`; allocate genuinely new contract IDs with `newid()` once
and commit the constants.

Rows retain the legacy fields and primary keys, with optional `contractId`,
`contractVersion`, `toolName`, `catalogIdentity` (`deterministic` or `legacy-alias`)
and `catalogState` (`resolved`, `unresolved` or `quarantined`). Unmapped legacy
tools remain unresolved. Unknown target mappings are quarantined. An ID assigned
to conflicting targets fails closed; it is never salted, retargeted or overwritten.
Local and synced writes validate identity before changing the materialized row;
rejected sync evidence is parked in the sync recovery queue, like a schema failure,
instead of being requested again from peers on every sweep. A later change for the
record is still applied normally.
Catalog identities are permanent: rows with a canonical target or quarantine
evidence cannot be deleted, and deletes of reviewed aliases and deterministic catalog
IDs are rejected even before their rows exist. During startup or installation, the
coordinator restores historical tombstones only for validated public targets or
reviewed legacy aliases. It writes a new sync snapshot, preserving the identity and
superseding the old delete. Failed initialization can be retried without publishing
system providers before their catalog rows have persisted.

Unresolved legacy rows are a holdover until those tools move to contracts. They
keep their primary keys through the upgrade but are otherwise ordinary rows:
local writers and older runtimes may delete them, and a deleted one is not restored.
Their metadata is best-effort. A deleted or quarantined unresolved row is skipped
with a warning and never prevents a package or the system from loading; legacy
execution refuses a quarantined row on its own.
Quarantine cannot be cleared by an ordinary metadata save or sync replay. A bare
`000tool0…` ID without its canonical target is quarantined rather than claimed by
the next installed provider. Cached legacy tool references recheck retained
identity evidence and current provider membership before execution.
Ordinary SQLite row updates are checked as replacements: omitting canonical
fields or quarantine state cannot silently erase them, and omitting an access field
still clears it. The catalog writes explicitly marked patches instead, which change
only their own columns and sync only the changed paths. Patches cannot name
`accessLevel`, `remoteAccessLevel` or `authorityPropagation`.

Descriptive metadata is refreshed whenever a provider is published or the system
catalog starts, so tool search, embeddings, CLI `tools get` and the UI follow package
and system upgrades and changed development members. Each field has one owner, so
two writers never alternate:

| Row | `name`, `usageDescription`, IO schemas | Runner flag, config schema, detailed description, code, repository |
|---|---|---|
| Deterministic ID | Public definition | Not written |
| Alias claimed by a package's legacy executable (`packageId`) | That executable | That executable |
| Other reviewed alias | Public definition | Legacy executable, if any |
| Unresolved legacy row | Legacy executable | Legacy executable |

Refresh runs only after a provider's preparation succeeds, so a failed replacement
leaves its rows unchanged. A publication with unchanged metadata writes nothing.

Install/replacement persists catalog rows before publishing a provider. Host and
isolated replacements keep candidate table declarations staged until the final
catalog writes succeed. Isolated schema registration publishes live bindings in
the same synchronous turn as guarded provider activation. The catalog guard stays
live during awaited table persistence, so a synced quarantine blocks installation
or replacement at that final boundary. Cancellation, catalog conflict or storage
failure restores the previous durable definitions before table calls resume.
Host contract and legacy bundles stage the entire table-definition batch; an invalid
later table cannot change an earlier live binding.
Reinstalling the old artifact therefore cannot encounter an abandoned schema upgrade.
Failed replacements keep the previous provider usable. Disable,
uninstall, removal of a development member and context disposal retain catalog
history. Synced metadata
does not activate a provider. A row proves neither current availability nor
permission to execute: the contract registry supplies availability and the selected
live provider supplies authorization. Catalog reconciliation does not overwrite
provider-specific policy. Legacy search/execution includes only real executable
instances; isolated catalog entries still require contract consumers until the
CLI/workflow/assistant dispatch migration is implemented.
For catalog aliases, a legacy executable must belong to the selected provider in
that exact data context. If no contract provider is selected, a verified alias can
still run from a uniquely owned, active legacy bundle; those bundles do not publish
contract registrations. Multiple legacy owners are ambiguous and fail closed.
Global registrations or instances retained from another context cannot satisfy
these checks. Workflow argument gathering and validation use the live owned
instance's input schema, since the retained catalog schema may describe an older
implementation.
Device Operations `getTool` and `listTools` include catalog metadata. `runTool`
filters candidates for live executability before exact-name or text selection, so
a catalog-only row cannot shadow a same-named host executable or create a false
ambiguity. An exact catalog-only ID remains unavailable to legacy execution.
CLI local `tools run` name/text lookup excludes deterministic metadata and
quarantined rows before selecting an ID; live ownership and access are still
checked by the host. With `--device`, the CLI sends the original ID/name/text
query to Device Operations for executable lookup. `tools get` remains a metadata
inspection command.

Host bundle resolver registrations are staged during evaluation and published in
the owning context only after successful activation. Failed or invalidated
replacements leave the previous implementation intact. Unloading removes owned
executable registrations and resolvers and invalidates pending host and isolated
loads, including dependency resolution, dev-version correction and catalog writes.
Host `remote()` and `consumes()` handles settle after guarded activation, allowing
a fresh installation to reference contracts provided by that same package.
Successful host replacement invalidates cached `consumes()` endpoints so subsequent
calls resolve the new implementation. Retained host endpoints check the active
provider generation, resolver and catalog identity again after authorization awaits,
immediately before entering the tool function; replacement, unload and
disposal prevent them from invoking retired code. Failed replacement preserves the
previous endpoint generation. Routers owned by external transports refresh a retired
endpoint once when it rejects before invoking provider code. Errors from inside a
provider, including a downstream endpoint's retirement, do not replay that provider.

### Mixed-version sync

Runtimes that predate the catalog do not know its columns. When one of them writes a
full row that omits every catalog column, the receiving runtime keeps the
established identity and state and applies the rest of the row. A row that
removes only some catalog columns is still rejected, as is an older runtime's delete
of a catalog identity; both are parked. Deletes of unresolved legacy rows apply
normally. Older runtimes reject the
26-character Scheduler `list` alias in their own peer-ID validation. They park it
as a schema failure and materialize it from local history once they upgrade.
Tool mention markup (`<$tool:name:id>`) links only 25-character IDs of live legacy
executables, so it never links that catalog-only Scheduler alias.

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

Catalog records can display historical access metadata. Execution reads the
selected live provider's current declaration and the caller's role; editing a
catalog row does not grant access or override that provider's policy. Historical
workflow logs are retained.

## Authority propagation and dynamic dispatch

`accessLevel` sets the role required to enter a tool. `authorityPropagation` controls the authority it may pass to a dynamically selected target. The default is `"cap"`: in strict dispatch the outgoing ceiling is the minimum of the current signed caller role, inherited ceiling, consume ceiling, and ordinary calling tool level. A `"preserve"` tool omits only its own level from that minimum. It cannot raise an inherited ceiling.

Both values are declared in the tool's metadata (`toolSchema({ authorityPropagation: "preserve" })` for host tools, `tools[].authorityPropagation` in an isolated manifest) and the runtime honors the declaration the same way it honors the declared level: **installing the package is the trust decision.** There is no separate operator grant, permission table, or installation generation to approve; the mode is reread from the live tool metadata on every call, so a package update that changes the declaration takes effect as soon as the new version loads. Review a package's tool levels and propagation modes before installing it into a group. A follow-up security audit of this install-time trust model is tracked in the project task list.

A Reader preserving router admits Readers and above; a direct Admin can dispatch Admin targets, but an Admin arriving through an ordinary Reader tool remains capped at Reader. A preserving router's Writer admission still rejects Readers. Omitted admission resolves to None (0) for a `preserve` tool; ordinary unclassified tools retain Self (100). None preserving entry still requires trusted identity and execution context and permits a level-0 caller to select only level-0 targets.

The `cap` ceiling from an ordinary tool's own level applies inside the strict dispatch scope: whenever a `preserve` tool is on the chain, or the caller already runs under a strict frame (checked `dispatchAction`, an inherited strict principal). A direct package-to-package `callConsumedTool` from an ordinary tool outside that scope keeps the pre-existing user/assistant/tool policy. Declared tool levels, consume ceilings, and group roles always apply.

Host providers select public tools through `context.dispatchTool({contractId, version, toolName, providerPackageId}, args)`. Checked package aliases use `context.dispatchAction`; isolated providers use `callConsumedTool`. They share the runtime authorizer. Consumed-contract declarations and ceilings still apply; private canonical actions stay pinned to their owner. Target admission levels are read live, separately for each provider. Arguments cannot provide a numeric role, user identity, or propagation mode.

Catalog filtering is advisory and execution rechecks the current role, ceiling, target metadata, and declared propagation mode. Strict calls deny approval-required outcomes and unsupported remote or cross-context forwarding. General table/observable writes remain outside this bounded dispatch scope.
