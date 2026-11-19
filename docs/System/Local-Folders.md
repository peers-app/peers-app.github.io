---
sidebar_position: 10
---

# System Local Folders

System Local Folders (`system.fs`) is the Runtime contract that lets an operator
grant a package access to a directory on this device. The user's folder stays
the storage. The host keeps a local index of content-defined blocks so it can
serve byte ranges without copying the tree into the app data directory.
[Mirror](../mirror.md), the folder-sync app, is built on it.

The contract is **local-only**. Another device cannot call it, even on a
verified connection. `assemble` is the host job that pulls blocks from other
devices; the block protocol itself is not a contract.

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
index or assemble job for that grant is cancelled. Revoking does not delete the directory.
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
- The directory `.peers` is reserved, at any depth and in any capitals
  (`.Peers` too, on every platform, since Mac and Windows drives treat it as the
  same folder). `list`, `index`, and `changed` skip it, and the other tools
  refuse a path through it. Trash is stored at `.peers/trash/<YYYY-MM-DD>/`, keeping the original
  relative path; when that path is already taken that day, at
  `.peers/trash/<YYYY-MM-DD>-<n>/`. Earlier versions that `assemble` kept are at
  `.peers/versions/<relPath>/<epoch ms><extension>`. `.peers` and the
  directories in it must be real directories; a symlink there makes `trash`
  and `restore` fail and makes `purgeTrash` remove nothing.
  `assemble` writes `.peers/tmp/<manifest-key>.part` and a sibling state file.

