---
sidebar_position: 7
title: Tools and access
---

# Tools and access

Tools are the actions Assistants and users can run: send a message, write a
task, search workflows, query a device database, and so on. Each live tool implementation
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
for example, retain both legacy IDs for the retired Voice Skill v1 `invoke`; there is no
primary winner. The tuple index is non-unique. Deterministic catalog IDs are an explicit
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

Unresolved legacy rows retain their historical primary keys and source. They are
ordinary, deletable rows; deleting one is permanent and never restores it. They
report unavailable and cannot block provider activation.
A row quarantined only because its target was missing resolves once it receives a valid
target whose `toolName` exactly matches the stored `name` and whose sole protocol-selected
ID equals the row ID and starts with `000tool0`. The row's `code` must be the empty string
and its `catalogIdentity` unset or `deterministic`. In Peers 0.27.2 and newer, that target
may arrive from provider publication or sync; it may already be present on a still-quarantined
row. The catalog marks the row resolved, patching only identity and state and preserving
policy and historical fields. Older devices may keep the row quarantined until upgraded.
Reviewed legacy aliases still suppress deterministic allocation and cannot be resolved
this way, nor can rows with executable source, another name or identity kind, a partial
or different target, or another quarantine reason. An ordinary metadata save that supplies
no target never clears a quarantine. Startup or provider publication may also restore a
bare row with all three target columns unset, whatever its quarantine reason, under the
same conditions on the row and the published target.
Any other quarantine stays sticky and blocks publication of that target; a real
quarantine in the system catalog still aborts readiness before providers activate.
Calls recheck retained identity evidence and current provider membership before
execution.
Ordinary SQLite row updates are checked as replacements: omitting canonical
fields or quarantine state cannot silently erase them, and omitting an access field
still clears it. The catalog writes explicitly marked patches instead, which change
only their own columns and sync only the changed paths. Patches cannot name
`accessLevel`, `remoteAccessLevel`, `authorityPropagation`, `code`,
`codeRepository` or `packageId`.

Descriptive metadata is refreshed whenever a provider is published or the system
catalog starts, so tool search, embeddings, CLI `tools get` and the UI follow package
and system upgrades and changed development members.

| Row | `name`, `usageDescription`, IO schemas | Runner flag, config schema, detailed description |
|---|---|---|
| Deterministic ID or alias without package provenance | Public definition | Supplemental metadata, if declared |
| Alias whose provenance matches the publishing provider | Public definition | Supplemental metadata, if declared |
| Alias with another provider's provenance | Retained | Supplemental metadata, if declared |

Refresh runs only after preparation succeeds. Unchanged metadata writes nothing;
identity, source, provenance and live access policy remain unchanged.

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
provider-specific policy.

Workflow and assistant references resolve through the catalog on every invocation.
They can run package contract tools (host or isolated), and
system tools only from **Host Tools** or **Desktop Tools**. Tool Access Control,
Identity, Invites, Device Operations, App Updates, Packages, both catalogs, HTTP, Scheduler,
Local Folders and Network remain excluded. This prevents a workflow from approving itself or
entering administrative contracts. Discovery uses live access levels and never
starts an isolated worker. Equal aliases are deduplicated by target.

Argument gathering uses the current contract member's fields. Tool calls keep their
logs, timing, errors and runner services in the workflow's own context, even when
another group is active.

Device Operations keeps `getTool` and `listTools` metadata behavior. Its `runTool`
uses runnable catalog lookup. Ordinary contract calls execute under the remote
caller's own user ID and group role, including Self-trusted other accounts.
`requiresWorkflowRun` members and any `assistantId` require the
caller to be the host account. Package callers cannot enter the Device Operations
workflow adapter. Local-only targets are always rejected remotely.
CLI `--assistant` uses catalog lookup and the workflow path; `--device` sends the
original lookup query to Device Operations.

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

## Contract-owned shipped tools

Ordinary Common, Tasks, Groceries, host and desktop executables now belong to
context-bound contract resolvers. `Tools` supplies permanent discovery metadata;
it does not own their code. Their existing IDs remain equal reviewed aliases:

| Catalog ID | Contract v1 → member |
|---|---|
| `000peers0tool0000000newid` | Common Tools → `new-id` |
| `000peers0tool00wrkflwsrch` | Common Tools → `search-workflows` |
| `00mh0wlipkdbeaw8newtsk001` | Tasks → `new-task` |
| `00mh0wlipkdbeaw8wrttsk001` | Tasks → `write-task` |
| `00mh0wlipkdbeaw8wrtcmt001` | Tasks → `write-task-comment` |
| `00mh0wlipkdbeaw8shopitm01` | Groceries → `add-to-shopping-list` |
| `000peers0tool0creategroup` | System Host Tools → `create-group` |
| `000peers0tool00querydb001` | System Host Tools → `query-database` |
| `000peers0tool00000homedir` | System Desktop Tools → `get-user-home-directory` |
| `000peers0tool0000peersdir` | System Desktop Tools → `get-peers-data-directory` |
| `000peers0tool00000showdir` | System Desktop Tools → `open-directory-in-os` |
| `000peers0tool000000pkgdir` | System Desktop Tools → `get-peers-packages-directory` |
| `000peers0tool00describdir` | System Desktop Tools → `describe-directory-contents` |
| `000peers0tool00appversion` | System Desktop Tools → `app-version` |
| `000peers0tool000publishpk` | System Desktop Tools → `publish-package` |

