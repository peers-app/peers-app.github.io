---
sidebar_position: 12
---

# System Files

System Files lets a package save a file and read it back: an avatar, a photo on a list item, an
attachment. Files live in the package's own data context (a group or your personal space) and
reach that context's other devices, as the rest of its data does. It is available on desktop,
headless and the PWA.

Its main calls are `save` and `read`, plus a write session for files over 8 MiB, which
`saveWholeFile` runs for you. Use them from a tool handler or from a screen.

## From a tool handler

Declare it in the package, then call it with the handler's `ctx`:

```ts
import { readWholeFile, SystemFiles } from "@peers-app/peers-sdk/define";

// In the package declaration:
pkg.consumes(SystemFiles);

// Inside a tool handler:
const { fileId } = await SystemFiles(ctx).tools.save({
  name: "receipt.pdf",
  mimeType: "application/pdf",
  bytes, // a Uint8Array
});

const file = await readWholeFile((input) => SystemFiles(ctx).tools.read(input), fileId);
// file.bytes, file.name, file.mimeType, file.fileSize
```

`save` takes a file of up to 8 MiB. For anything larger, up to 1 GiB, use `saveWholeFile`, which
saves in pieces:

```ts
import { saveWholeFile, SystemFiles } from "@peers-app/peers-sdk/define";

const { fileId } = await saveWholeFile(SystemFiles(ctx).tools, {
  name: "recording.mp4",
  mimeType: "video/mp4",
  bytes, // a Uint8Array, or a Blob
});
```

