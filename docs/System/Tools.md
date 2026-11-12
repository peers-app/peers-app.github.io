---
sidebar_position: 7
title: Tools and access
---

# Tools and access

Tools are the actions users, packages and agents can run: write a task, create a
group, query a device database, and so on. Each live tool implementation
has an integer `accessLevel` from **0–100**. Missing or unclassified tools
default to **100 (Self)** so a new package tool cannot run until someone
explicitly lowers it.

Access levels are **authorization**, separate from isolation. Package authors use
`defineTool` and `definePackage` from `@peers-app/peers-sdk/define`, then build with
`peers-package`. Provider code starts in its worker on first contract use.

## Permanent runtime catalog

The Runtime owns `Tools` as the permanent index of every public contract tool.
It derives rows from validated system and package contract definitions,
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
Global peer-ID validation is unchanged. Catalog validation alone accepts two shipped
26-character IDs: the contract ID of the retired Tool Access Control
(`000peers0toolaccessctl0001`), whose aliases stay in the inventory, and the Scheduler
`list` tool ID (`00muxgugn661g0qmpuwafrmsi4`).

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
A quarantine's reason is part of its evidence: a write that changes or clears it while the
row stays quarantined is rejected. When a peer resolves a row, its `catalogReason` and
`catalogState` changes can arrive in separate pulls; the first one parks in sync recovery,
and the row resolves once the second arrives.
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

Installing or replacing a package validates its complete table and contract declarations
before making them active. A catalog conflict, invalid schema, or storage failure leaves
the previous provider and table definitions usable.

Disable, uninstall, removal of a development member and context disposal retain catalog
history. Synced metadata
does not activate a provider. A row proves neither current availability nor
permission to execute: the contract registry supplies availability and the selected
live provider supplies authorization. Catalog reconciliation does not overwrite
provider-specific policy.

Device Operations keeps `getTool` and `listTools` metadata behavior. Its `runTool`
uses runnable catalog lookup and runs the tool through the catalog under the remote
caller's own user ID and group role, including Self-trusted other accounts. Package
callers are refused, and local-only targets are always rejected remotely. CLI
`--device` sends the original lookup query to Device Operations.

Successful replacement makes subsequent calls use the new implementation. Failed replacement
keeps the previous one available. Uninstall makes its tools unavailable while retaining
catalog history. Calls that have already started are not replayed automatically.

## Contract-owned shipped tools

Tasks, Groceries, host and desktop tools belong to their contract providers.
`Tools` supplies permanent discovery metadata;
it does not own their code. Their existing IDs remain equal reviewed aliases:

| Catalog ID | Contract v1 → member |
|---|---|
| `000peers0tool0000000newid` | Common Tools → `new-id` (retired) |
| `000peers0tool00wrkflwsrch` | Common Tools → `search-workflows` (retired) |
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
owning user and still seeds bundled peers-core. `remove-group` and `restore-group` take one of
that user's groups off, or back onto, their list on all of their devices, and refuse calls
from packages. Tasks and Groceries reject a
`groupId` outside the authorized context; `write-task` no longer searches other
groups. A new task or comment records the call's caller as its creator, or the
signed-in user when the host doesn't name a caller.

