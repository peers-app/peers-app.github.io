---
sidebar_position: 12
---

# System Files

System Files lets a package save a file and read it back: an avatar, a photo on a list item, an
attachment. Files live in the package's own data context (a group or your personal space) and
reach that context's other devices, as the rest of its data does. It is available on desktop,
headless and the PWA.

It has two calls, `save` and `read`. Use them from a tool handler or from a screen.

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

Keep the `fileId` in one of your own tables, next to the row the file belongs to.

## From a screen

A screen calls System Files with `hostContract`, and shows a file with `useFileUrl` from
`@peers-app/peers-ui`:

```tsx
import { hostContract, SystemFiles } from "@peers-app/peers-sdk";
import { useFileUrl } from "@peers-app/peers-ui";

const files = hostContract(SystemFiles);

async function onPick(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { fileId } = await files.tools.save({ name: file.name, mimeType: file.type, bytes });
  await members.tools["set-avatar"]({ memberId, fileId });
}

function Avatar({ fileId }: { fileId?: string }) {
  const image = useFileUrl(fileId);
  return image.url ? <img src={image.url} alt="" /> : <Initials />;
}
```

`useFileUrl` reads the file in the screen's context (the active group, or your personal space),
and returns `url`, `loading` and `error`. The URL stops working when the component unmounts or
the file id changes, so use it only for rendering.

## What to expect

- **Each save makes a new file** with a new id. A file never changes. To replace an avatar, save
  the new image and store its id instead of the old one.
- **Files can't be deleted yet.** An old file stays until a later version of Peers adds deletion.
- **Who can save and read.** Saving needs Writer in the context, and reading needs Reader. A
  Reader's save fails with "Permission denied: Tool requires Writer (40)".
- **Reading by id.** Anyone in the context who has a file's id can read it, from any package or
  screen. There's no way to list files, and ids can't be guessed, so a file is read only by those
  you give its id to.
- **Your context only.** A package in one group can't read another group's files, even with the
  id: the read fails with "File not found".
- **This device only.** Another device can't call System Files on this one. Files reach other
  devices through sync instead.

## Limits

- A `save` takes at most 8 MiB. Shrink an image before saving it.
- A `read` returns at most 8 MiB. Give `offset` and `length` (in bytes) to read part of a file;
  without `length`, it reads from `offset` to the end, up to 8 MiB. Every read returns
  `fileSize`, the size of the whole file. `readWholeFile` reads in ranges for you.
- A file name and a MIME type are each at most 255 characters.

## How files reach other devices

A saved file's description syncs to the context's other devices with the rest of its data. Its
contents download the first time a device reads it, from a connected device that already has
them. Until the description arrives, a read on that device fails with "File not found". If no
connected device has the contents, the read fails with "this device doesn't have all of it,
and no connected device sent the rest". Try again once a device that has it is online.

## Related topics

- **[Declaring a package](../Packages/declaring-a-package#calling-contracts)**: consuming system
  contracts from a handler.
- **[Using the contract from a UI](../Packages/declaring-a-package#using-the-contract-from-a-ui)**:
  `hostContract`, `useRows` and `useTool`.
- **[System HTTP](./HTTP)**: fetching from the web, to save what you fetch.
