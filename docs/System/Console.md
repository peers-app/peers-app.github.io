---
sidebar_position: 1
---

# Console

The Console is a JavaScript prompt inside Peers. Every [contract](../Packages/contracts.md) in
a group is a global there, named for the contract: `Tasks`, `TaskList`, `SystemPackages`. Its
tables, tools, vars (observables) and events are on it by camelCase name: `Tasks.tasks`,
`Tasks.describeTask`. Through them you read and write tables, run tools, and read vars and
events. Your calls run as you, at your own level in the group, the same as
your screens' calls.

It's the same prompt as [`peers repl`](CLI.md#repl): the same names, helpers and hints, with
completion and argument hints as you type.

## Opening it

Open the **Console** app from **System apps** on the Apps screen. It fills its tab like any
other app, whatever layout you use.

In the **Tabs + Console** layout ([Choosing a layout](Choosing-a-Layout.md)), the Console is also
a panel beside your tabs: pick that layout with **Use Tabs + Console Layout** in the command
palette (Cmd/Ctrl+K), then show or hide the panel with **Ctrl+\`**. The app and the panel are the
same Console, with the same output, variables, group and unfinished line.

The header shows the group your calls run in and a button that clears the output. The panel's
header also has buttons to dock, maximize and collapse the panel.

## At the prompt

```js
contracts("task")                                  // the contracts with "task" in them
Tasks                                              // what Tasks has: tables, tools, vars, events
Tasks.tasks                                        // a table's fields, and its methods with the level each needs
const open = Tasks.tasks.list({ status: "Queued" }, { pageSize: 5 })
open[0].title
Tasks.tasks.list(null, { sortBy: ["-createdAt"], pageSize: 10 })   // newest first
TaskList.findTasks({ words: "car insurance" })
Tasks.describeTask(open[0].taskId)                 // values fill a tool's arguments in order
Tasks.tasks.get(open[0].taskId); Tasks.describeTask($)   // $ is the last result
const changes = Tasks.tasks.dataChanged.subscribe()      // show each change
changes.unsubscribe()                              // stop showing them
use("Home")                                        // move to a group; use() goes back to Personal
help()                                             // everything else
```

- **Every call you type is awaited for you,** so `open` above holds the rows, not a promise.
  Inside a function you write, use `await` yourself.
- **Your variables stay** from one entry to the next, including ones made with `const`. Making
  one again gives it the new value.
- **Results:** rows show as a table (switch to **tree** to open each row), other objects and
  arrays as a tree you open a level at a time, and a contract, table or tool as what it has.
  In the tree, multiline text keeps its line breaks under its key. An entry shows its result as
  it was when it ran, so changing `t` on a later line doesn't change what an earlier entry shows;
  a contract, a tool or another object that isn't only data shows as it is now.
  What `print(…)` or `console.log(…)` shows sits with the entry that printed it.
- **A name that isn't there** says where it is: `tasks` points you to `Tasks` and `Tasks.tasks`,
  and `findTasks` to `TaskList.findTasks`. The [`peers repl` section](CLI.md#repl) says which
  member names are only in `Tasks.tables`, `Tasks.tools`, `Tasks.vars` or `Tasks.events`.
- **A refused write** lists what's wrong, one issue per line: `status: Invalid enum value. …`.
- **A call the table or tool would misread is refused,** as at `peers repl`: an option `list`
  doesn't take (`skip`), a `sortBy` that isn't a list of fields, or a misspelled field.
- **When a package starts, stops or changes version and the group serves a different set of
  contracts,** the Console reloads them and shows "The packages here changed." The reload ends
  the subscriptions you started: subscribe again. If you saved a table or tool in a variable
  before the reload, get it from its global again.
- **Writes are real.** `save` and `delete` change your data, and the providing package's rules
  apply as they do in its screens. Try writes in a throwaway group.

The [`peers repl` section](CLI.md#repl) says more about names, versions, and how a tool takes
its arguments.

## Typing

- **Enter** runs what you typed. While a bracket is still open, Enter starts a new line instead;
  **Shift+Enter** always does.
- **Completion** shows as you type: after a dot, the members of what's before it
  (`Tasks.` lists its tables, tools, vars and events, each with what it is or how it's called);
  inside a tool's object argument,
  the arguments you haven't written yet. **Tab** takes the highlighted one, **↑** and **↓**
  move through the list, and **Escape** closes it.
- **The grey line above the input** shows the call your cursor is in, with the argument your
  next value fills in bold, and that argument's type and description:
  `describeTask(taskId, subtaskDepth?, includeComments?, commentLimit?)`.
- **↑** and **↓** on the first or last line go through what you ran before, on this device.
- **Ctrl+L** or `clear()` clears the output. **Ctrl+C** with nothing selected empties the input.
- An entry that's still waiting shows **stop waiting**, which lets the next entry run. Its calls
  may still finish. An entry stopped before its turn doesn't run at all.

## What the code can reach

Code at the Console sees the contracts, the helpers, your own variables and the standard
JavaScript globals (`Math`, `JSON`, `Date`, `fetch`, `setTimeout`, …). It doesn't see the app's
page (`window` and `document` aren't defined there, and `this` is the Console's own names), and a
name you assign stays in the Console.
It still runs with your full authority, the same as anything you do in Peers.

`typeof` a name that doesn't exist throws, rather than giving `"undefined"`. To check whether
you've made a variable, write `"rows" in this`.
