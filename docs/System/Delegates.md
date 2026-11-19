---
sidebar_position: 7
---

# System Delegates

A **delegate grant** lets one package act for you in one group, up to a level you choose. With
it, the package can use the tools your other apps provide, such as Tasks, Calendar and Notes, as
you. It goes through the [System Tool Catalog](./Tools.md#system-tool-catalog), the same way
`peers tools run` does.

Only you turn a grant on or off. A package can ask for one, but it can't give itself one.

## What a grant lets a package do

- **Run the tools installed packages provide in that group, as you.** The tools see the call as
  yours: a task the package creates is "created by" you.
- **Up to the grant's level:** Read only (Reader), Read and write (Writer), or Admin. A tool that
  needs more than that is refused. No grant goes above your own role in the group.
- **Not Peers' own tools.** A grant doesn't reach Peers' own tools, such as signing in, pairing
  devices, installing packages, folders, files and notifications, and it changes nothing about
  them. A package uses the system contracts open to packages, such as System Files, System
  Notifications and System Scheduler, as itself, by consuming them. The ones only you may use,
  such as signing in, pairing devices and installing packages, refuse it with or without a grant.
- **Only in work you started on this device.** That covers a call you made from the package's
  screen, and a schedule the package made during such a call. These are refused:
  - the package's own background work;
  - a call another member's device made into it;
  - work that started on another of your devices;
  - the package's code that runs for a subscription, even one made during your call: its
    handler for an event or change, and its code serving another app's subscription. Whatever
    fires it later isn't you.
- **One group, one device.** A grant covers one group (or Personal) on one device. A grant on
  your laptop doesn't apply on your phone, and a grant in Personal doesn't apply in Home.
- **From the next call.** A change, or turning it off, applies from the package's next call.

## Turning it on

Each package that asks gets an **Acts for you** setting:

| Choice | The package may |
|---|---|
| Off | Use only what it could use before: its own data, and the contracts it consumes as itself |
| Read only | Run tools that need Reader |
| Read and write | Run tools that need Writer or less |
| Admin | Run tools that need Admin or less, for an hour, until tomorrow (midnight), or always |

Admin for a while goes back to the grant's own level when it ends: Read and write, unless you'd
chosen another. The setting says when, for example "Admin until 3:40 PM, then Read and write",
and you can end it early.

You'll find the setting in three places, all showing the same control:

1. **The package's page** in Packages, on its Info tab, for the group the Packages screen shows.
2. **After you install it** from this device, if it asks. Peers offers the setting once. A
   package that reaches the device another way, such as by sync, isn't offered there; it can
   ask when you use it.
3. **When the package asks**, for example from a button on its own screen. Peers opens the
   dialog, and only your choice changes the setting.

From the CLI:

```bash
peers delegates                                   # Packages that act for you in Personal, on this device
peers delegates grant Operator --level writer     # Read and write
peers delegates grant Operator --level admin --for 1h -c <groupId>
peers delegates revoke Operator
peers delegates --device <deviceId>               # Another of your devices (it trusts you as Self)
```

## For package authors

### Asking for a grant

Declare the request, and consume the catalog and System Delegates:

```ts
import {
  AccessLevel,
  definePackage,
  SystemDelegates,
  SystemToolCatalog,
} from "@peers-app/peers-sdk/define";

export default definePackage((pkg) => {
  pkg.packageId = packageId;
  pkg.version = version;
  pkg.consumes(SystemToolCatalog);
  pkg.consumes(SystemDelegates);
  pkg.requestsDelegate({
    level: AccessLevel.Writer,
    why: "So Operator can file and update your tasks, notes and events for you.",
  });
});
```

- `level` is Reader, Writer or Admin: the most the package needs. The person can choose less.
- `why` is one sentence, up to 300 characters, shown to the person in the dialog. Say what the
  package will do with it.
- Asking grants nothing. A package that declares a request needs a Peers version that knows it;
  older versions refuse to install the package.

### Using it

```ts
const { grant } = await SystemDelegates(ctx).tools.getGrant();
if (grant) {
  const { tools } = await SystemToolCatalog(ctx).tools.listTools({ limit: 500 });
  const result = await SystemToolCatalog(ctx).tools.invokeTool({ toolId, args });
}
```

- **`getGrant()`** returns the package's own grant in the group, if any: `level`,
  `effectiveLevel` (the level that applies now), and `raisedLevel` / `raisedUntil` while a raise
  lasts. It also returns the package's `request`, and `userAccessLevel`, the person's own
  level in the group: no grant goes above it. System Delegates' `changed` event tells the
  package when its own grant changes.
- **`listTools`** lists the tools installed packages provide in the group. Each entry's
  `access.allowed` says whether the grant reaches it. Older versions of a contract are listed
  too; choose the newest you understand. Your own package's tools are in the list.
- **`invokeTool`** runs one as the person. A call outside the person's own work, without a
  grant, to a Peers system tool, or above the grant's level is refused with a message that says
  why.
- **`requestDelegate()`** opens the Acts for you dialog for the package, from a call the person
  made, such as a button press on its screen. It returns `{ opened: true }` at once, or
  `{ opened: false, reason: "busy" }` while another request is open. Without a
  `pkg.requestsDelegate` declaration it throws. Call it when the person asks for it. Background
  work that no call of theirs started is refused; there, say what's missing and let the person
  press the button.
- Without a grant, keep working with what the package consumes as itself, and tell the person
  what turning on Acts for you would add.

### What your tools see

A delegate call arrives at a package's tool as the person's own call. The tool's
[access level](./Tools.md#policy) is checked against the grant's level. So:

- describe your tools for agents as well as people;
- give each tool the level that fits what it does;
- mark package-internal tools `private`, so they stay out of the catalog.

## Related

- [Tools and access](./Tools.md): levels, the catalog, and step-up approval.
- [Declaring a package](../Packages/declaring-a-package.md#the-declaration).
- [CLI](./CLI.md#peers-delegates).
