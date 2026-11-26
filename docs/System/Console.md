---
sidebar_position: 1
---

# Console

The Console is a JavaScript prompt inside Peers. Every [contract](../Packages/contracts.md) in
a group is a global there, named for the contract: `Tasks`, `TaskList`, `SystemPackages`.
Through it you read and write a contract's tables, run its tools, and read its vars
(observables) and events. Your calls run as you, at your own level in the group, the same as
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
Tasks.tables.Tasks                                 // a table's fields, and its methods with the level each needs
const open = Tasks.tables.Tasks.list({ status: "Queued" }, { pageSize: 5 })
open[0].title
TaskList.tools.findTasks({ words: "car insurance" })
Tasks.tools.describeTask(open[0].taskId)           // values fill a tool's arguments in order
Tasks.tables.Tasks.get(open[0].taskId); Tasks.tools.describeTask($)   // $ is the last result
const changes = Tasks.tables.Tasks.dataChanged.subscribe()   // show each change
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
  What `print(…)` or `console.log(…)` shows sits with the entry that printed it.
- **A name that isn't there** says where it is: `tasks` points you to `Tasks`, and `findTasks`
  to `TaskList.tools.findTasks`.
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
  (`Tasks.tools.` lists the tools, each with how it's called); inside a tool's object argument,
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
