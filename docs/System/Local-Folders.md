---
sidebar_position: 10
---

# System Local Folders

System Local Folders (`system.fs`) is the Runtime contract that lets an operator
grant a package access to a directory on this device. The user's folder stays
the storage. The host keeps a local index of content-defined blocks so a later
sync phase can serve byte ranges without copying the tree into the app data
directory.

The contract is **local-only**. Another device cannot call it, even on a
verified connection. Remote byte transfer is a later phase (block exchange),
not this contract.

The desktop app and `peers-headless` provide it by importing
`@peers-app/peers-device/local-folders`. That entry is not on the package root,
so the PWA bundle does not load the filesystem code or the native watcher. The
Packages screen shows "System Local Folders is not available on this host."

## Who can call what

Grants live in the personal database and never sync.

| Caller | What they can do |
| --- | --- |
| Operator (Packages UI, `peers fs`, headless `--folder`) | Create, list, and revoke every grant on this device. Pass `absolutePath` or, on the desktop, omit it and use the folder picker. |
| Isolated package | Use and revoke only grants whose `packageId` is that package. Cannot create a grant, and cannot pass `absolutePath`. |

An operator grant has no `packageId`. It is for the UI, the CLI, and startup
flags. A package grant is created by the operator with `--package` (or the
package field on `requestGrant`) and is invisible to every other package.
Revocation is checked on every call, so it takes effect immediately, and any
index job for that grant is cancelled. Revoking does not delete the directory.
`changed`, `jobProgress`, and `jobFinished` follow the same rule: an isolated
subscriber hears only its own grants and jobs. An operator subscriber hears
every grant on the device.

`groupId` is a peer id stored on the grant. It labels which group the folder
belongs to. The contract does not require that group to exist yet.

## Path rules

Every relative path is resolved inside the grant root:

- Paths are NFC-normalized.
- Absolute paths, `..`, and NUL bytes are rejected.
- The parent directory is `realpath`'d and must stay under the grant root, so a
  symlink cannot escape the folder. A symlink whose real path lands inside
  `.peers` is rejected too.
- The directory `.peers` is reserved. `list`, `index`, and `changed` skip it.
  Trash is stored at `.peers/trash/<YYYY-MM-DD>/`, keeping the original
  relative path. `.peers` and `.peers/trash` must be real directories; a
  symlink there makes `trash` fail and makes `purgeTrash` remove nothing.
  Later assembly will use `.peers/tmp/`.

`move`, `trash`, `purgeTrash`, and `index` require `mode: "readwrite"`.
`list`, `stat`, and `readRange` accept either mode.

## Tools and events

Contract version 1. Tools do not use an access level of their own; the grant
check is the authorization.

| Tool | Purpose |
| --- | --- |
| `requestGrant({ groupId, mode, packageId?, absolutePath? })` | Create or reuse a grant. Omit `absolutePath` on the desktop to open the folder picker. Isolated packages cannot call this. |
| `listGrants()` | Active grants visible to the caller. Returns `{ grants }`. |
| `revokeGrant({ grantId })` | Revoke one grant. Returns `{ revoked }`. |
| `list({ grantId, relPath?, recursive? })` | Directory entries (`kind`, `size`, `mtimeMs`, `inode`). Returns `{ entries }`. Skips `.peers`. |
| `stat({ grantId, relPath })` | One entry. |
| `readRange({ grantId, relPath, offset, length })` | Up to 256 KB, returned as base64. |
| `index({ grantId, relPath? })` | Start a host index job. Returns `{ jobId }`. |
| `getFileBlocks({ grantId, relPath })` | Indexed blocks for one file: `{ indexed, size?, mtimeMs?, blocks: [{ hash, size }] }`. Read mode is enough. `indexed` is false when the path has no row. |
| `getJob({ jobId })` | Job status, including after it finishes. |
| `cancelJob({ jobId })` | Cancel a running index. |
| `move({ grantId, from, to })` | Rename inside the grant and retarget the local index. |
| `trash({ grantId, relPath })` | Move into `.peers/trash/<date>/` and drop the index row. |
| `purgeTrash({ grantId, olderThanDays })` | Delete dated trash directories older than that many UTC days. |

