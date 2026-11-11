---
sidebar_position: 12
---

# Notifications

Peers keeps its own notifications. A package asks for one at an attention level, Peers stores it
for each recipient, and each recipient's devices present it the closest way they can. The desktop
app shows OS notifications, sets the dock or taskbar badge, and keeps a priority alarm going
until the user deals with it (up to 30 minutes). Every app shows a bell with the badge and a Notifications screen
with history and settings.

Dealing with a notification on one device clears it on the user's other devices. A notification
stays in the history for 90 days after it's dealt with; one nobody deals with is removed 90 days
after it arrives.

## Attention levels

| Level        | What the recipient gets                                                                                  | Badge                 |
| ------------ | -------------------------------------------------------------------------------------------------------- | --------------------- |
| `priority`   | An alarm: a popup that stays, a repeating sound, and a banner until it's acknowledged, snoozed, or dismissed. | Adds to the number    |
| `loud`       | One popup with sound.                                                                                    | Adds to the number    |
| `quiet`      | One popup without sound.                                                                                 | A dot, until seen     |
| `background` | Nothing outside the Notifications list.                                                                  | Unchanged             |

Priority stops ringing after 30 minutes even if it has not been dealt with. It stays in the
list and badge. Snoozing asks for attention again when the snooze ends.

A notification more than a few minutes old when it reaches a device doesn't pop up or make a
sound; it waits in the list. A level is a request: each device does the closest it can, never
louder.

## Sending notifications from a package

Declare System Notifications as an optional consume and call `notify` from a tool handler with
that call's `ctx`:

```ts
import { SystemNotifications } from "@peers-app/peers-sdk/define";

// In the package declaration:
pkg.consumes(SystemNotifications, { optional: true });

// Inside a tool handler:
await SystemNotifications(ctx).tools.notify({
  recipientUserIds: [threadAuthorId],
  level: "loud",
  title: "Mark replied in #general",
  body: "Sounds good, see you at 6",
  kind: "reply",
  key: `message:${messageId}`,
  link: `package-nav/${packageId}/app?threadId=${threadId}`,
});
```

- **`recipientUserIds`**: members of the group the call runs in. Omit it to notify only the
  signed-in user (a timer going off, say). Ids that aren't members are skipped. In the personal
  context only the signed-in user can be notified.
- **`level`**: `priority`, `loud`, `quiet`, or `background`.
- **`title`** is required; **`body`** is optional. Long text is shortened.
- **`kind`**: your name for this sort of notification, such as `reply` or `assigned`. Users can
  set a level for one kind.
- **`key`**: your id for what the notification is about. `retractNotifications({ key })` later
  marks the unhandled notifications your package sent the signed-in user in the current group
  with that key as no longer needed, for example when the timer is dismissed in your UI. It
  doesn't reach notifications other people's actions caused, or anything already sent to other
  members.
- **`link`**: the route that opens what it's about. It must start with
  `package-nav/<your package id>/`. Clicking the notification switches to its group and opens
  the link, so read any query parameters in your screen to show the right thing.
- **`expiresAt`**: epoch milliseconds after which it no longer shows as active.

`notify` returns `{ queued }`, the number of recipients it is on its way to. It returns as soon
as the signed-in user's own notification is stored; other people's are delivered in the
background, including to devices that are offline when you call it. Call it after your own
write succeeds, and don't let a failure to notify fail your tool: wrap it in `try`/`catch`.

Like other system contracts, `notify` can only be called inside a tool run, not from `onStart`
or a table watch.

## What recipients control

The recipient's settings decide what actually reaches them:

- **Levels by source**: a level (or Off) for a group, an app, a kind, or a person.
- **Priority from people**: a notification another person caused arrives as loud unless the
  recipient allows that person to use priority. An app's priority notifications about the
  user's own things, such as their timers, come through as asked.
- **Do not disturb**: while paused, loud notifications arrive without sound. Priority still
  comes through.

Settings are in **Notifications → Settings** and sync across the user's devices.

## From the CLI

The tools are on the `System Notifications` contract:

```bash
peers tools run notify '{"level":"loud","title":"Build finished"}'
peers tools run listNotifications '{"activeOnly":true}' --json
peers tools run actOnNotifications '{"action":"dismiss","all":true}'
```

`notify` with `-c <groupId>` and `recipientUserIds` notifies members of that group.

## Where it works

- **Desktop** (Windows, macOS, Linux): OS notifications, the badge, and the priority alarm,
  while the app is running. On macOS, whether a popup stays on screen also depends on the
  Peers alert style in System Settings → Notifications.
- **PWA** (installed web app or a browser tab): browser notifications and the app badge while
  the app is open where supported, and a wake-up push while it is closed. See below.

## In the browser

The PWA shows notifications through the browser once you allow it: open **Notifications →
Settings** and, under **This device**, choose **Turn on**. The browser asks for permission. From
then on:

- While the app is open, fresh notifications appear as browser notifications (silent for quiet
  ones, requesting a persistent popup for priority), and supported installed apps show an icon badge. Clicking
  one opens what it is about.
- While the app is closed, Peers Services sends your browser an empty push when something arrives
  for you and none of your devices is online. The browser shows **"New activity in Peers"**;
  opening it starts the app, which fetches what was waiting and shows the real notifications.
  The push itself carries no content, so neither Peers Services nor the browser's push service
  learns what the notification says.

What you need:

- **Registered with Peers Services** (Identity → Account). The push subscription is tied to your
  account; without it, **Turn on** explains what to do.
- **Notification permission.** If you once blocked it, the browser remembers: allow notifications
  for the site in the browser's site settings, then come back.
- On iOS, the app must be added to the Home Screen; Safari tabs can't receive push.

**Turn off** stops browser popups and removes this browser's push subscription. The permission
stays with the browser. Signing out also removes the subscription; after signing in again,
choose **Turn on** to enable notifications for that account.

A device or browser that goes a long time without opening Peers may lose its subscription
(browsers drop them; the service drops ones the browser reports gone). Opening the app
refreshes an existing subscription. If notifications show as **Off**, choose **Turn on** again.

Priority alarms don't repeat their sound outside the app. Browsers that support persistent
notifications may keep the popup on screen; the in-app banner rings while the app is open.