System Host Tools (`00mvbrni9wjucq4q1jbfe9ep3`) and System Desktop Tools
(`00mvbrni9w4z58hwoxfe406ru`) are local-only, including for Self-trusted remote
devices. Headless hosts expose desktop catalog rows but have no desktop resolver,
so those rows stay unavailable. `query-database` remains Writer-level and distinct
from Device Operations `queryDatabase`. `create-group` creates for the provider's
owning user and still seeds bundled peers-core. Tasks and Groceries reject a
`groupId` outside the authorized context; `write-task` no longer searches other
groups. Writes require a trusted forwarded actor.

Common's `throw-error`, `set-variable`, `send-message`, `run-a-workflow` and
`cli_assistant_runner` now execute through its contract provider. The temporary
alias bridge has been removed. The append-only inventory also maps:

| Catalog ID | Contract v1 → member |
|---|---|
| `000peers0tool00000runner1` | System Host Tools → `default_assistant_runner` |
| `000peers0tool00toolsearch` | System Host Tools → `tool-search` |
| `000peers0tool0000000dircd` | System Desktop Tools → `cd` |
| `000peers0tool000000notify` | System Desktop Tools → `send-notification` |

All reviewed shipped IDs have contract targets; the unresolved inventory is empty.
Runner metadata and configuration remain persisted without executable registration,
including the Common CLI runner on a fresh package installation.

`requiresWorkflowRun` is host-only invocation policy, separate from contract shape
identity. It applies to Common's throw/set/run/CLI runner, the default assistant
runner, tool-search, cd and send-notification. Catalog invocation without a workflow
rejects these members; CLI routes them through `runToolDirectly`. Host providers
receive `toolContext.workflow` only for the directly invoked tool, in the same data
context. Nested tool/action contexts, remote callers and isolated workers never
receive this capability. `send-message` may run without a workflow when an explicit
channel/thread/run ID is supplied. It resolves that target and any thread root only
inside the authorized data context, and records the checked caller as the message
author. The active UI group and host account do not replace the caller's context or
identity, including calls from packages and other devices.

Approval requests freeze arguments and the required live level. Approval and the
host-approved execution both recheck availability, user role and current level.
A provider switch that raises the level above the approved value fails the request;
thread/context grants recorded below the current level are ignored. Each subsequent
workflow call resolves the current compatible provider. A call already executing
is allowed to finish; an endpoint retired before execution is resolved once again.

Older runtimes do not know the newly appended host/desktop aliases. They park
resolved rows for those aliases in sync recovery rather than accepting an unknown
mapping. Keep the append-only inventory intact across upgrades; mixed-version
peers may alternate descriptive metadata until upgraded.

## System Tool Catalog

`getToolCatalogContractDefinition()` exposes one local API over `Tools` plus the
current context's registry and provider policy:

| Tool | Input | Result |
|---|---|---|
| `listTools` | `{query?, limit?}` | `{tools: IToolCatalogEntry[]}` (default 100, maximum 500) |
| `getTool` | `{toolIdOrName, runnableOnly?}` | `{tool?: IToolCatalogEntry}` |
| `invokeTool` | `{toolId, args?, providerPackageId?, fallbackToDefaultProvider?}` | `{result}` |

Entries include `toolId`, all equal `aliases`, descriptive schemas, catalog state
and identity, the requested `target`, live provider information, `workflowInvocable`,
and `availability` including `requiresWorkflowRun`.
`getTool` also projects `access` for contract entries: required level, caller level,
and `allowed`. Availability does not grant permission. The selected target endpoint
checks the original caller's live role and inherited authority on every invocation.
Discovery reads installed policy and may call host resolvers in-process for access;
it never resolves endpoints or starts isolated workers.

Dispatch classes are:

- `contract`: the active provider has an isolated installation or live host resolver.
- `unavailable`: for example `no-provider`, `no-implementation`, `member-removed`,
  `legacy-package-upgrade-required`, `legacy-execution-removed`, `quarantined`,
  or `invalid-identity`. The entry includes an actionable `availability.message`.

An exact ID identifies that row, including when unavailable for metadata queries. Name and text
lookup fail on multiple distinct targets; equal aliases form one target. With
`runnableOnly`, unavailable entries are excluded for IDs as well as name/text selection.

The contract is local-only and rejects package callers for all three tools.
Invocation also rejects device callers, missing identity, a mismatched data
context, unresolved/quarantined identities, and targets on the catalog itself.
Only the four documented invocation keys are accepted: payload `authority`,
assistant IDs and workflow variables are rejected. The wrapper admits at None and
preserves authority; it supplies neither a system-package caller nor its own frame
to the selected target. No delegated sessions or new approvals are introduced.

