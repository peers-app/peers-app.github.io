---
title: Mirror
sidebar_position: 11
---

# Mirror

Mirror keeps a folder the same on the devices you choose. Put a folder on your Mac, your PC and a
small always-on server, and a file you add, change or delete on one shows up the same way on the
others. Share the folder in a group and its members' devices can keep it too.

Files go straight from device to device, never through a server, and only the parts of a file
that changed are copied. A file you move or rename is moved on the other devices too, not copied
again. Each device keeps the folder wherever you put it.

Mirror is new. It runs on the desktop app and on [headless](./System/Headless.md) hosts. The
phone shows your folders and their devices but doesn't keep the files yet.

## Add a folder

1. Open **Mirror** and press **Choose a folder** (or **Add folder** once you have one). If Mirror
   is in one of your groups too, choose who sees the folder first: **Only your devices**, or a
   group, whose members can then see the folder and its files and keep a copy.
2. Pick the folder in the window that opens. Mirror reads it and lists its files.
3. On each other device, open Mirror, select the folder under **Not on this device**, and press
   **Choose a folder on this device**. Pick an empty folder, or one that already holds a copy.

If the folder you pick on another device already has files, the ones that are the same are left
as they are, and the ones that differ are kept as conflict copies (below). Nothing on either
device is overwritten.

## What you see

The list shows each folder with how it's doing on this device: **Up to date**, **Syncing 12
files**, **Looking it over…** (reading the folder, after you add it or Peers starts), **Paused**,
**Not on this device**, or, with a yellow warning sign, **1 conflict to sort out**.

With Mirror in a group too, the list is in sections by who sees each folder: **Only your
devices**, then **Shared with Pow-wow · 7 people** for each group. It's the same whichever group
is selected in Peers, and a folder is only ever seen by the people its section names.

Open a folder to see:

- **This device:** where the folder is here, how many files it holds, and any file that can't
  sync, with the reason.
- **Conflicts to sort out**, in a yellow box, when there are any.
- **Devices:** every device that keeps the folder, named for its owner and itself (`Mark •
  Macbook`, as in your device list, so renaming a device renames it here), and its state as it
  last reported it.
- **Recent changes:** the last files changed, who changed them and when, deletions included.
- **Not synced:** the patterns for files this folder leaves out, when it has any (below).

The **⋯** menu pauses the folder on this device, asks Mirror to look it over again, opens this
device's **Trash**, chooses what not to sync, removes the folder from this device, or stops
syncing it for everyone.

## When two devices change the same file

When two devices change one file before either has seen the other's change, one version keeps the
name and the other is saved next to it as a conflict copy:

```
report.docx
report (conflict from Mark • Macbook, 2026-11-17 14.05).docx
```

The name says whose device made that version, and when, in that device's clock. Open both, keep
what you want, and delete the copy, or rename it to keep both. Both are ordinary files, synced
like any other.

Mirror makes it hard to miss: the folder shows a yellow warning until each conflict copy is
deleted or renamed (an edited copy, or one moved away and back under its name, is still a conflict
copy), and the device whose version became the copy sends you a quiet notification (a popup
without sound; your notification settings for Mirror decide in the end). Several conflicts found
at once make one notification. Deleting or renaming the last copy withdraws it.

An edit always beats a deletion: if one device deletes a file while another changes it, the
changed file comes back everywhere.

A change you haven't synced is never overwritten, even one you save while Mirror is copying
another device's version of that file in: one of the two becomes a conflict copy.

## Trash and earlier versions

Mirror doesn't delete or overwrite your files outright. On each device:

- **A file deleted on another device** goes into the folder's trash on this one.
- **A file another device changed:** the version it replaces here is kept, the last 5 of each
  file.

Both stay 30 days. To see them, open the folder's **⋯** menu and choose **Trash on this device**.
Each entry says whether it was deleted or is an earlier version, when, and its size. **Restore**
puts it back where it was, or beside it when that name is taken (`report (restored 2026-11-18
09.20).docx`), and it syncs to the other devices again.

Each device's trash holds what Mirror removed or replaced there. A file you delete yourself isn't
in it: it's wherever you deleted it to, such as your computer's trash. The trash and earlier
versions live inside the folder, in `.peers/`, which Mirror never syncs.

Earlier versions, the Trash page, and keeping an edit saved while a copy comes in need a Peers
newer than 0.33.15 on that device. On an older one, the Trash page says so, deleted files still go
to `.peers/trash/<date>/` inside the folder (move one out to restore it), and a moved file whose
old copy is already in the trash is copied again.

## Choose what not to sync

Some files don't belong on every device: `node_modules`, build output, logs. Open the folder's
**⋯** menu, choose **Choose what not to sync**, and write one pattern per line, as in a
`.gitignore`:

```
node_modules/
*.log
build/
/drafts
```

