---
sidebar_position: 3.5
title: UI contracts
---

# UI contracts

A **UI contract** lets one package's screen show part of another package's UI: a label picker in a
task row, a task's details in a side panel, a meeting's comments on a note. The screen depends on
the UI contract, not on the package that draws it, so any package that provides the contract can
draw it, and the screen gets a fallback when none does.

UI contracts are the second kind of contract. A [package contract](./contracts) is an API: tables,
tools, observables and events. A UI contract holds only **pieces**, the parts of a UI it offers,
and nothing else. Keeping the two apart means:

- **Another package can provide the UI** without reimplementing the API behind it. A richer label
  picker provides the same UI contract and reads labels through the Labels contract.
- **UIs version on their own.** Adding a view or a prop makes a new version of the UI contract only;
  the API behind it doesn't change.
- **UI code stays in the UI bundle.** A UI contract's pieces are implemented in your package's UI
  bundle (`src/uis.ts`), never in its provider bundle (`src/package.ts`). Showing a piece never
  starts your package's worker, and a package can provide UI contracts with no worker at all.

You need a version of Peers that supports UI contracts. Older versions refuse a package that
provides or consumes one.

## Pieces

A piece is one of two kinds:

| Kind | Where it goes |
|---|---|
| `view` | Fills a box in the embedding screen's layout: a details view, a month wall, a panel. |
| `popover` | Floats from an anchor above everything until it's done: a picker. |

A UI contract usually has one piece, so another package can replace that piece alone. Give a
piece:

- **props**: what the embedding screen passes in. They're plain data: ids, options and short text.
  Pass ids, not records; the piece reads its own data and follows its changes.
- **emits**: what the piece sends back to the screen that embedded it, such as the label a picker
  chose. Each goes to that screen only.

Every piece can also send `open` (`{ kind, id, groupId? }`) when someone clicks a link or mention
in it, and a popover can `close`.

A piece can embed other pieces, as a task's details can show a label picker, up to four deep. A
piece can't embed itself.

Chips (a record shown inline) aren't pieces. Peers draws them from your table's
[mention source](./mentions), which can set a `color`.

## Declaring a UI contract

Declare it in a file `src/package.ts` can import, with `declareUIContract` and `declarePiece` from
`@peers-app/peers-sdk/define`. The declaration is plain data: it holds no UI code.

```ts
// src/ui-contracts.ts
import { declarePiece, declareUIContract, defineEvent, z } from "@peers-app/peers-sdk/define";

export const LabelPickerUI = declareUIContract({
  contractId: "<from newid()>",
  version: 1,
  name: "Label Picker",
  description: "Choose labels for an item, or one label to filter by.",
  pieces: [
    declarePiece({
      name: "picker",
      kind: "popover",
      description: "Choose labels. With an item, it puts labels on it and takes them off.",
      propsSchema: z.object({
        item: z.object({ kind: z.string(), id: z.string(), groupId: z.string() }).optional(),
        allowCreate: z.boolean().optional(),
      }),
      emits: [
        defineEvent({
          name: "chosen",
          description: "A label was chosen, when there's no item.",
          payloadSchema: z.object({ labelId: z.string(), name: z.string() }),
        }),
      ],
    }),
  ],
});
```

Anything a piece does must also be possible through your API contract's tools, so the CLI and
agents can do it too. The picker above labels an item with the same tool an agent would call.

## Providing one

List the UI contract in `src/package.ts`, as you would an API contract:

```ts
pkg.provides(LabelPickerUI);
```

Then implement each piece in your UI bundle with `implementPiece` from `@peers-app/peers-ui`, and
pass it to `exportUIs`:

```tsx
// src/ui/picker.tsx
import { implementPiece, type PieceComponentProps } from "@peers-app/peers-ui";
import type { LabelPickerUI } from "../ui-contracts"; // types only

function LabelPicker({ props, emit, close, groupId }: PieceComponentProps<typeof LabelPickerUI, "picker">) {
  // Read and change labels through your own API contract, then:
  emit.chosen({ labelId, name });
  close();
}

export const PickerPiece = implementPiece<typeof LabelPickerUI, "picker">(
  labelPickerUIId,
  1,
  "picker",
  LabelPicker,
);
```

```ts
// src/uis.ts
exportUIs({ uis: [LabelsScreenUI], pieces: [PickerPiece] });
```

- Import the declaration **as a type only** in UI code, so its code stays out of the UI bundle.
- Your own screens can render the same component directly, so there's one copy.
- A piece needs no route.
- `peers-package build` fails if `src/package.ts`, or anything it imports, pulls in React, React
  DOM or peers-ui. Keep components in files only `src/uis.ts` imports.
- Your UI bundle may run more than once in a session: once for your screens, and again for a
  piece embedded from a group that runs another version of your package. Keep what its modules do
  when they load (registering, subscribing) safe to repeat.

## Embedding one

Consume the UI contract in `src/package.ts`. Most screens work without it, so mark it optional:

```ts
pkg.consumes(LabelPickerUI, { optional: true });
```

If you don't have the declaration, generate one, as for any contract: `peers contracts add
<contractId>@<version>` or `peers-package contract add <source>` ([Getting a declaration you don't
have](./declaring-a-package#getting-a-declaration-you-dont-have)).

In a screen, make a client with `hostUIContract`, naming the group the piece's data belongs to,
and render `<Piece>`:

```tsx
import { hostUIContract, Piece, usePiece } from "@peers-app/peers-ui";
import type { LabelPickerUI } from "../contracts/label-picker.v1"; // types only

