---
sidebar_position: 4
---

# Voice skills

A voice skill is a package that provides the Voice Skill contract. Voice Hub does not know the package at build time. It lists every provider, reads each `skill` catalog, and calls `invoke`.

The contract id is `00muxgugn6xvs8f2r80ru205t`, version 1. Official packages share `official-packages/voice-skill-contract.mjs` so the public shape stays identical. The first installed provider freezes that shape. A later provider with a different public shape fails to install.

## Catalog

`skill` is a read-only observable backed by a device persistent variable. Reading it does not start the package worker. Put the catalog in `persistentVar.defaultValue`:

```json
{
  "name": "Timers",
  "slug": "timers",
  "description": "Active countdowns and timer controls.",
  "tools": [
    {
      "name": "set_timer",
      "description": "Start a countdown.",
      "parameters": {
        "type": "object",
        "properties": { "seconds": { "type": "number" } },
        "required": ["seconds"]
      }
    }
  ],
  "widget": {
    "peersUIId": "<25-character UI id>",
    "title": "Timers",
    "iconClassName": "bi-alarm",
    "order": 10
  }
}
```

`slug` is a short lowercase identifier. Voice Hub prefixes model tool names with it so two skills can both have a tool called `list`. `widget` is optional. When present, Voice Hub renders `peersUIId` through `PeersUI`. Omit `appNavs` when the package should appear only as a widget.

`description`, `iconClassName`, and `order` are optional presentation hints inside the existing
object-valued catalog; they do not change the frozen Voice Skill v1 contract shape. Lower `order`
values appear first when attention and recency are equal. Voice Hub otherwise falls back to the
provider name, a generic icon, and order `100`.

`parameters` is a JSON Schema object. Voice Hub sends it to the model as the tool's parameters.

## Contextual widget

Voice Hub calls a contributed widget with these props:

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

A summary should be quick to mount, compact, and useful from cached/local state. Do not start an
unconditional network refresh merely because an inactive summary mounted. A focus view should
provide the package's common touch actions with at least 44-pixel targets and no keyboard-only or
hover-only behavior. Voice Hub owns the card header and context selection; the package owns all
domain UI and writes.

## Invoke

`invoke` takes `{ tool, args }` and returns `{ result, speech? }`. `result` is JSON the model can read. `speech`, when set, is suggested wording returned to the model alongside `result`. It does not end the turn: the model can use a lookup result to perform a subsequent action before replying. The tool's suggested access level is Writer. The call runs as the person who spoke.

Map `tool` onto the package's own contract tools. Do not trust a tool name that is not in the catalog.

After `invoke` succeeds, Voice Hub records the provider package, skill slug, and tool name as
private runtime activity and focuses that skill's widget. Failed calls do not report successful
activity. This does not add fields to the public Voice Skill response.

## Alert

Emit `alert` when a skill needs immediate user attention. Payload fields are `kind`, `title`, and
optional `detail`. Voice Hub focuses the provider's widget, marks its context, and ranks it first on
Overview until the user opens it. Alerts are generic; Voice Hub does not interpret package-specific
payloads.

Use alerts sparingly for time-sensitive state such as an expired timer. Do not emit one for routine
data refreshes or every successful voice invocation.

## Discovery

Voice Hub consumes Voice Skill as optional, then calls `listContractProviders` and reads `skill` on each provider with `providerPackageId`. A package that does not provide the contract is not a skill.

Catalog observables stay subscribed while Voice Hub is open, so changing or removing widget
metadata updates the context picker without hard-coded package checks.

Timers, Groceries, Weather, and News in `official-packages/` provide this contract. Tasks currently
provides it from its `peers-core` package boundary so the contribution can move with Tasks when
that app is extracted. Weather omits `appNavs`, so it appears as a widget and voice skill without an
Apps-list entry.

## Turn cancellation

Voice Hub checks cancellation before each model request and skill invocation. A skill already
running may finish, but no subsequent skill in that turn is started. Cancellation does not roll
back package changes. Keep mutations atomic within the skill where appropriate.