Keep the `fileId` in one of your own tables, next to the row the file belongs to, in a field
declared with `zodFileId` ([File fields](../Packages/declaring-a-package#file-fields)), so Peers
knows the row uses the file.

## From a screen

A screen calls System Files with `hostContract`, and shows a file with `useFileUrl` from
`@peers-app/peers-ui`:

```tsx
import { hostContract, saveWholeFile, SystemFiles } from "@peers-app/peers-sdk";
import { useFileUrl } from "@peers-app/peers-ui";

const files = hostContract(SystemFiles);

async function onPick(file: File) {
  // saveWholeFile reads a picked File in pieces, so a large one isn't held in memory at once.
  const { fileId } = await saveWholeFile(files.tools, {
    name: file.name,
    mimeType: file.type,
    bytes: file,
  });
  await members.tools["set-avatar"]({ memberId, fileId });
}

function Avatar({ fileId }: { fileId?: string }) {
  const image = useFileUrl(fileId);
  return image.url ? <img src={image.url} alt="" /> : <Initials />;
}
```

`useFileUrl` reads the file in the screen's context (the active group, or your personal space),
and returns `url`, `loading` and `error`. The URL stops working when the component unmounts or
the file id changes, so use it only for rendering. It reads the whole file into memory, so it
refuses one over 64 MiB, as `readWholeFile` does; read a large file, such as a video, in ranges.

## What to expect

- **The same content is the same file.** Saving the same bytes with the same name and MIME type
  returns the same `fileId`; a different name or MIME type gives a new one. A file never changes.
  To replace an avatar, save the new image and store its id instead of the old one.
- **Unused contents are freed automatically.** Once nothing references a file through a
  [declared file field](../Packages/declaring-a-package#file-fields), each device retains it for
  the group's retention period (30 days by default), plus 7 days. Each device counts from when
  it first sees the file unreferenced. Your personal space uses the same default. Retention
  cannot be changed in this release.
- **Older files are kept.** Files saved by older Peers builds, and files saved through the
  deprecated `saveFile` RPC, stay even without declared references. Unused older package bundles
  are the exception: Peers can free them too.
- **Who can save and read.** Saving needs Writer in the context, and reading needs Reader. A
  Reader's save fails with "Permission denied: Tool requires Writer (40)".
- **Reading by id.** Anyone in the context who has a file's id can read it, from any package or
  screen. The signed-in user can inspect the context's files with
  [`peers files list`](./CLI.md#files) or the [Files tab](#seeing-your-files); packages cannot list
  them through System Files.
- **Your context only.** A package in one group can't read another group's files, even with the
  id: the read fails with "File not found".
- **This device only.** Another device can't call System Files on this one. Files reach other
  devices through sync instead.

## Seeing your files

Open a group's settings and choose **Files**, or **Settings → Files** for your personal space.
Readers can use the list too. It shows names, sizes, which tables reference each file, and
whether all, some or none of its contents are stored on this device. Presence and deadlines
describe **this device**, not every device in the group.

- **In use:** a declared file field references the file.
- **Waiting to free:** the date is the earliest its contents can be freed here. Shared or
  recently saved contents can stay longer.
- **Ready to free:** its contents can be freed at the next collection.
- **Kept** or **Never freed:** the file is kept, or the group's retention is set to never.
- **References not ready:** Peers cannot yet check all references, so it keeps the contents.

A disabled group's files are kept on this device, and its list shows once the group is enabled.

Yellow **Legacy** and **Kept** badges mark files that stay even when unused. You can't remove
these flagged files yet; explicit deletion comes in a later release. **Older package bundle**
is a separate badge: Peers frees unused bundles automatically once they are eligible.

The summary shows total file size, counting shared contents for each file, and the retention
period. Retention can't be changed yet. **Settings → Files** also shows this device's stored
chunks and bytes across your personal space and groups, plus the last and next collection.

The list loads when you open the tab. Use **Refresh** to see changes, and **Previous** and
**Next** to browse the list.

## Limits

- A file can be at most 1 GiB.
- A `save` takes at most 8 MiB. `saveWholeFile` saves a larger file in pieces of 8 MiB, through
  a write session (`startSave`, `appendSave` for each piece in order, then `finishSave`). A
  session ends 10 minutes after its last call, or 12 hours after it started, and saves nothing;
  start again. A write error ends the session too. `cancelSave` ends one early. Sessions
  belong to their starting caller in that context: a package cannot use another package's
  sessions or ones started by the signed-in UI or CLI. The UI and CLI act as the signed-in user
  and share that user's sessions on this device.
- A `read` returns at most 8 MiB. Give `offset` and `length` (in bytes) to read part of a file;
  without `length`, it reads from `offset` to the end, up to 8 MiB. Every read returns
  `fileSize`, the size of the whole file.
- `readWholeFile` reads in ranges for you, and refuses a file over 64 MiB, so a large file isn't
  read into memory by mistake. Pass `{ maxBytes }` to read a larger one whole, or read it in
  ranges.
- A file name and a MIME type are each at most 255 characters.

## How files reach other devices

A saved file's description syncs to the context's other devices with the rest of its data. Its
contents download the first time a device reads it, from a connected device that already has
them. Until the description arrives, a read on that device fails with "File not found". If no
connected device has the contents, the read fails with "this device doesn't have all of it,
and no connected device sent the rest". Try again once a device that has it is online.

If a file is referenced again after this device freed its contents, reading it fetches the
contents from another connected device that still has them. A device returning after months
offline starts its own full retention period when it first sees a file unreferenced. A new
reference clears that deadline; removing it later starts a fresh period.

**When the last copy can be lost.** Suppose a device that never downloaded a file adds a
reference to it. If that reference reaches no device holding the contents before all those
devices' deadlines pass, the last copy can be freed. Each deadline gives at least the retention
period plus 7 days from when that device first saw the file unreferenced. The file id and its
reference remain, but reading it fails as unavailable if no device still has the contents.

Shared contents stay while any file using them is still retained, including files in disabled
groups. Recently saved contents can also stay longer. Use
[`peers files gc --dry-run`](./CLI.md#files) to preview what this device would free now and its
next deadlines.

On desktop and headless, a device keeps file contents in an encrypted database for each account,
and contents that several of the account's groups share are stored once. The PWA keeps them in
the browser's storage. [`peers files`](./CLI.md#files) shows how much is stored.

## Related topics

- **[Declaring a package](../Packages/declaring-a-package#calling-contracts)**: consuming system
  contracts from a handler.
- **[Using the contract from a UI](../Packages/declaring-a-package#using-the-contract-from-a-ui)**:
  `hostContract`, `useRows` and `useTool`.
- **[System HTTP](./HTTP)**: fetching from the web, to save what you fetch.