Common Tools v1 (`new-id`, `throw-error`, `set-variable`, `send-message`,
`search-workflows`, `run-a-workflow` and `cli_assistant_runner`) is retired: Tasks
stopped providing it after 0.31.4, along with its Assistants. Its ids stay in the
inventory but no provider serves them, so they show as unavailable. Use
[`peers new-id`](./CLI.md#new-id) for new ids.

These system members were retired with assistants and workflows. Their IDs stay in the
append-only inventory and still resolve to their old targets, but nothing declares those
members any more. A device that already has their rows shows them as `member-removed` (or
`no-provider` for Tool Access Control, which is gone entirely); a fresh install doesn't create
them.

| Catalog ID | Contract v1 → member |
|---|---|
| `000peers0tool00000runner1` | System Host Tools → `default_assistant_runner` |
| `000peers0tool00toolsearch` | System Host Tools → `tool-search` |
| `000peers0tool0000000dircd` | System Desktop Tools → `cd` |
| `000peers0tool000000notify` | System Desktop Tools → `send-notification` |
| `000peers0tacapprove000001` | System Tool Access Control → `approve` |
| `000peers0tacreject0000001` | System Tool Access Control → `reject` |
| `000peers0taclist000000001` | System Tool Access Control → `listPending` |

All reviewed shipped IDs have contract targets; the unresolved inventory is empty.

`requiresWorkflowRun` is retired along with workflow runs. A definition that still
carries it, such as peers-core's frozen contracts, is accepted, and the key is ignored.

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
and identity, the requested `target`, live provider information, and `availability`.
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
Only the four documented invocation keys are accepted; any other key, such as a payload
`authority`, is rejected. The wrapper admits at None and preserves authority; it supplies
neither a system-package caller nor its own frame to the selected target.

Invocation accepts a plain argument object (omitted means `{}`), checks it against
the requested version's public schema (required fields, types, and top-level
`enumValues`), and converts top-level Date strings to valid Dates. Every contract
tool call gets the same check before its provider runs, whoever the caller.
Unknown fields and nested object contents are forwarded unchanged; schema
defaults are not inserted. Validation failures do not execute code.
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
`legacy-package-upgrade-required`: “Package PACKAGE_ID must be upgraded to provide this
tool through a contract.” Without package provenance it reports
`legacy-execution-removed`: “Legacy tool execution has been removed; provide this
tool through a contract.” Both messages link to the
[migration note](../Packages/contracts.md#migrating-from-toolinstances).
A provider declaring a member without a resolver reports `no-implementation`,
names the provider and member, and asks for a version that implements it.
Missing providers, removed members and quarantined identities remain actionable
unavailable records; catalog history is retained. Unreviewed custom IDs stay
unresolved after migration: update saved references to the contract's catalog ID. The old custom row remains deletable.

For package implementations, declare tools and handlers with `defineTool`, provide their
contracts through `definePackage` from `@peers-app/peers-sdk/define`, and rebuild with
`peers-package`. Only isolated package artifacts load. An older bundle, whether a
host-backed `definePackage()` build from the SDK root or a raw bundle, fails to load with a
rebuild instruction in the package status, and the package's previous version keeps serving
if one was running. See [Declaring a package](../Packages/declaring-a-package) and the
[older-format migration note](../Packages/contracts#isolated-contract-packages-electron).

`code` and `codeRepository` remain historical columns at Tools schema version 2.
Their saved bytes are preserved and never refreshed or executed by this runtime.
`packageId` is historical provenance, not ownership, availability or permission.
Supplemental `detailedDescription` metadata is keyed by a declared contract target and
written only after successful preparation. `isAssistantRunner` and `configSchema` are
historical columns too, kept but no longer written.

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
Tool mention queries show catalog entries. Browser-only hosts
without the catalog API fall back to non-quarantined rows. Historical mention IDs
remain readable even when their provider is unavailable.

## Policy

Compare the current user's context role (**U**), the delegated ceiling (**A**) of a call
made on the user's behalf, such as one a package or an agent makes, and the tool's level
(**T**):

| Condition | Result |
|---|---|
| `T > U` | Denied |
| `T <= A` | Runs |
| `A < T <= U` | Needs [step-up approval](#step-up-approval), which isn't available yet, so it's denied |
| No delegated ceiling, `T <= U` | Runs (CLI, UI, Device Operations `runTool`) |

The System Contract Catalog, which agents such as Voice Hub's use to find tools, lists only
the tools its caller can run.
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
`remoteAccessLevel` is set. A denied call simply fails. Packages reach remote tools through
`ctx.callRemoteTool(contractId, version, deviceId, toolName, args)` from a handler — see
[Package contracts](../Packages/contracts#remote-tool-calls-across-devices).

## Step-up approval

Step-up approval isn't available yet. It went with workflows, its only callers, and comes
back with delegates. Until then a call that would need it, a delegated ceiling below the
tool's level, is denied with a message that says approval isn't available.

## Shipped classifications

Unlisted package tools stay at **100**. Mixed-operation tools use the highest
required level until destructive operations are split.

| Level | Examples |
|---|---|
| 0 | Voice runners |
| 20 | `app-version`, `list-timers`, device status / list / get, network diagnostics, App Updates status, Packages list / get / capabilities / device activation |
| 40 | Tasks, groceries, timer writes, notifications, `dispatch-voice-action`, `query-database`, Packages reload |
| 60 | Network control (connect, disconnect, refresh, sync), Packages import / create / clone / install / uninstall / promote |
| 80 | Filesystem path tools, `queryDatabase`, device `runTool`, `deleteDevice`, `resetChangeTracking`, voice device-local operations, App Updates `checkForUpdates` |
| 100 | Unclassified package tools, App Updates update-and-restart |

## Configuration

Catalog records can display historical access metadata. Execution reads the
selected live provider's current declaration and the caller's role; editing a
catalog row does not grant access or override that provider's policy.

## Authority propagation and dynamic dispatch

`accessLevel` sets the role required to enter a tool. `authorityPropagation` controls the authority it may pass to a dynamically selected target. The default is `"cap"`: in strict dispatch the outgoing ceiling is the minimum of the current signed caller role, inherited ceiling, consume ceiling, and ordinary calling tool level. A `"preserve"` tool omits only its own level from that minimum. It cannot raise an inherited ceiling.

Set `accessLevel` and `authorityPropagation` in `defineTool` from
`@peers-app/peers-sdk/define`; `peers-package` carries them into the generated manifest.
**Installing the package is the trust decision.** There is no separate operator grant;
each call uses the active version's declaration, so an update's policy takes effect when
that version loads. Review a package's tool levels and propagation modes before installing
it into a group.

A Reader preserving router admits Readers and above; a direct Admin can dispatch Admin targets, but an Admin arriving through an ordinary Reader tool remains capped at Reader. A preserving router's Writer admission still rejects Readers. Omitted admission resolves to None (0) for a `preserve` tool; ordinary unclassified tools retain Self (100). None preserving entry still requires trusted identity and execution context and permits a level-0 caller to select only level-0 targets.

The `cap` ceiling from an ordinary tool's own level applies inside the strict dispatch scope:
whenever a `preserve` tool is on the chain, the caller is already under strict dispatch,
a built-in tool dispatches to another tool, or a call is admitted through an `exposes`
relationship. A direct call through a contract reference from an ordinary tool outside
that scope uses the ordinary user/delegate/tool policy. Declared tool levels, consume
ceilings, and group roles always apply.

Package handlers call public tools through a declared contract reference, such as
`Target(ctx).tools.run(args)`. Every call is authorized. Consumed-contract declarations and ceilings still apply; a tool marked `private` is callable only by its own package. Target admission levels are read live, separately for each provider. Arguments cannot provide a numeric role, user identity, or propagation mode.

Catalog filtering is advisory and execution rechecks the current role, ceiling, target metadata, and declared propagation mode. Strict calls deny approval-required outcomes and unsupported remote or cross-context forwarding. General table/observable writes remain outside this bounded dispatch scope.

## Tool screens

Tool details and field tables are read-only: identity, aliases, contract member,
provider, dispatch reason and live access come from the catalog. The code editor,
Save action, create-on-Enter flow and obsolete Settings Tasks importer are removed.
