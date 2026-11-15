---
sidebar_position: 4
title: Mentions
---

# Mentions

A mention is a link from any text in Peers to one record: a person, a task, a note. Typing `@` or
`<` in a Peers editor finds records by title in every group the user is in. The text then holds an
ordinary markdown link, and Peers shows it as a chip with the record's live title:

```markdown
Blocked on [Notes package](peers://task/00mw55vifo1dnuvbiy52o2yb7), ask [Blair](peers://user/00m87fbwu96jzf8qnwllly0fd).
```

Your package can make its own records mentionable by declaring one of its tables as a mention
source. Peers does the rest: the picker, the chips, live titles, and opening the record.

## The link

- **`peers://<kind>/<id>`** inside a markdown link. The kind says what sort of record it is
  (`task`, `note`, `user`), and the id is the record's id, percent-encoded.
- **No group in the link.** A link still works when its record moves to another group, or is
  read in another group. Peers finds where the record is.
- **The label** is the record's title when the mention was written. Peers never rewrites it, and
  a chip shows the live title instead. Readers outside Peers (exports, the CLI, agents) see the
  label.
- **A link to any kind**, `peers://ref/<id>`, points at whatever record has that id. The editor
  writes one for a pasted id that matches nothing the user can see; Peers looks the id up in
  every kind, so the link comes alive if the record turns up later.
- **Older mentions** in the `<$kind:Name:id>` form still show as chips. The editor rewrites them
  as links when it opens a document.

## Declaring a mention source

Add `mentions` to one of your tables:

```ts
import { defineTable, z, zodPeerId } from "@peers-app/peers-sdk/define";

export const Notes = defineTable({
  name: "Notes",
  description: "The group's notes.",
  primaryKeyName: "noteId",
  schema: z.object({
    noteId: zodPeerId,
    title: z.string(),
    body: z.string(),
  }),
  mentions: {
    kind: "note",
    label: "Note",
    iconClassName: "bi bi-journal-text",
    titleField: "title",
    previewField: "body",
    route: "app?noteId={id}",
  },
});
```

| Setting | What it does |
|---|---|
| `kind` | The kind in your links. 2–24 lowercase letters, digits or dashes, starting with a letter. It's written into other records' text, so treat it like an API name. |
| `label` | What one record is called, such as `Note`. The picker and chips show it. |
| `iconClassName` | A [Bootstrap Icons](https://icons.getbootstrap.com/) class for chips and picker rows. |
| `titleField` | The string field the picker searches (by word) and that chips show. |
| `statusField` | Optional. A string field shown beside the title, such as a task's status. |
| `doneValues` | Optional, with `statusField`. Values that mean the record is finished; their chips are struck through. |
| `previewField` | Optional. A string field whose start the picker shows beside the highlighted result, so users can tell similar titles apart. The preview is up to 280 characters, with markdown shown as plain text. |
| `route` | Your screen that opens one record, relative to your package, with `{id}` where the id goes. `app?noteId={id}` opens `package-nav/<your package id>/app?noteId=<id>`. |

What to expect:

- **No package code runs for a mention.** You don't need to provide search or resolve tools.
  Your records can be found and linked on a device where your package is installed and loads.
- **Changing it isn't a schema change.** You don't need to raise the table's `versionNumber`.
- **Several packages may use the same kind.** Peers combines them, and shows the package name
  when two share a kind. The system's kinds (`user`, `ref`, `tool`, `group`, `package`,
  `device`, `mobile-settings`) can't be declared, and each kind may appear on only one of your
  tables.
- **Peers checks it when your package loads**: a title, status or preview field that isn't a
  string, or a route outside your package, refuses the package.
- **Older devices.** A device whose Peers predates a mention setting you use (`previewField`, or
  mention sources at all) won't load that version of your package; it keeps running the version
  it had until it updates.

## Opening a record

A click on a chip finds the record in every group the user can read:

- **In the active group**, Peers opens your route.
- **In another group**, Peers switches to that group (which reloads the app), then opens your
  route. A screen whose route declares `opensAnyGroup: true` opens in place instead, with
  `groupId=<group>` added to the path ([Screens that show any group](./declaring-a-package#screens-that-show-any-group)).
- **In more than one place** (the same id in two groups, or from two packages), Peers asks the
  user which one.
- **Nowhere the user can read** (deleted, in a group the user isn't in, or an id nothing has):
  the chip is dotted, with a `?` and the label it was written with, and opens nothing.

Read the id (and `groupId`, if you declare `opensAnyGroup`) from the path with `mainContentPath`
and show that record.

## Mentions in your screens

The editor and the markdown renderer in `@peers-app/peers-ui` handle mentions:

```tsx
import { MarkdownEditor, MarkdownWithMentions } from "@peers-app/peers-ui";

<MarkdownEditor value={bodyObs} groupId={note.groupId} />;
<MarkdownWithMentions content={comment.text} groupId={note.groupId} />;
```

- **`groupId`** is the group the text belongs to. Pass it so the picker favors that group's
  records and marks results from other groups with their group's name. Without it, the picker
  uses the active group.
- **`mentions={false}`** turns off the picker in an editor. Mentions already in the text still
  show as chips.
- **Making a link from selected text.** Pass `effects` to the editor: once it's mounted,
  `effects.getSelectedText()` returns the selection as plain text, and
  `effects.replaceSelectionWithMention({ kind, id, label })` replaces it with a chip. For example,
  use these hooks to turn selected text into a new note or task, linked where the text was.
  After a button takes focus, the hooks use the editor's last selection. With nothing selected,
  they return `""` and `false`, respectively.
- **`MentionChip`** shows one mention anywhere in your screen, and **`openMention({ kind, id })`**
  opens one, as a click on a chip does.

Search belongs to Peers' editor: System Mentions refuses package callers, and once screens are
isolated a screen won't reach it. Don't build on calling its tools from your screen; use the
editor's picker.

## The picker

- **`@` or `<`** followed by a search starts it at the beginning of a word; matching results
  appear as you type. People come first, then records that aren't finished, then the closest
  title matches, then the document's group.
- **`@kind:`** (or `<kind:`) narrows it to one kind: `@task:garden` finds only tasks.
- **A card beside the list** shows the highlighted result: what it is, its status and group, and
  the start of its text when its source declares `previewField`.
- **A pasted id** of 25 letters and digits (`<` and then paste, or `@`) becomes a chip at once
  when exactly one record matches. If several kinds have that id, choose a result from the
  menu. An id that matches nothing the user can see becomes a dotted `?` chip, linked as
  `peers://ref/<id>` (or `peers://task/<id>` after `<task:`). Undo restores the typed text and
  lets you choose from the menu.
- Picking a result inserts a chip labeled with the record's title.

## Related topics

- **[Declaring a package](./declaring-a-package)**: tables, routes, and screens.
- **[System: Tables](../System/Tables)**: filters and reactivity.
