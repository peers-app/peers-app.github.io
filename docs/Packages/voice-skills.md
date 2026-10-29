---
sidebar_position: 4
---

# Voice skills

A voice skill is a package that provides the Voice Skill contract. Voice Hub doesn't know the
package when it's built. It lists every provider of Voice Skill, and calls the tools of the
contracts each one **exposes**, on that provider, as the person speaking.

Voice Skill's contract id is `00muxgugn6xvs8f2r80ru205t`. Implement **version 2**. Version 1, with
its catalog and `invoke`, is [retired](#voice-skill-v1).

## Providing Voice Skill

Voice Hub declares Voice Skill in `voice-hub/src/contracts/voice-skill.ts` (`VoiceSkill`). Generate
your copy of the declaration, and implement it with your widget and the contracts you expose:

```bash
npx peers-package contract add ../voice-hub/src/contracts/voice-skill.ts#VoiceSkill
```

```ts
import { implementContract, observable } from "@peers-app/peers-sdk/define";
import { VoiceSkill, type VoiceSkillObservables } from "./contracts/voice-skill.v2";

export const NewsVoiceSkill = implementContract(VoiceSkill, {
  observables: {
    widget: observable<VoiceSkillObservables["widget"]>({
      peersUIId: newsWidgetId,
      iconClassName: "bi-newspaper",
      order: 40,
    }),
  },
  exposes: [News],
});

// In definePackage:
pkg.provides(News);
pkg.provides(NewsVoiceSkill);
```

- **`exposes`** lists contracts your package provides whose tools Voice Hub may call. Voice Skill
  itself has no tools. The rules are in
  [Exposing your contracts through a hub's contract](./declaring-a-package#exposing-your-contracts-through-a-hubs-contract).
- **`widget`** is your widget in Voice Hub, or `null` when you have none ([below](#contextual-widget)).
- **The `contract add` command** works next to Voice Hub's source, as in the Peers repository.
  Without it, generate the copy from a skill's `dist/package.bundle.js` (add
  `--contract 00muxgugn6xvs8f2r80ru205t@2`) or from a running Peers with a skill installed: see
  [Getting a declaration you don't have](./declaring-a-package#getting-a-declaration-you-dont-have).

Once a stable package release freezes Voice Skill v2, a provider with a different shape fails to
install. `exposes` isn't part of that shape: it's yours, and changes with your package's releases.

## What Voice Hub gives the model

Each contract you expose becomes one group of tools for Voice Hub's model:

- **Its name** goes in the prompt ("You can use these skills: News, Weather, Timer Controls") and
  before each of its tools' descriptions ("News: Return cached headlines…").
- **Its tools** are offered as `<slug>__<tool>`, where the slug is made from the contract's name:
  `news__headlines`, `timer-controls__set-timer`. When two groups would share a slug, the later
  one is numbered (`news-2`). The complete tool name must use only letters, digits, underscores,
  and hyphens and fit within 64 characters; tools outside those limits are omitted.
- **Each tool** gets its own `usageDescription`, and its input schema as the arguments' JSON Schema.
  Write them for a model: what the tool does, its units, and its defaults.
- **Only the tools the person speaking may run** are offered: a Reader isn't offered a Writer tool.
  The Runtime checks every call again.

A tool's output is what the model answers from, so return what a person would want said. Weather
exposes a `summary` tool that describes the forecast in the group's unit, and Timers' `list-timers`
gives each timer's time left in words as well as in milliseconds. Keep outputs small.

When a tool only changes something, Voice Hub confirms it with a tone and an emoji rather than
speech. When the person asked a question, Voice Hub's model answers from your tool's output. Failed calls use the failed tone, and Voice Hub keeps the error so the person can ask what
went wrong.

**Expose a small contract** when your main one has tools a voice model shouldn't reach. Timers
exposes Timer Controls (`set-timer`, `add-time`, `pause-timer`, `resume-timer`, `cancel-timers`,
`list-timers`), not its main contract, whose `fire-timer` is the scheduler's callback. The small
contract's tools work for the assistant and the CLI too.

## Contextual widget

`widget` holds:

```json
{
  "peersUIId": "<25-character UI id>",
  "title": "News",
  "iconClassName": "bi-newspaper",
  "order": 40
}
```

Everything but `peersUIId` is optional. `title` defaults to your package's name, the icon to a
generic one, and `order` to `100`. The card's description, shown when it's focused, comes from the
first exposed contract with a description, so write that description for the person using Voice
Hub as well as for developers. Lower `order` values appear first when attention and recency are
equal.
Omit `appNavs` when the package should appear only as a widget. Voice Hub subscribes to `widget`
while it's open, so changing it to another widget or to `null` updates the context picker.

Voice Hub renders the widget through `PeersUI` with these props:

```json
{
  "view": "summary",
  "active": false,
  "host": "voice-hub"
}
```

`view` is `summary` on Overview and `focus` when the user or a voice action selects the context.
`active` is true for the focused widget. `host` lets a reusable UI make small host-specific choices
without importing Voice Hub.

A summary should be quick to mount, compact, and useful from cached or local state. Keep freshness
in the provider rather than the view: Weather's provider books its next refresh through System
Scheduler after each one, and its widget only calls `refresh({ ifStale: true })` when it opens,
which the provider skips while the forecast is fresh. Don't start an unconditional network refresh
on every summary mount.

A focus view should provide the package's common touch actions with targets of at least 44 pixels,
and no keyboard-only or hover-only behavior. Voice Hub owns the card header and context selection;
the package owns all domain UI and writes.

After one of your tools succeeds, Voice Hub focuses your widget.

## Alert

Emit `alert` when a skill needs the user's attention now. Its payload is `kind`, `title`, and an
optional `detail`. Alerts work even when `widget` is `null`. When a widget is present, Voice Hub
focuses it, marks its context, and ranks it first on
Overview until the user opens it. When `detail` is set and voice output is on, Voice Hub speaks it
once, with no tone before it; without a `detail`, it plays the done tone. Alerts wait for an active
voice turn and for each other. Voice Hub doesn't branch on `kind`: keep package-specific wording in
`detail`.

Send it with the declaration's event:

```ts
import { voiceSkillAlert } from "./contracts/voice-skill.v2";

await voiceSkillAlert.emit({ kind: "timer-expired", title: "Tea", detail: "Your Tea timer is done." });
```

Timers waits to chime until Voice Hub finishes speaking the alert. This sound coordination
applies within one application window.

Use alerts sparingly, for time-sensitive state such as an expired timer, not for routine refreshes
or every successful call.

## Discovery

Voice Hub consumes Voice Skill v2 as optional and lists its providers with the Contract
Catalog's `listContractProviders`, which includes the contracts each one exposes, with the tools
the caller may run. A package that doesn't provide Voice Skill isn't a skill. Voice Hub's screen
finds skills when it opens; reopen it to see one installed while it was open.

News, Weather, Timers, and Groceries in `official-packages/`, and Tasks from its `peers-core`
package boundary, provide Voice Skill v2. Groceries exposes Grocery List and Tasks exposes Task
List: small contracts with the tools a person asks for by voice, which the assistant and the CLI
can use too.

Keep actions that Voice Hub shouldn't offer in a separate contract. Groceries and Tasks use
Groceries Screen and Tasks Screen for those actions, which Voice Skill doesn't expose. Their
widgets can still share exposed tools, such as Task List's `create-task`, when the same action
makes sense by voice and on screen.

## Who a call runs as

Voice Hub's calls to exposed tools run as the person speaking, in the active group, and never with
more than that person's own level: a Reader can read the news but can't refresh it, and a Writer
can do both. By default, an exposed tool's calls to other tools are capped at its own access level.
A tool declared with `authorityPropagation: "preserve"` passes through the caller's authority
instead; each target still checks its own required level. A call names your package as the provider
and runs only on it. Installing your package into a group is the trust decision: there's no separate
grant.

## Turn cancellation

Voice Hub checks for cancellation before each model request and each skill call. A skill call
already running may finish, but no later call in that turn starts. Cancellation doesn't roll back
package changes, so keep a tool's changes atomic where it matters.

Spoken listening cancellation happens earlier: a whole utterance of “never mind”, “nevermind”,
“cancel listening”, or “stop listening” is checked after endpointing and transcription, before the
model or any skill. A leading or trailing “please” and the configured wake phrase are supported,
including “please Sterling, never mind” and “Sterling, please stop listening”. Matching ignores
case, punctuation, and extra whitespace; underscores in the wake model name are treated as spaces.
It ends the current recording and any manual conversation without a history entry. It can't
interrupt processing or playback, or undo a skill call. Bare “stop” and “cancel”, “go back to
sleep”, timer commands, and longer requests such as “cancel my timer”, “add never mind to my list”,
or “stop listening now” still reach the model. See [Voice Hub](../voice-hub#use-voice-input) for
the Cancel button for active turns.

## Voice Skill v1

Retired: nothing provides or reads it, and the Runtime no longer supports its action aliases
(`pkg.actionAliases`). Version 1 had a catalog observable and an `invoke` tool that routed to the
skill's own tools. A skill on v1 should move to v2 and expose its contracts. A package whose
manifest still lists action aliases is refused at install and at load ("manifest.actionAliases
is not supported"); move it to v2 and rebuild it.

Host-backed packages must also replace calls to `context.dispatchAction`: those calls no longer
work, including calls from the package's own screens or other tools. Provide context-bound tools
on the appropriate contracts and move callers to them; changing the voice declaration alone
doesn't migrate those callers. See [context-bound tool providers](./contracts#context-bound-tool-providers).
