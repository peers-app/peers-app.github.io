---
sidebar_position: 7
title: Trust
---

# Trust

Every account keeps its own trust level for each account it knows. You set it on the
contact: **Contacts →** the person **→ Trust level**. It is stored in your personal data,
so all of your devices use the same setting.

## Self means full control

**Self** is the highest level. A device that trusts an account as Self lets that account
control it as fully as someone sitting at it:

- administer packages with [System Packages](./Packages.md#administering-your-other-devices):
  install, update, activate, and uninstall them, which means loading code there;
- inspect, drive, and screenshot its UI, and restart or quit it, with
  [System Host Shell](./Host-Shell.md) (`peers ui … --device`, `peers app restart --device`);
- update and restart the app with [App Updates](./App-Updates.md#update-another-device);
- query its database and run its tools with Device Operations
  (`peers devices`, see the [CLI](./CLI.md)).

Your own devices trust you as Self automatically: every device signed in to your account is
you.

Levels below Self grant no control of a device. What someone can do in a group comes from
their [group role](./Groups.md), not from trust.

## Giving Self to another account

Some devices are yours but should not be signed in as you: a kitchen display or a family hub
that the whole household uses, which should not hold your keys or your personal data. Sign
the device in to its own account. Then, on that device, set your account's trust to **Self**.
You get full control of the hub; it gets none over you, because your devices do not trust its
account as Self.

Grant Self only to an account you would hand the device to. It can install packages on the
device, including privileged in-process code. Treat this as control of the host, not just
permission to use its UI.

**Revoking.** Lower the trust level on the device. It checks trust on every call, so the next
administrative call from that account is refused. This does not undo changes it already
made or remove code it installed; ordinary shared-group calls still follow group roles.

**How a call gets there.** Your own devices are reachable directly or through the peers
mesh. Another account's device is reachable over a direct connection, for example on the
same network. Commands that name a group you share with it (`peers packages … -c <groupId>`)
also travel through that group.

## What stays on the device

The direct remote contract API keeps these restrictions, even for Self:

- **The device's account.** Pairing a new device (it sends the account's secret key), key
  rotation, recovery anchors, passkeys, services registration, and accepting invites (which
  can grant trust) have local-only contracts. Granting Self does not directly expose those
  account-management APIs remotely.
- **Relaying.** A device never forwards another device's call under its own identity.
- **Restart consent.** Restarting or quitting the app from another device also needs that
  device's **Allow my other devices to update and restart this device** setting.
- **Package services.** HTTP, Scheduler, and Local Folders act for a package on the device
  itself, so there is nothing to call remotely.

These API restrictions are not protection from an account you trust as Self: it can drive
the local UI or install privileged code, which can expose account secrets or establish
access that survives revocation. Grant Self only when that level of control is intended.

## Code you run does not get your Self

Self trust is for you, through the UI or the CLI. A package can call package contracts on
your other devices, but your device refuses, before it sends anything, every package call
to a system contract on another device (System Packages,
System Host Shell, App Updates, Device Operations, and the rest). Workflows and assistants
cannot call these administrative contracts. They can still use workflow-enabled Host Tools
and Desktop Tools locally.

**Current limitation:** forwarded package-contract calls still arrive as the sending user;
the package identity and consume limits do not cross devices. A Self-level tool in a
package contract can therefore run with that user's authority on the target. The
system-contract refusal does not solve this broader authority propagation problem.

The forwarding guard also covers legacy `pkg.remote(...)` handles. Legacy bundles execute
inside the trusted host process; they are not a sandbox for untrusted code. Isolated
packages use the host gateway, which supplies their package identity and enforces the guard.

A coding agent that runs the `peers` CLI on your device acts as you, locally and on your
other devices.
