---
sidebar_position: 4
title: Mentions
---

# Mentions

A mention is a link from any text in Peers to one record: a person, a task, a note. Typing `<` in a
Peers editor finds any of them by title, in every group the user is in; `@` finds people, and a
package can give its records a character of their own, such as `#` for labels. The text then
holds an ordinary markdown link, and Peers shows it as a chip with the record's live title:

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
| `trigger` | Optional. A character that opens the picker on your records alone, besides `<`: `#`. See [Choosing a trigger](#choosing-a-trigger). |
| `label` | What one record is called, such as `Note`. The picker and chips show it. |
| `iconClassName` | A [Bootstrap Icons](https://icons.getbootstrap.com/) class for chips and picker rows, such as `bi bi-journal-text`. Peers draws its first `bi-` class. Keep the class form for now: current Peers also accepts an icon reference (`bi:journal-text`, or one emoji), but older versions refuse a package whose mention source uses one. |
| `color` | Optional. A color its chips are marked with, from the app palette: `blue`, `teal`, `red`, `amber`, `purple`, `orange`, `green`, `pink`, `violet` or `slate`. A label package might set one per label table. Older versions of Peers ignore it. |
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
  string, or a route outside your package, refuses the package. Your package's build also refuses
  a setting Peers doesn't know (a typo, usually) and a `trigger` that isn't one of the choices.
- **Older devices.** Peers 0.33.8 to 0.33.12 ignore `trigger`, and find your records after `@`
  and `<` as they find every record there; 0.33.7 or older won't load that version, and keeps
  running the version it had until it updates.

### Choosing a trigger

Your records are always found after `<`, with people and every other package's records. Set
`trigger` to give them a character of their own as well, one that finds only them:

```ts
mentions: {
  kind: "label",
  label: "Label",
  trigger: "#",
  titleField: "name",
  route: "app?labelId={id}",
},
```

- **The choice is `#`, for now.** More characters may join it as packages need them. `@` is for
  people, and `<` finds everything, so neither can be declared.
- **A trigger adds to `<`.** With `trigger: "#"`, `#work` finds only your labels, and `<work`
  finds them too, among everything else. A pasted id finds its record after any character.
- **Packages may share a trigger.** The picker mixes the results of every source on it, and shows
  each result's kind, and its package when two packages share a kind.
- **A trigger nothing declares does nothing.** `#` opens the picker only once a package that
  declares it is installed in one of the user's groups. Until then, `#work` is just text.
- **Links don't change.** A mention is the same `[label](peers://<kind>/<id>)` whichever character
  found it, so changing `trigger` later leaves everything already written alone.

Declare one for records people reach for often and want on their own, such as labels. Most
sources should leave it out: `<` finds them, and `<kind:` narrows to them.

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
- **`headings={false}`** is for short text such as messages: a line starting with `#`, a `---`
  line and `[!NOTE]` stay text. With headings on (the default, for documents), the editor also
  makes dividers and callouts (`> [!NOTE]`). Either way it has web links (⌘⇧K, and a popup to
  edit or remove one) and code blocks colored by language, and its value stays plain markdown.
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

- **`<`** followed by a search finds everything: people and every package's records. Type it at
  the beginning of a word; matching results appear as you type. People come first, then records
  that aren't finished, then the closest title matches, then the document's group. Each result
  shows what it is, so `<` is the place to look when you don't know which character finds a
  record.
- **`@`** finds people only.
- **A source's own trigger**, such as `#` for labels, finds only the records of the sources that
  declare it ([Choosing a trigger](#choosing-a-trigger)). `#` and a space at the start of a line
  still make a heading.
- **A kind before a colon** narrows to that kind, among what the character finds:
  `<task:garden` finds only tasks. The kind is matched loosely: `<tasks:`, `<Task:` and the
  kind's label (`<event:` for a source labelled Event) work too, and `<people:` finds people. A
  word that names no kind is searched as words, so `<re:dinner` still finds "Re: dinner".
- **Not in code or a link's text.** There, `<`, `@` and `#` stay text.
- **A card beside the list** shows the highlighted result: what it is, its status and group, and
  the start of its text when its source declares `previewField`.
- **A pasted id** of 25 letters and digits (`<` and then paste, or after any other character)
  finds its record whatever the character, and becomes a chip at once when exactly one record
  has it. If several kinds have that id, choose a result from the menu. An id that matches
  nothing the user can see becomes a dotted `?` chip, linked as `peers://ref/<id>`, which comes
  alive if the record turns up later. Undo restores the typed text and lets you choose from the
  menu.
- Picking a result inserts a chip labeled with the record's title.

## Related topics

- **[Declaring a package](./declaring-a-package)**: tables, routes, and screens.
- **[System: Tables](../System/Tables)**: filters and reactivity.