- A name (`node_modules`, `*.log`) matches at any depth.
- A `/` at the end matches folders only; a `/` at the start or in the middle ties the pattern to
  the folder's top (`/drafts` is only the top-level `drafts`).
- `*` matches within a name, `**` any number of folders (`docs/**/*.pdf`), and `?` one character.
- Capitals don't matter. Lines starting with `#` are comments. `!` to bring a file back isn't
  supported.

The patterns belong to the folder, so they apply on every device that keeps it. Matching files stay
where they are on each device but stop syncing; nothing is deleted. Remove a pattern and those files
sync again (if they changed on two devices meanwhile, one becomes a conflict copy). Editing the
patterns takes the Writer role in the folder's group, and each device needs Mirror 0.2.0 or later
to follow them.

## Moving or renaming the folder

Move and rename files and folders inside it as you like: the other devices do the same.

If you move, rename or delete the folder itself, or it's on a drive you unplug, Mirror can't find
it on that device. The folder shows **Can't find the folder**, there and on your other devices,
and nothing changes on them: a missing folder never counts as deleted files.

- Put it back (rename it back, or plug the drive in again) and Mirror carries on, sending any
  changes you made to it meanwhile.
- Moved it for good? Choose **Find it** and pick where it is now. Mirror carries on from there;
  nothing is copied again.
- If you pick a different folder, or make a new one where it was, Mirror treats the files in it as
  new: it fills in what's missing from your other devices, keeps files that differ as conflict
  copies, and deletes nothing.
- Don't want it on this device any more? Choose **Remove from this device**.

The same goes for a folder whose files all disappear while Peers isn't running: Mirror brings them
back from your other devices instead of deleting them everywhere. To delete everything in a folder,
delete the files while Peers is running.

## Keep one device always on

Two devices copy files only while both are online. If your laptops are rarely awake at the same
time, keep the folder on a device that stays on: a desktop, or a small computer running
[peers-headless](./System/Headless.md). It holds every file and passes changes along.

## Removing a folder

- **Remove from this device** stops keeping it here. The files stay where they are, and the other
  devices keep theirs. Put it back in the same folder later, even if you've moved or renamed it
  since, and Mirror carries on where it left off; in a different folder, files that differ become
  conflict copies.
- **Stop syncing for everyone** stops it on every device. The files stay on each device; they're
  just no longer kept the same.

## What isn't synced yet

- Symbolic links, empty folders, and file permissions.
- Files over about 4 GB.
- Clutter that systems and apps make on their own: `.DS_Store`, `Thumbs.db`, `desktop.ini`,
  Office's `~$` and LibreOffice's `.~lock` files, editors' swap files, and unfinished downloads
  (`.crdownload`, `.part`, `.download`).
- A file whose name differs from another only in capitals (`Readme.txt` and `README.txt`) can't
  live on a Mac or Windows PC; it's listed under the files that can't sync.

## From the command line or an agent

Mirror's tools work from the [CLI](./System/CLI.md) in the folder's group (`-c <groupId>`, or
leave it off for Personal). A headless host has no folder picker, so grant the folder first:

```bash
peers fs grant ~/Shared --group <groupId> --package 00mwltdt9ys2khmvifcrig43t --json
peers tools run mirror-create-folder '{"grantId": "<grantId>", "deviceName": "Server"}' -c <groupId>
peers tools run mirror-attach '{"folderId": "<folderId>", "grantId": "<grantId>"}' -c <groupId>
peers tools run mirror-list-folders '{}' -c <groupId>
peers tools run mirror-list-files '{"folderId": "<folderId>", "conflicts": true}' -c <groupId>
```

| Tool | What it does |
| --- | --- |
| `mirror-list-folders` | The group's folders, each device's state, and where this device keeps each one. |
| `mirror-create-folder` | Start mirroring a granted folder in the group, kept on this device. |
| `mirror-attach` | Keep one of the group's folders on this device, in a granted folder; or, for a folder this device can't find (`here.missing` in `mirror-list-folders`), keep it where it is now. |
| `mirror-list-files` | A folder's files, newest change first; `conflicts: true` for conflict copies only. |
| `mirror-pause` | Pause or resume a folder on this device. |
| `mirror-sync-now` | Look a folder over again now. |
| `mirror-detach` | Stop keeping a folder on this device. |
| `mirror-remove-folder` | Stop syncing a folder for everyone. |
| `mirror-set-ignore` | Set a folder's not-synced patterns (`patterns`, one per entry). |
| `mirror-list-trash` | This device's deleted files and earlier versions for a folder, newest first. |
| `mirror-restore` | Put one back (pass the entry from `mirror-list-trash`). |

Mirror keeps folders with [System Local Folders](./System/Local-Folders.md), which grants it the
folder, indexes files into blocks, and copies blocks between devices.
