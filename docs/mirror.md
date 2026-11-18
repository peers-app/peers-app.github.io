---
title: Mirror
sidebar_position: 11
---

# Mirror

Mirror keeps a folder the same on the devices you choose. Put a folder on your Mac, your PC and a
small always-on server, and a file you add, change or delete on one shows up the same way on the
others. Share the folder in a group and its members' devices can keep it too.

Files go straight from device to device, never through a server, and only the parts of a file
that changed are copied. Each device keeps the folder wherever you put it.

Mirror is new. It runs on the desktop app and on [headless](./System/Headless.md) hosts. The
phone shows your folders and their devices but doesn't keep the files yet.

## Add a folder

1. Open **Mirror** and press **Choose a folder** (or **Add folder** once you have one). With
   Mirror in more than one group, pick the group first: everyone in it can see the folder.
2. Pick the folder in the window that opens. Mirror reads it and lists its files.
3. On each other device, open Mirror, select the folder under **Not on this device**, and press
   **Choose a folder on this device**. Pick an empty folder, or one that already holds a copy.

If the folder you pick on another device already has files, the ones that are the same are left
as they are, and the ones that differ are kept as conflict copies (below). Nothing on either
device is overwritten.

## What you see

The list shows each folder with how it's doing on this device: **Up to date**, **Syncing 12
files**, **Looking it over…** (reading the folder, after you add it or Peers starts), **Paused**,
or, with a yellow warning sign, **1 conflict to sort out**.

Open a folder to see:

- **This device:** where the folder is here, how many files it holds, and any file that can't
  sync, with the reason.
- **Conflicts to sort out**, in a yellow box, when there are any.
- **Devices:** every device that keeps the folder, named for its owner and itself (`Mark •
  Macbook`, as in your device list, so renaming a device renames it here), and its state as it
  last reported it.
- **Recent changes:** the last files changed, who changed them and when, deletions included.

The **⋯** menu pauses the folder on this device, asks Mirror to look it over again, removes it
from this device, or stops syncing it for everyone.

## When two devices change the same file

When two devices change one file before either has seen the other's change, one version keeps the
name and the other is saved next to it as a conflict copy:

```
report.docx
report (conflict from Mark • Macbook, 2026-11-17 14.05).docx
```

The name says whose device made that version, and when, in that device's clock. Open both, keep
what you want, and delete the copy. Both are ordinary files, synced like any other.

Mirror makes it hard to miss: the folder shows a yellow warning until the conflict copies are
gone (an edited copy, or one moved away and back, is still a conflict copy), and the device whose version became the copy sends you a quiet notification (a popup
without sound; your notification settings for Mirror decide in the end). Several conflicts found
at once make one notification. Deleting the last copy withdraws it.

An edit always beats a deletion: if one device deletes a file while another changes it, the
changed file comes back everywhere.

## Deleted files go to the trash

When a file is deleted on another device, Mirror moves this device's copy into the folder's trash,
`.peers/trash/<date>/`, inside the folder, keeping its path. Files stay there for 30 days. To get
one back, move it out of the trash into the folder; Mirror syncs it again as a new file.

Mirror doesn't keep old versions of a changed file yet. A change you haven't synced is never
overwritten: if another device changed the file too, yours becomes a conflict copy.

## Keep one device always on

Two devices copy files only while both are online. If your laptops are rarely awake at the same
time, keep the folder on a device that stays on: a desktop, or a small computer running
[peers-headless](./System/Headless.md). It holds every file and passes changes along.

## Removing a folder

- **Remove from this device** stops keeping it here. The files stay where they are, and the other
  devices keep theirs. Put it back in the same folder later and Mirror carries on where it left
  off; in a different folder, files that differ become conflict copies.
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
| `mirror-attach` | Keep one of the group's folders on this device, in a granted folder. |
| `mirror-list-files` | A folder's files, newest change first; `conflicts: true` for conflict copies only. |
| `mirror-pause` | Pause or resume a folder on this device. |
| `mirror-sync-now` | Look a folder over again now. |
| `mirror-detach` | Stop keeping a folder on this device. |
| `mirror-remove-folder` | Stop syncing a folder for everyone. |

Mirror keeps folders with [System Local Folders](./System/Local-Folders.md), which grants it the
folder, indexes files into blocks, and copies blocks between devices.
