---
title: Notes
sidebar_position: 10
---

# Notes

Notes keeps your notes and your journal. A note is markdown text in a group, or in your personal
space, and syncs to every device in that group. Notes shows one note at a time, full screen, with
a dock along the bottom to search, open recent and pinned notes, and start a new one.

## The views

The icons at the top left switch views. Each device opens in the view it showed last.

- **Page:** one note, full screen. The first line is its title.
- **Journal:** a page for each day, today first and ready to type, with earlier days underneath.
  Under each day's page are that day's events from Calendar, the tasks finished in Tasks, and the
  day's plan from Desk, when those are installed. The month beside the days takes you to any day,
  even one with nothing written yet. It marks the day you're on and turns with the days as you
  scroll. On a phone it's a strip of seven days, ending today when you open it: **‹** and **›**
  step it a week (Notes 0.1.8 and later).
- **Library:** your notes in a list, filtered by **All notes**, **Pinned**, a group, or a
  `#tag`, with the open note beside it.
- **Graph:** the open note in the middle, with what it links to and what links to it around it.
  Clicking the middle note, a card's **Open** or a link to a note opens that note in a side panel
  beside the graph, where you can read and edit it; a link also moves the graph to it.

A note's group shows as a dot in the group's color, in every view and in the Graph. It's the color
the group has everywhere in Peers (Notes 0.1.7 and later, on Peers 0.33.19 and later; before that,
Notes picks a color for each group). Change it in Peers
([Groups → Colors and icons](./System/Groups#colors-and-icons)).

The dock works in every view:

- **Search** (⌘P, or Ctrl+P) finds notes in every group, by title first and then by text. When
  no title matches exactly, the last line creates a note with what you typed.
- **Recent** lists the notes you opened on this device.
- **New** starts a note in the open note's group. Until you type, it isn't saved, and the group
  name at the top left picks another group.
- **Pinned** lists the notes you pinned. Pins are yours and follow you to your other devices.
- **Info** shows a note's group, tags, dates and outline, what it links to and what links to it,
  **Copy ID** and **Copy link**, and deletes it. Deleting removes it for everyone in the group.

## Writing

Notes saves as you type, a moment after you pause. Type `#tags` anywhere in the text. Type `<` and
a few letters to link a person, a task or a note from any of your groups (`@` finds people only).
The picker shows the highlighted task or note's group and the start of its text. The link shows the record's current title, and clicking it opens it (a note opens beside the
page, the days or the graph). Select some text for **Make note** or **Make task**: the selection becomes a new note, or a
task waiting in Tasks' Inbox, and a link to it takes its place. Changes from your other devices,
other people in the group, or an agent show in the open note, unless you have typing there that
hasn't saved yet.

**Formatting.** Type markdown as you write: `# ` for a heading, `- ` for a list, `[ ] ` for a checklist, `> ` for a quote, three backticks for code, `---` and a space for a
divider, and `==text==` to highlight. For a callout box, type `[!NOTE] ` at the start of a line,
or TIP, IMPORTANT, WARNING or CAUTION. Code is colored by its language: type the language after
the backticks (` ```js `), or pick it at the top right of the code block while the caret is in it.
To leave a code block, press Enter three times at its end: the two empty lines go, and a new
paragraph starts under it. In Threads, where Enter sends, it's Shift+Enter three times.

**Web links.** Select some text, press ⌘⇧K (Ctrl+Shift+K on Windows and Linux), and type or
paste the address. Pasting an address over selected text links it too (the way to do it on a
phone), and an address you type becomes a link by itself. Clicking a link opens it in your browser. With
the caret in a link, a box under it shows the address, with ✎ to change it and × to remove the
link. ⌘K stays the command palette.

## Journals

Your journal, **Journal**, is there from the start. Its pages are kept in your personal space, so
only you can read them. You can keep other journals beside it, such as a work journal for your
standups. Named journals need Notes 0.1.4 or later.

### Making a journal

In the Journal view, click **New journal** under **Journals**, beside the month (on a phone, pick
**New journal…** in the journal menu at the top). Give it a name, and pick the group its pages
live in.

**The group decides who can read the pages.** Everyone in that group can read them, including
people who join it later. The form says so when you pick a group other than Personal, and its
button names the group ("Create in Axon"). Keep a private journal in Personal. A journal stays in
the group it's made in, since its pages are kept there; to use another group, make another
journal.

Your journals are yours: they're the same on all your devices, and other people in the group
don't get your journals in their list, although they can read the pages.

### Writing in a journal

Each journal keeps its own page for each day. Pick a journal under **Journals** (or in the menu
on a phone) to see its days. A journal kept in a group other than Personal shows that group's
events, finished tasks and plan under each page; Journal and the journals in Personal show every
group's.

**All journals** (once you have two) shows each day's pages one after another, each under its
journal's name. Today, and a day you pick in the month, show every journal's page so you can
write in any of them; other days show the pages with something written.

A journal's page is titled by its day. In Notes, a page from a journal other than Journal shows
the journal's name after the day ("Monday, November 16, 2026 · Work"), so two pages for one day
read apart.

### Renaming and archiving

Click a journal's pencil (on a phone, **Edit** in the journal menu) to rename it, or to
**Archive** it. An archived journal is listed apart and left out of All journals; its pages stay,
and you can still open it. **Restore** puts it back. Journal itself can't be renamed or archived.

### On each device

Each device remembers which journal it shows, so a work computer can open on your work journal.

A journal whose group doesn't have Notes on a device shows "Notes isn't installed in *group* on
this device" there, with nothing to type in, since what you typed couldn't be saved. On a device
with a Notes older than 0.1.4, the Journal view shows only Journal; your other journals show once
it updates.

## For agents and the CLI

Notes' tools work in the group the call is made in (`-c <groupId>` on the CLI; your personal
space by default). Every write goes through the tools.

```bash
peers tools run notes-search '{"query": "standup"}'                 # best match first
peers tools run notes-get '{"noteId": "<id>"}'
peers tools run notes-save '{"note": {"body": "Title\n\nText #tag"}}'          # a new note
peers tools run notes-save '{"note": {"noteId": "<id>", "body": "New text"}}'  # replaces its text
peers tools run notes-journal-page '{"date": "2026-11-16"}'         # Journal's page that day
```

`notes-save` takes a note's whole text, so read it first and send it back with your change.

**Journals.** The list of journals is kept in your personal space; each journal's pages live in
its group.

1. Find the journal and that day's page: `notes-journals` with a `date`, in your personal space.
   Each journal comes with its `groupId` and the day's `pageId`.
2. Read the page in the journal's group: `notes-get` with that `pageId`.
3. Write it there: `notes-save` with `noteId` set to the `pageId` and `journalDate` set to the day.

```bash
peers tools run notes-journals '{"date": "2026-11-16"}'
peers tools run notes-get '{"noteId": "<pageId>"}' -c <groupId>
peers tools run notes-save '{"note": {"noteId": "<pageId>", "journalDate": "2026-11-16", "body": "…"}}' -c <groupId>
```

Always write a journal's page by its `pageId`. `notes-journal-page` gives only Journal's page,
and a group whose Notes is older than 0.1.4 ignores a `journalId`, so a write that relied on one
would land in Journal's page. You can add `journalId` to `notes-save` as a check: Notes 0.1.4 and
later refuse a page that isn't that journal's.

`notes-journal-save` makes a journal (`name` and `groupId`) or renames one (`journalId` and
`name`), and `notes-journal-archive` archives or restores one; run both in your personal space.

## For packages that use Notes

Notes provides its contract (`00mwgr9ayx9ch2047pnqwfxoe`, version 1) in each group where it's
installed. Read the `Notes` and `Journals` tables through it, and write through its tools.

- **Journal's pages** have ids from `idFromKey("notes:journal:<date>")`, in your personal space.
  Another journal's are `idFromKey("notes:journal:<journalId>:<date>")`, in the journal's group, or
  take them from `notes-journals` with a `date`.
- **Groups on an older Notes.** Each group runs its own Notes version. One older than 0.1.4 has
  no journals: a call to its `Journals` table fails with "does not expose table 'Journals'", and
  its tools drop fields they don't know. Show Journal alone in that case, and write pages by id.
