---
sidebar_position: 3
title: Editable grids and lookups
---

# Editable grids and lookups

`DataGrid` and `Autocomplete` in `@peers-app/peers-ui` provide Bootstrap controls for spreadsheet-style package screens. They use Peers observables through `useObservable` and also accept plain React values. They do not depend on Knockout, a particular table schema, or an ORM.

These APIs are currently in the JobTrak grid development branch, **not the published 0.28.3 release**. Until the host includes them, the JobTrak development build bundles the compiled `@peers-app/peers-ui/dist/components/data-grid` entry from the matching worktree. Keep React and the SDK external. Once the host ships these exports, use the normal root import provided by the host.

## Editable rows

```tsx
import { observable } from "@peers-app/peers-sdk";
import { DataGrid, type DataGridColumn } from "@peers-app/peers-ui";
import { useState } from "react";

type Draft = { id: string; name: string; quantity: string };
const columns: DataGridColumn<Draft>[] = [
  { id: "name", label: "Name", editable: true, getValue: row => row.name },
  {
    id: "quantity", label: "Quantity", type: "number", editable: true,
    getValue: row => row.quantity, minWidth: 100,
  },
];

function Lines() {
  // Each mounted screen owns its drafts; do not share them across groups.
  const [rows] = useState(() => observable<Draft[]>([]));
  return <DataGrid
    label="Lines" rows={rows} columns={columns} rowKey={row => row.id}
    rowLabel={row => row.name || "New line"}
    onCellChange={(row, columnId, value) => rows(rows().map(current =>
      current.id === row.id ? { ...current, [columnId]: value } : current
    ))}
  />;
}
```

`rows`, `sort`, and column `options` accept plain values or read-only Peers observables. A read-only observable remains read-only: components report edits through `onCellChange` and `onSortChange`. Keep row keys stable and replace changed arrays/objects so observable subscriptions can notify.

Columns can use text, number, date, boolean, or select editors. Omit `editable` for a calculated value or a custom `renderCell` (for example, an open-record button). `editable(row)` can make individual rows read-only. Select choices use `{ value, label }`: store the stable ID and show its label. Missing selections display `Unavailable (id)` rather than silently clearing the relationship. `width` and `minWidth` set column geometry, including cell padding; editors fit the available content area instead of repeating the column minimum width. The table scrolls horizontally when those columns exceed the available space. `footer(rows)` supplies optional totals.

### Keyboard and sorting

- Up/Down move within a column, skipping cells without an enabled editor or action.
- Left/Right move at the text boundary or when all text is selected; ordinary caret movement still works inside text.
- Enter moves to the next row's first editable cell. On the last row it can focus the optional add-row button. Action buttons keep their normal Enter behavior.
- Tab/Shift+Tab keep native focus traversal. Modified keys and IME composition are left alone.
- Click a heading to cycle ascending, descending, and unsorted. Shift-click adds another sort column. Sorting copies the source array and holds row order while focus is inside the table, so typing cannot move the row underneath the user.
- `onAddRow` lets the owner append a row; the grid focuses its first editor when it appears.

Number editors deliberately emit strings, including incomplete drafts such as `-`. Validate and convert at the save boundary. The grid does **not** automatically persist data, confirm destructive actions, protect drafts during navigation, or detect revision conflicts. The package owns those decisions and invokes its contract tools to save. `getRowError` displays an error alongside a retained row. `disabled` disables built-in editors and adding; disable any custom action buttons in `renderCell` yourself.

JobTrak stages edits across rows in an observable and exposes Save Changes and Discard changes. It captures the record revision and relevant plan revision at the first edit. A failed batch removes only successfully saved drafts; retries retain failures and do not resubmit successes. Dirty rows stay visible through search and local filters. This is a package policy, not a global grid persistence policy.

## Searchable relationships

```tsx
<Autocomplete
  label="Job" value={selectedJob} options={jobs}
  getOptionKey={job => job.jobId}
  getOptionLabel={job => job.name}
  onChange={job => selectedJob(job)}
  placeholder="Find a job"
/>
```

`value` and `options` accept observables or plain values. The example uses a writable local `selectedJob` observable; for a controlled value, pass a callback that stages the change instead. Use `required` for mandatory relationships and `clearable` to explicitly choose whether clearing is offered.

Typing filters labels case-insensitively. Down opens the list; while open, Up/Down highlight choices, Enter selects a choice, and Tab selects a highlighted choice and continues focus traversal. Escape restores the existing selection. Uncommitted text is also discarded on blur. A closed lookup lets Up return to the grid. Results use an accessible combobox/listbox and a portal so scrolling containers cannot clip the popup.

For remote search, supply `loadOptions(query, signal)`. Requests are debounced (150 ms by default), aborted when replaced, and ignored if they finish after a newer query. Loading, no-results, and error states are visible; failed requests never silently clear the current selection. There is no shared result cache. Keep the loader stable and scoped to the active group, and key/remount a lookup when switching groups. `minLength` controls when searches begin and `maxResults` caps displayed choices (100 by default); typing narrows the choices.

Use the host's Bootstrap stylesheet and `data-bs-theme` for light/dark mode. The controls inherit the standard backgrounds, borders, primary color, and focus treatment.

Clear and dropdown actions sit inside the input’s single outline, using muted theme colors and a subtle divider. Their accessible labels, pointer targets, focus behavior, and keyboard handling remain the same.