`move`, `trash`, `restore`, `purgeTrash`, `index`, and `assemble` require `mode: "readwrite"`.
`list`, `stat`, `readRange`, `getFileBlocks`, and `listTrash` accept either mode.

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
| `index({ grantId, relPath?, relPaths? })` | Start a host index job for one file or directory (the whole grant when empty), or for up to 10,000 in `relPaths`. Returns `{ jobId }`. |
| `getFileBlocks({ grantId, relPath })` | Indexed blocks for one file: `{ indexed, size?, mtimeMs?, blocks: [{ hash, size }] }`. Read mode is enough. `indexed` is false when the path has no row. |
| `assemble({ grantId, relPath, blocks, mtimeMs?, mode?, sources?, expect?, keepVersions? })` | Start a host job that writes those blocks to `relPath`. Returns `{ jobId }`. See [Replacing a file](#replacing-a-file). |
| `getJob({ jobId })` | Job status, including after it finishes. `kind` is `index` or `assemble`. |
| `cancelJob({ jobId })` | Cancel a running index or assemble. An assemble keeps its partial file. |
| `move({ grantId, from, to })` | Rename inside the grant and retarget the local index. |
| `trash({ grantId, relPath })` | Move into `.peers/trash/<date>/` and drop the index row. Returns `{ trashed, trashPath }`. |
| `listTrash({ grantId, limit? })` | Deleted files and kept earlier versions, newest first: `{ entries: [{ trashPath, relPath, kind, at, size, mtimeMs }], truncated }`. `kind` is `deleted` or `version`; `relPath` is the path it had; `at` is about when it was deleted or replaced (epoch ms). At most 2,000 entries. |
| `restore({ grantId, trashPath, to?, expect? })` | Move a trash entry or an earlier version back to `relPath`, or to `to`. The destination must not exist. `expect: { size, mtimeMs }` restores it only if it still has them (else the error `changed`). Returns `{ relPath }`. The restored file isn't indexed until you `index` it: until then `getFileBlocks` returns `indexed: false`. |
| `purgeTrash({ grantId, olderThanDays })` | Delete dated trash directories and kept versions older than that many UTC days, and `.peers/tmp` files (including resumable assemble partials) whose mtime is older than the same cutoff. `0` drops partials last written before today UTC. |

Events:

| Event | Payload |
| --- | --- |
| `changed` | `{ grantId, changes: [{ relPath, kind }] }`. v1 hosts emit `created`, `modified`, and `deleted`. `renamed` is reserved. An empty `relPath` (`modified`) means anything in the folder may have changed: look it all over. |
| `jobProgress` | `{ jobId, done, total }` |
| `jobFinished` | `{ jobId, status, error? }` |

`changed` is debounced 250 ms and coalesced per path. The native watch
(`@parcel/watcher`) starts when the first `changed` subscriber attaches and
stops when a grant is revoked. There is no replay: subscribe, then change the
file. A subscriber that attaches after a write does not see that write.

When the granted folder itself is moved away, renamed, deleted or unplugged,
every call on the grant fails with `Granted folder is not available` until it's
back; don't take its files for deleted. The watch stops meanwhile. On Peers
newer than 0.33.16, within a few seconds of the folder coming back, or of a
different folder appearing at its path, it's watched again and `changed` reports one change with an empty
`relPath`: changes made while it was away weren't seen one by one, so look the
whole folder over. `stat` with an empty `relPath` gives the folder's own
`inode`, to tell a folder that's back from a different one at the same path.

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

## Replacing a file

`assemble` replaces whatever is at `relPath` when it finishes. Two inputs make
that safe for a sync app:

- `expect` is what the caller last saw there: `{ size, mtimeMs, inode? }` for a
  file, or `{ absent: true }` for nothing. The job checks it when it starts and
  again just before the finished file is renamed into place. If the file
  changed (someone saved it while the copy ran), the job fails with
  `error: "changed"` and leaves the file alone. The partial file stays, so a
  later `assemble` of the same blocks, for example after you moved the edited
  file aside, finishes without copying them again.
- `keepVersions: n` moves the file being replaced to
  `.peers/versions/<relPath>/` first and keeps the newest `n` versions of that
  path (at most 100). `listTrash` lists them as `kind: "version"`, `restore`
  puts one back, and `purgeTrash` deletes old ones. Keeping a version is best
  effort: if it can't be kept, the file is still replaced and the host logs a
  warning.

A host older than these inputs ignores them, and `listTrash` and `restore` fail
there with an error saying the contract does not provide that tool (`Contract
<id> does not provide tool 'listTrash'`). Treat that as "not available on this
device".

## Block exchange

`assemble` is a host job. Packages pass a path, a block list, and a job id.
The bytes move on the verified device connection, not through `system.fs`.

Control calls are `lf.haveBlocks` and `lf.getBlocks`. Block bytes travel in
stream mode as `[u16 hash length][hash][data]`. An empty payload means this
device cannot serve that block (the row is gone, the grant was revoked, the
file mtime changed, or the bytes no longer match the hash). The server checks
authorization on every request: the caller is the same user, or has at least
Reader on the grant's group. A group id that does not exist does not count as
founder. The same-user check is what lets a synthetic `--folder` group id work
before a `Groups` row exists.

The manifest key is the SHA-256 of the block hashes joined by newlines. The
partial file is `<root>/.peers/tmp/<key>.part`, preallocated to the total size,
with `<key>.state.json` holding a received-block bitmap. A bit is set only
after the partial file is `fdatasync`'d, so a crash cannot mark a block that is
not on disk. A later `assemble` of the same block list resumes from that file.
Blocks already in this device's index are copied locally before anything is
pulled. When the file is complete the host fsyncs, renames it onto `relPath`,
applies `mtimeMs` and the low 9 mode bits, and writes the index rows from the
manifest without hashing the file again.

The job stays `running` while no peer can serve a block. If no block arrives
for 10 minutes it ends with `error: "stalled"`. `cancelJob` and revoking the
grant abort the job and leave `.part` in place. `getJob` on a finished assemble
returns `{ bytesPulled, bytesReused, sources }`: bytes received from peers (each
block counted once, even if it arrived twice), bytes copied from this
device's index, and how many peers sent blocks. Blocks a resumed job found
already in `.part` count in neither total.

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
peers fs blocks <grantId> <relPath>
peers fs assemble <grantId> <relPath> --from <manifest.json|-> [--source <deviceId>]
peers fs watch <grantId>
```

`--json` prints JSON. `index` prints `indexed done/total` and a summary line.
It also polls `getJob` every 1.5 seconds so a missed `jobFinished` cannot
hang the command. `blocks` prints the indexed manifest as JSON and exits with
an error when the path is not indexed. `assemble` reads a blocks array, or
`{ blocks, mtimeMs?, mode? }`, from a file or stdin, and polls the same way.
Repeat `--source` to limit which devices may serve blocks. `watch` checks that the grant can be listed, then streams
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
it stays up. While it is running it also serves indexed blocks to devices that
are allowed to read the grant's group, and it can `assemble` files from those
peers.