function AddLabel({ task }: { task: ITask }) {
  const labelPicker = useMemo(
    () =>
      hostUIContract<typeof LabelPickerUI>(labelPickerUIId, 1, { dataContextId: task.groupId }),
    [task.groupId],
  );
  const [open, setOpen] = useState(false);
  const [plus, setPlus] = useState<HTMLButtonElement | null>(null);
  if (usePiece(labelPicker.pieces.picker).status === "unavailable") return null;
  return (
    <>
      <button type="button" ref={setPlus} onClick={() => setOpen(true)}>+</button>
      <Piece
        of={labelPicker.pieces.picker}
        props={{ item: { kind: "task", id: task.taskId, groupId: task.groupId } }}
        anchor={plus}
        open={open}
        onClose={() => setOpen(false)}
        label="Labels"
      />
    </>
  );
}
```

A view is simpler: no anchor, and it fills the box you lay out.

```tsx
<Piece
  of={taskDetails.pieces.details}
  props={{ taskId }}
  on={{ moved: ({ groupId }) => follow(groupId), open: openBeside }}
  label="Task details"
  fallback={() => <TitleAndOpenInTasks taskId={taskId} />}
/>
```

What to expect:

- **Props and handlers are typed** from the declaration, and checked when your screen compiles.
- **The group** is the client's. The piece shows that group's data, drawn by the version of its
  provider your device runs there, which can differ from another group's.
- **The provider** is the group's active provider of the UI contract. A hub that shows every
  provider's piece names one with `providerPackageId`.
- **Nothing loads until it's needed.** Making a client loads nothing. A view loads its provider's
  UI the first time it shows; a popover, the first time it opens. `usePiece` says whether a piece
  is available without loading its UI.
- **Name the group by its id,** and make the client once per group, as above. A `dataContextId`
  function, or none (the active group), is read again each time your screen renders, so the
  piece follows it.
- **Props are checked.** A function, a React element or another non-data value is refused, and
  so are props that don't fit the declaration, nested fields and allowed values included. The
  fallback shows why.
- **Emits are checked.** An emit whose payload doesn't fit its declaration doesn't reach your
  handler, and neither does one your version of the UI contract doesn't declare.
- **`open`:** your handler gets the record. Return `false` (or pass no handler) and Peers opens
  it as a mention.

## When a piece can't show

`fallback` gets the reason, and a sentence saying what's wrong:

| Reason | Means |
|---|---|
| `missing` | Nothing in the group provides the UI contract. |
| `older` | The group's provider has the UI contract, but not this version. |
| `not-running` | The provider is installed but doesn't run on this device: it waits for a contract it requires, isn't approved here, is turned off, or can't run on this host. |
| `failed` | Its UI didn't load, registered no component for the piece, or threw while drawing; or it's drawn inside itself, or more than four pieces deep. `failed` comes with `retry`. |

A popover's fallback shows in the popover, at its anchor. Without `fallback`, a view shows one
short line, and a popover shows nothing and calls `onClose`, so your screen's open state resets. A view shows your `loading` (or a quiet
placeholder) while it loads.

Most UI contracts are consumed optionally, so `missing` is a normal case: the fallback for a
comments panel can be nothing at all.

## Sizing, theme and keyboard

- A view fills its box (`height="fill"`, the default) and scrolls inside it, or takes its own
  height with `height="content"`.
- A piece adapts to its box, not the window: `usePieceSize()` gives the box's size.
- Light and dark themes, Bootstrap variables and icons come from Peers. An embedding screen can't
  restyle a piece; a piece's options, such as a compact layout, are props. Keep a piece's CSS under
  its own class names, since styles are shared until screens are isolated.
- A popover takes focus when it opens and keeps Tab inside it. Escape or a click outside closes
  it, and focus goes back to its anchor.

## What a piece can reach

A piece acts as its provider's UI, never as the screen that embeds it: it reads and writes through
the contracts its own package provides and consumes. The embedding screen passes data in and gets
the declared emits back; neither reads the other's state, DOM or package variables. Write pieces
this way now: once screens are isolated, each piece runs in its own frame, and pieces written to
these rules keep working unchanged.

## Versions

A UI contract versions like any contract ([Contract lifecycle and
promotion](./contracts#contract-lifecycle-and-promotion)):

- While your package is in development or beta, change a UI contract in place. Keep additions
  optional, so existing screens keep working.
- A stable release freezes every UI contract version it provides, with the package's other
  contracts, in `frozen-contracts.json`.
- To change a frozen version, declare a new one that `alsoImplements` the old one. A newer piece
  serves an older version's screens when it takes every prop the older one does (new props are
  optional), keeps the same kind, and still sends the older version's emits.

## Testing

`mockPiece` from `@peers-app/peers-ui` stands in for a piece in your screen's tests: `<Piece>`
draws a placeholder (`data-testid="mock-piece-<name>"`), and the test reads the props it got and
sends its emits.

```tsx
const picker = mockPiece(labelPicker.pieces.picker, { kind: "popover", emits: ["chosen"] });
render(<TaskRow task={task} />);
fireEvent.click(screen.getByText("+"));
act(() => picker.emit("chosen", { labelId: "l1", name: "work" }));
expect(filterLabel()).toBe("l1");
picker.restore();
```

## Related topics

- [Package contracts](./contracts)
- [Declaring a package](./declaring-a-package)
- [Routes and UI](./routes-and-ui)
- [Mentions](./mentions)
