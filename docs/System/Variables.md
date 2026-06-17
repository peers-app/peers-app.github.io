---
sidebar_position: 2
title: Variables (pvars)
---

# Persistent variables (pvars)

**Persistent variables** (often called **pvars**) are Peers **observables** (reactive values in `peers-sdk`) whose state is stored in the `PersistentVars` table and survives restarts. They are the usual way to keep UI preferences, feature flags, and small bits of shared state that should not be hard-coded.

Implementation lives in `@peers-app/peers-sdk` (`persistent-vars.ts`). Device-level tests are in `peers-device` (`persistent-vars.test.ts`).

## API overview

| Factory | Scope | Where it lives | Typical use |
| --- | --- | --- | --- |
| `deviceVar(name, opts?)` | `device` | Current device, user’s **personal** database | Machine-local preferences, not synced to other devices |
| `userVar(name, opts?)` | `user` | User’s **personal** database, synced across that user’s devices | Account-wide settings |
| `groupVar(name, opts?)` | `group` | **Group** database for the active group context | Shared settings for everyone in the group |
| `groupDeviceVar(name, opts?)` | `groupDevice` | Personal DB, name disambiguated per group | Per-group value on this device only (not synced to other devices). Example: package version prefs (`packagePrefs_${packageId}`) — see [Package lifecycle](../Packages/package-lifecycle). |
| `groupUserVar(name, opts?)` | `groupUser` | Personal DB, name disambiguated per group | Per-group, per-user value synced across your devices |

Optional `opts` include `defaultValue`, `userContext`, `dataContext`, and `isSecret` (see below).

Instances are **cached** by scope, logical name, user context, and data context. Calling the same factory with the same arguments returns the same observable.

## Observable shape

A `PersistentVar<T>` is an `Observable<T>` with two extra members:

- **`loadingPromise`** — resolves when the row has been loaded from (or created in) the database and subscriptions are wired. Await this before calling `delete()` or assuming persistence has caught up.
- **`delete()`** — removes the row and resets to the default value when a default was provided.

Reading and writing use the observable call form: `myVar()` to read, `myVar(newValue)` to write. Writes debounce through to `PersistentVars` save logic.

## Secrets

When `isSecret: true`, new or changed values are encrypted via `rpcServerCalls.encryptData` on the **server** path (not on a thin multi-process client that only proxies SQL). In single-process bundles (for example the PWA), encryption runs in-process when applicable.

Secret values are stored encrypted at rest and are **never decrypted into the UI**. The detail screen shows a masked field, and decryption only ever happens on the server/main process (see **Copy Value** below).

## Variables screen (UI)

The **Variables** screen lists pvars and has two tabs:

- **User** — variables you created (`userCreated: true`). Type a name and press Enter to create a new one.
- **System** — everything else: system and package-owned pvars (`userCreated` unset or `false`). This tab is browse/search only (no create). Selecting any variable opens the same detail screen.

### Copy Value

The variable detail screen has a **Copy Value** button. It copies the variable's value to the system clipboard **entirely on the server/main process** via `rpcServerCalls.copyPvarValueToClipboard(persistentVarId, groupId?)` — the same approach used by "Copy Secret Key". For secret variables, the value is decrypted server-side and written straight to the clipboard; the plaintext is **never returned to or displayed in the UI**.

- On desktop (Electron), a copied secret is automatically cleared from the clipboard after 30 seconds.
- On the PWA (single process), the copy uses the browser clipboard API. True process isolation isn't possible there, but decryption stays out of UI components and auto-clear is best-effort (it only clears if the clipboard still holds the copied value).

## How updates reach the UI

When another process, sync, or tool updates a `PersistentVars` row, your in-memory observable still needs to update. Pvars subscribe to **`PersistentVars` change notifications across data contexts** (not only the default group). Those notifications ride the same **named event** pipeline as table `dataChanged` events.

For how named events are delivered in the desktop shell (including selective forwarding to the renderer), see **[Events](./Events)**.

## Related topics

- **[Events](./Events)** — global `subscribe` / `emit`, cross-process delivery, prefixes for table change streams
- **[Tables](./Tables)** — `PersistentVars` is a normal ORM table; pvars are a convenience layer on top