Invocation accepts a plain argument object (omitted means `{}`), checks required
fields against the requested version's public schema, and converts top-level Date
strings to valid Dates. Unknown fields and nested object contents are forwarded
unchanged; schema defaults are not inserted. Validation failures do not execute code.
`alsoImplements` may select newer implementation code while validation still uses
the requested version's definition.

By default the active provider is selected. `providerPackageId` makes selection
strict; an absent preference fails unless `fallbackToDefaultProvider: true` permits
the active provider. A selected provider without an implementation fails, and
contract errors propagate to the caller. Every call disposes its endpoint;
only retirement of that exact endpoint before execution permits one fresh selection
and retry. Uninstall retains catalog rows, which then report `no-provider`.

### Legacy execution removed

The executable Tools registry and source execution are removed. Dispatch is either
`contract` or `unavailable`. An unresolved row with `packageId` reports
`legacy-package-upgrade-required`: “Package PACKAGE_ID must be upgraded to implement this
tool through a contract resolver.” Without package provenance it reports
`legacy-execution-removed`: “Legacy tool execution has been removed; implement this
tool through a contract resolver.” Both messages link to the
[migration example](../Packages/contracts.md#migrating-from-toolinstances).
A provider declaring a member without a resolver reports `no-implementation`,
names the provider and member, and asks for a version that implements it.
Missing providers, removed members and quarantined identities remain actionable
unavailable records; catalog history is retained. Unreviewed custom IDs stay
unresolved after migration: update saved workflow and Assistant references to the
resolver’s catalog ID. The old custom row remains deletable.

A legacy-format host bundle with a non-empty `toolInstances` array is rejected
before tables, staged resolvers or package instances activate. Tool-free legacy
bundles still load. Older `definePackage()` bundles retain tables and UI; assigning
`ContractBuilder.toolInstances` warns once per builder and discards executables.
Their declared members report `no-implementation` until a resolver is registered.

`code` and `codeRepository` remain historical columns at Tools schema version 2.
Their saved bytes are preserved and never refreshed or executed by this runtime.
`packageId` is historical provenance, not ownership, availability or permission.
Supplemental `isAssistantRunner`, `configSchema` and `detailedDescription` metadata
is keyed by a declared contract target and written only after successful preparation.
System metadata updates accept only existing resolved system members.

Older runtimes may still execute and describe their own legacy tools, and their
synced descriptions may alternate with those from newer runtimes. Sync does not
activate those tools in this runtime. Upgrade every device and the package version
to use contract implementations consistently.

### Mixed-version sync

Runtimes that predate the catalog do not know its columns. When one of them writes a
full row that omits every catalog column, the receiving runtime keeps the
established identity and state and applies the rest of the row. A row that
removes only some catalog columns is still rejected, as is an older runtime's delete
of a catalog identity; both are parked. Deletes of unresolved legacy rows apply
normally. Older runtimes reject the
26-character Scheduler `list` alias in their own peer-ID validation. They park it
as a schema failure and materialize it from local history once they upgrade.
Tool mention queries show workflow-invocable catalog entries. Browser-only hosts
without the catalog API fall back to non-quarantined rows. Historical mention IDs
remain readable even when their provider is unavailable.

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
| 20 | `tool-search`, `search-workflows`, `app-version`, `list-timers`, device status / list / get, network diagnostics, App Updates status, Packages list / get / capabilities / device activation |
| 40 | `send-message`, tasks, groceries, timer writes, notifications, `dispatch-voice-action`, `query-database`, Packages reload |
| 60 | Network control (connect, disconnect, refresh, sync), Packages import / create / clone / install / uninstall / promote |
| 80 | `run-a-workflow`, filesystem path tools, `cd`, `queryDatabase`, device `runTool`, `deleteDevice`, `resetChangeTracking`, voice device-local operations, App Updates `checkForUpdates` |
| 100 | Unclassified package tools, App Updates update-and-restart |

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

The `cap` ceiling from an ordinary tool's own level applies inside the strict dispatch scope: whenever a `preserve` tool is on the chain, the caller already runs under a strict frame, a host tool uses `context.dispatchTool`, or a call is admitted through an `exposes` relationship. A direct package-to-package `callConsumedTool` from an ordinary tool outside that scope keeps the pre-existing user/assistant/tool policy. Declared tool levels, consume ceilings, and group roles always apply.

Host providers select public tools through `context.dispatchTool({contractId, version, toolName, providerPackageId}, args)`; isolated providers use `callConsumedTool`. They share the runtime authorizer. Consumed-contract declarations and ceilings still apply; a tool marked `private` is callable only by its own package. Target admission levels are read live, separately for each provider. Arguments cannot provide a numeric role, user identity, or propagation mode.

Catalog filtering is advisory and execution rechecks the current role, ceiling, target metadata, and declared propagation mode. Strict calls deny approval-required outcomes and unsupported remote or cross-context forwarding. General table/observable writes remain outside this bounded dispatch scope.

## Tool screens

Tool details and field tables are read-only: identity, aliases, contract member,
provider, dispatch reason and live access come from the catalog. The code editor,
Save action, create-on-Enter flow and obsolete Settings Tasks importer are removed.
The runner dropdown hides unavailable runners when host catalog data is available.