Events:

| Event | Payload |
| --- | --- |
| `changed` | `{ grantId, changes: [{ relPath, kind }] }`. v1 hosts emit `created`, `modified`, and `deleted`. `renamed` is reserved. |
| `jobProgress` | `{ jobId, done, total }` |
| `jobFinished` | `{ jobId, status, error? }` |

`changed` is debounced 250 ms and coalesced per path. The native watch
(`@parcel/watcher`) starts when the first `changed` subscriber attaches and
stops when a grant is revoked. There is no replay: subscribe, then change the
file. A subscriber that attaches after a write does not see that write.

## Jobs and the local index

`index` returns as soon as the job id exists. The walk runs on the host, one
index per grant at a time, and it can be cancelled between blocks. It skips a
file when size, mtime, and inode are unchanged, and it can resume per file.
Block rows are written before the file row, so an interrupted file is indexed
again on the next run. A path that no longer exists drops the stale rows for
that path. `move` replaces any stale index rows at the destination, so a
rename onto a path that was deleted outside Peers does not fail. Progress events
can be missed; `getJob` is the catch-up, and finished jobs stay readable for one
hour. `getFileBlocks` is how a package reads the block list without querying the
tables directly.

Two device-local tables back the index:

- `LocalFolderFiles`, keyed by `(grantId, relPath)`, stores size, mtime, inode,
  and the block list.
- `LocalFolderBlocks`, keyed by block hash, stores `grantId`, `relPath`,
  offset, length, and mtime.

`assemble` and serving blocks to other devices are not part of this contract.

## Chunking

Indexing uses FastCDC and SHA-256 (`node:crypto`):

| Bound | Size |
| --- | --- |
| Minimum | 256 KB (a smaller file is one block) |
| Average | 1 MB |
| Maximum | 4 MB |

The same bytes always cut in the same places. Inserting bytes in the middle of
a file changes the block at the edit and at most the neighboring block, then
the cut resynchronizes. On this development machine a 64 MB file indexed at
about **33 MB/s** (Node, production bounds, average block about 1.2 MB).

## Packages screen

On the desktop app, the Packages list has a **Local folders** section: path,
group, package, mode, created time, Revoke, and Add folder. Add folder asks
for a group and a mode, then opens the OS folder picker.

A package's details page has a **Folders** tab filtered to grants for that
package. Add folder there stores the package id on the new grant.

## CLI

`peers fs` talks to the running desktop app, or to headless with `--auth-file`.

```bash
peers fs grant ~/Documents/notes --group <groupId>
peers fs grant ~/Documents/notes --group <groupId> --package <packageId> --mode read
peers fs grants
peers fs revoke <grantId>
peers fs ls <grantId> [relPath] -r
peers fs index <grantId> [relPath]
peers fs watch <grantId>
```

`--json` prints JSON. `index` prints `indexed done/total` and a summary line.
It also polls `getJob` every 1.5 seconds so a missed `jobFinished` cannot
hang the command. `watch` checks that the grant can be listed, then streams
`changed` until Ctrl+C. `grant` resolves the path and defaults to `readwrite`.

```bash
peers --auth-file ~/peers/cli/headless-auth.json fs grants
```

## Headless

Headless has no folder picker. Grant a directory at startup, or later with
`peers fs grant`:

```bash
npx peers-headless --db ~/peers/headless/server \
  --folder <groupId>=/srv/notes \
  --folder <groupId>=/srv/archive:ro
```

`--folder` is repeatable. `:ro` is read-only; the default is readwrite. The
same group, real path, and package are reused on the next start.

That process is the always-on node for a folder: a laptop that is asleep cannot
serve the files, and a headless host in the same group can hold the grant while
it stays up. This phase only grants the folder and builds the local index.
Copying blocks to other devices comes with block exchange.
