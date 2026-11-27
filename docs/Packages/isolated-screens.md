---
sidebar_position: 3.6
title: Isolated screens
---

# Isolated screens

Each package's screens run in a sandboxed frame of their own, apart from the Peers window and from
every other package. Your screen can't read another app's page, state, storage or variables, and
no other app can read yours. Your UI bundle doesn't change: it gets `React`, the SDK, peers-ui and
`zod` from its frame exactly as it got them from the window, and its components render the same
way.

What a screen reaches, and how, is what this page is about.

## What your screen reaches

- **The contracts your package declares.** A screen's `hostContract` calls act as your package:
  they reach the contracts it provides and the contracts it consumes (`pkg.consumes(...)`, API and
  UI), at the user's role in each group. A call to anything else is refused with `Permission
  denied: package … doesn't consume …`. Declare every contract your screens use, including system
  contracts such as System HTTP or System Files when you call them yourself.
- **What Peers' own components use.** Mention chips and the editor's mention picker, group colors
  and icons, pieces, and `useFileUrl` work in every screen without declaring anything. Without a
  declaration, a screen can only read through those contracts (System Mentions, System Groups,
  System Contract Catalog and System Files). To save a file from a screen, declare System Files
  (`pkg.consumes(SystemFiles)`). Otherwise the save is refused with `Permission denied: 'startSave'
  needs Writer (40): package … doesn't consume …, so its screens can only read it`. A group's
  color and icon are set only in Peers, never by a package.
- **Contracts that refuse packages refuse your screens too.** System Packages, App Updates and the
  other admin contracts aren't for packages; the Packages screen and the CLI use them.
- **The tables Peers shares with screens, read only.** `Groups`, `GroupMembers`, `Users`,
  `Devices`, `Packages` and `PackageVersions` can still be read from a screen, and your own
  package's tables read and written. Other legacy calls, such as `dbQuery` or writes to those
  tables, are refused. Prefer contracts: these reads will move to them.

## Variables and storage

- **Persistent variables** you declare in a screen (`deviceVar`, `userVar`, `groupVar` and the
  rest) are your package's own: they're stored under your package's id, the same variables your
  worker gets when it declares one with the same name. A screen can read, but not change, the few
  Peers keeps for every screen: this device's id, the active group, and the theme. Secret
  variables aren't available to screens; keep secrets in your provider code.
- **`localStorage`** works as usual and is your package's own. Two tabs of your app don't see each
  other's changes until one of them is opened again. `sessionStorage` lasts as long as the screen.
- There are no cookies and no IndexedDB in a screen.

## Navigation, links and the keyboard

- `mainContentPath`, `goToTabPath`, `updateActiveTabTitle` and `closeCurrentTab` from
  `@peers-app/peers-ui` work as before: they act on your screen's own tab.
- `openLink(url)` and `openMention(...)` work as before. A plain link to the web (`<a href="https://…">`)
  opens in the browser, and a `#path` link navigates your tab.
- Your own keyboard shortcuts work while your screen has focus. A ⌘ or Ctrl key your screen doesn't
  handle (it doesn't call `preventDefault`) goes on to Peers, so ⌘K and the other app shortcuts work
  from inside your screen. Call `preventDefault` for a shortcut you take over.
- `alert`, `confirm`, file inputs, downloads and the clipboard work.

## What a screen can't do

- Reach `window.parent`, the Peers window's DOM, or another app's.
- Make requests of its own: `fetch`, `XMLHttpRequest` and `WebSocket` to the network are blocked.
  Call System HTTP from your provider code instead. Images and media from the web still load.
- Load scripts, styles or fonts from URLs. Bundle what your screen needs into your UI bundle.
- Embed frames of its own.
- Draw over other apps. `registerGlobalOverlay` from a screen draws only inside your own screen
  for now.

## Styles

Your stylesheets apply only inside your own frame, so they can't restyle another app, and another
app's can't restyle yours. Peers' theme (light or dark), Bootstrap and its icons are in every
frame. Keep prefixing your class names anyway: a few packages still run in the Peers window
(below), and so do Peers' own screens.

Your screen fills its tab. Peers draws the tab's padding inside your frame, as before, so rules
that cancel it (`.p-3 > .my-app`) still line up.

## Pieces

A [UI contract's piece](./ui-contracts) runs in a frame of its own too, acting as its provider.
When your screen embeds one, Peers draws the provider's frame over the piece's box in your screen
and hands its emits back to your `<Piece>`. Nothing changes in how you embed or implement a piece.

## Packages that still run in the Peers window

Tasks, Operator, Voice Hub and Family Hub still run in the Peers window, for things isolated
screens can't do for them yet (an overlay over every app, the microphone, other apps' widgets by
id). Every other package, yours included, runs isolated.

## Testing

Nothing about isolation needs a different test. `mockHostContract` and `mockPiece` stand in for
Peers in unit tests as before. To try your screen in Peers, open it: it's isolated already.
`peers ui inspect` and `peers ui click` reach inside screens; an element in a screen's frame has a
selector that starts with `peers-frame:<frameId> >>> `.

## Related topics

- [Routes and UI](./routes-and-ui)
- [UI contracts](./ui-contracts)
- [Contracts](./contracts)
- [Declaring a package](./declaring-a-package)
