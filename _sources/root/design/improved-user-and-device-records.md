# Improved User and Device Records

## Problem Statement

Users can initially connect to peers-services and each other, but subsequent connections fail until they delete the old device record. This document investigates all the ways this can happen and proposes improvements.

---

## Bug #1: `decodeBase64` crash on unsigned user records

**Status:** Fixed

The immediate crash is in `keys.ts` — `decodeBase64()` is called with `undefined` when a user record has no `signature` field. The stack trace:

```
decodeBase64(undefined)        ← crashes on .replace()
← openSignedObject(signedObj)  ← signedObj.publicKey is undefined
← verifyObjectSignature(user)  ← user.signature is undefined/missing
← verifyUserSignature(user)
← UsersTable.save()
```

**Root cause:** Several code paths create user records *without* a signature, and those records eventually reach a group-context `UsersTable.save()` which tries to verify them.

**Fix applied:** Added a guard in `verifyObjectSignature()` that throws a clear `"Object has no signature to verify"` error, and added a type guard in `decodeBase64()`.

---

## How User Records Flow Through the System

Understanding the bug requires understanding how user records move between contexts:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Record Lifecycle                      │
│                                                              │
│  1. Created in setup-user.tsx → newKeys() → stored in        │
│     OS keychain (Electron: keytar, RN: SecureStore)          │
│                                                              │
│  2. syncUserAndGroupObjects() signs with secretKey →         │
│     saves to personal DB → copies to all group DBs           │
│                                                              │
│  3. Peers sync group DBs via SyncGroup/TrackedDataSource     │
│                                                              │
│  4. subscribeToDataChangedAcrossAllGroups copies user         │
│     records from group contexts → personal context           │
│                                                              │
│  5. Group invite flow imports admin user record               │
│     (WITHOUT signature) to personal + group contexts         │
└─────────────────────────────────────────────────────────────┘
```

### Context types and signature verification rules

| Context | `UsersTable.save()` behavior |
|---|---|
| Personal (`userDataContext`) | **Skips** verification — users can modify their own table freely |
| Group (`groupDataContexts`) | **Verifies** signature via `verifyUserSignature()` |
| Client UI (`isPassthrough = true`) | **Skips** all verification (proxies to server) |
| Sync (`TrackedDataSource.applyChanges`) | **Bypasses** `UsersTable.save()` entirely — writes directly to `SQLDataSource.saveSync()` |

---

## All Identified Failure Modes

### Mode 1: Unsigned user records created during group invite

**File:** `peers-device/src/connection-manager/group-invite-messages.ts` (lines 604-611)

```typescript
// Save admin user info — NO SIGNATURE
await usersTable.save({
  userId: approval.adminInfo.userId,
  name: approval.adminInfo.name || approval.adminInfo.userId,
  publicKey: approval.adminInfo.publicKey,
  publicBoxKey: approval.adminInfo.publicBoxKey,
  // ⚠️ signature field is missing!
}, { restoreIfDeleted: true, weakInsert: true });
```

This saves the admin's user record to the *personal* context (which skips verification), but later this record can be:
- Synced to a group context via `subscribeToDataChangedAcrossAllGroups` 
- Copied to a new group via `group-members.tsx`

In both cases it hits `UsersTable.save()` in a group context, which calls `verifyUserSignature()`, which crashes (pre-fix) or throws (post-fix) because there's no signature.

### Mode 2: Unsigned user records created during trust establishment

**File:** `peers-sdk/src/device/get-trust-level-fn.ts` (lines 87-96)

```typescript
if (!user) {
  user = {
    userId: deviceInfo.userId,
    publicKey: deviceInfo.publicKey,
    publicBoxKey: deviceInfo.publicBoxKey,
    name: serverUrl || `Unnamed_${deviceInfo.userId.substring(20)}`,
    // ⚠️ signature field is missing!
  };
  // ...
  await Users(userDataContext).save(user, { restoreIfDeleted: true, weakInsert: true });
}
```

When connecting to a new peer, a user record is created from `deviceInfo` without a signature and saved to the personal context. Same downstream problem as Mode 1.

### Mode 3: Key mismatch causes Untrusted trust level (the "can't reconnect" bug)

**File:** `peers-sdk/src/device/get-trust-level-fn.ts` (lines 48-52)

```typescript
if (user && device && !(
  deviceInfo.userId === device.userId && 
  deviceInfo.userId === user.userId && 
  deviceInfo.publicKey === user.publicKey &&      // ← key comparison
  deviceInfo.publicBoxKey === user.publicBoxKey    // ← key comparison
)) {
  // TODO check if user has changed their public keys
  return TrustLevel.Untrusted;  // ← CONNECTION REJECTED
}
```

**This is likely the primary cause of the "can't reconnect" bug.**

Scenario:
1. User A connects to User B for the first time
2. User B's record is created in A's personal DB (no signature, from `deviceInfo`)
3. User B updates their profile (e.g., changes name) via `syncUserAndGroupObjects()`
4. The signed record propagates through group sync to A's group DB
5. A's `subscribeToDataChangedAcrossAllGroups` listener sees the change and copies B's *signed* record to A's personal DB
6. Now A has B's record with a valid signature in personal DB
7. **But:** if B's keys ever change (reinstall, new device setup with same userId via env vars), the stored `user.publicKey` in A's DB won't match B's new `deviceInfo.publicKey`
8. `getTrustLevel()` returns `Untrusted` → connection rejected
9. A must delete B's device record to allow a fresh connection

### Mode 4: peers-services never updates stored public keys

**File:** `peers-services/src/peers/connection-server.ts` (lines 210-236)

```typescript
if (user && device) {
  if (user.userId !== device.userId) {
    return TrustLevel.Untrusted;
  }
  // ⚠️ MISSING: No check/update of publicKey or publicBoxKey!
  // If user reconnects with new keys, the old keys stay in MongoDB
  user.lastSeen = now;
  device.lastSeen = now;
  device.trustLevel = trustLevel;
  await Promise.all([
    Users.save(user),      // saves with OLD publicKey
    Devices.save(device),
  ]);
}
```

When peers-services already has a user record and the user reconnects with different keys (e.g., after reinstalling), the server keeps the old keys. This means:
- Other peers asking peers-services about this user get stale key information
- The user's signed records won't match what peers-services has stored

### Mode 5: Sync bypasses signature verification entirely

**File:** `peers-device/src/tracked-data-source.ts` (lines 524-539)

```typescript
db.runInTransaction!(() => {
  for (const record of recordsToSave) {
    underlyingDataSource!.saveSync(record);  // ← bypasses UsersTable.save()
  }
  // ...
});
```

When `TrackedDataSource.applyChanges()` processes synced changes, it writes directly to the underlying `SQLDataSource` via `saveSync()`, completely bypassing `UsersTable.save()` and therefore bypassing `verifyUserSignature()`. This means:
- Invalid/unsigned user records from a remote peer are written without any verification
- A malicious peer could inject forged user records into a group

### Mode 6: Cross-group user record propagation creates signature conflicts

**File:** `peers-sdk/src/context/user-context.ts` (lines 210-225)

```typescript
this.subscribeToDataChangedAcrossAllGroups<IUser>('Users', async (evt) => {
  const changedUser = evt.data.dataObject;
  if (changedUser.userId !== this.userId && ...) {
    const personalContact = await Users(this.userDataContext).get(changedUser.userId);
    if (personalContact && !isEqual(personalContact, changedUser)) {
      await Users(this.userDataContext).save(changedUser);
      // Saves to personal context (skips verification) — 
      // but the record may be unsigned or have a stale signature
    }
  }
});
```

Also in `peers-ui/src/screens/groups/group-members.tsx` (lines 37-54):

```typescript
if (user && user.source !== 'currentDataContext') {
  const newGroupUser = { ...user };
  delete newGroupUser.source;
  delete newGroupUser.trustLevel;
  await groupUsersTable.save(newGroupUser);  
  // ⚠️ Saves to GROUP context → triggers verifyUserSignature()
  // Will fail if the user record has no signature
}
```

---

## Root Cause Summary

The system has **three** fundamental issues:

1. **User records are created without signatures** in several code paths (group invite, trust establishment), then propagated to contexts that require signatures.

2. **No mechanism to handle key changes.** When a user's keys change, all stored records (on peers-services, on other peers' personal DBs, in group DBs) become stale. The `getTrustLevel()` check rejects connections based on stale keys with no recovery path other than deleting the device record.

3. **Sync bypasses verification.** `TrackedDataSource.applyChanges()` writes directly to SQLite, bypassing `UsersTable.save()` and all its validation logic. This means unsigned or incorrectly-signed records can propagate through sync.

---

## Proposed Improvements

### Fix 1: Always include signatures when creating user records from external sources

In `group-invite-messages.ts`, the approval response should include the admin's signed user record (with signature), not just the raw fields. The admin should sign their user record before sending the approval.

In `get-trust-level-fn.ts`, user records created from `deviceInfo` should be marked as "unverified" or the `deviceInfo` itself should include a signed user record.

### Fix 2: Handle key changes gracefully

#### On peers-services:

```typescript
// In connection-server.ts getTrustLevel()
if (user && device) {
  // Check for key changes
  if (deviceInfo.publicKey !== user.publicKey || 
      deviceInfo.publicBoxKey !== user.publicBoxKey) {
    console.warn('User reconnecting with new keys', {
      userId: user.userId,
      oldPublicKey: user.publicKey,
      newPublicKey: deviceInfo.publicKey,
    });
    // Update keys — the handshake already verified the user controls
    // these keys via signed IDeviceInfo
    user.publicKey = deviceInfo.publicKey;
    user.publicBoxKey = deviceInfo.publicBoxKey;
  }
  // ... rest of logic
}
```

#### On client (get-trust-level-fn.ts):

Instead of immediately returning `Untrusted` on key mismatch, update the stored user record if the new keys can be verified through the handshake:

```typescript
if (user && device && (deviceInfo.publicKey !== user.publicKey || 
    deviceInfo.publicBoxKey !== user.publicBoxKey)) {
  // Keys changed — the handshake has already verified the device
  // controls these keys (via signed IDeviceInfo), so update our records
  console.warn('Peer has new keys, updating stored user record', {
    userId: user.userId,
    oldPublicKey: user.publicKey,
    newPublicKey: deviceInfo.publicKey,
  });
  user.publicKey = deviceInfo.publicKey;
  user.publicBoxKey = deviceInfo.publicBoxKey;
  await Users(userDataContext).save(user);
  // Continue with normal trust level evaluation
}
```

### Fix 3: Validate signatures during sync

`TrackedDataSource.applyChanges()` should call `UsersTable.save()` instead of `SQLDataSource.saveSync()` for the Users table, or there should be a post-sync validation hook. At minimum, the signature should be checked before writing user records during sync.

However, this needs to be done carefully to avoid breaking sync performance. Options:

a. **Table-level hook:** Add an optional `onBeforeApplyChange(record)` hook to `TrackedDataSource` that specific tables can implement for validation.

b. **Post-sync verification:** After applying changes, verify that all User records in the batch have valid signatures. Roll back invalid ones.

c. **Change-level metadata:** Include the signature in the change record itself so it can be verified without reconstructing the full record.

### Fix 4: Make signature a required field for cross-context user records

Change `userSchema` to make `signature` required (not optional), and update all code paths that create user records to include a valid signature. Records without signatures should only exist in the personal context as "contacts" (observed identity, not verified).

Alternatively, add a `signatureStatus` field: `'signed' | 'unsigned' | 'verified'` to distinguish between:
- Records the user signed themselves (authoritative)
- Records observed from peers (trust-on-first-use) 
- Records verified against a trusted source

### Fix 5: Include signed user record in device handshake

Extend `IDeviceInfo` (or `IDeviceHandshake`) to include the full signed user record:

```typescript
interface IDeviceInfo {
  userId: string;
  deviceId: string;
  publicKey: string;
  publicBoxKey: string;
  signedUser?: IUser;  // The user's self-signed user record
}
```

This way, when a new peer is encountered, we immediately have their properly signed user record rather than creating an unsigned one from the `deviceInfo` fields.

---

## Priority Order

1. **Fix 1 + Fix 5** (include signed records) — eliminates unsigned record creation, the most immediate cause of crashes and verification failures
2. **Fix 2** (handle key changes) — fixes the "can't reconnect" bug on both client and server
3. **Fix 4** (make signature required in group contexts) — enforces correctness structurally
4. **Fix 3** (validate during sync) — defense in depth against bad data propagation

---

## Files to Modify

| File | Change |
|---|---|
| `peers-sdk/src/keys.ts` | ✅ Already fixed: guard in `verifyObjectSignature()` and `decodeBase64()` |
| `peers-device/src/connection-manager/group-invite-messages.ts` | Include signed user record from admin in approval |
| `peers-sdk/src/device/get-trust-level-fn.ts` | Handle key changes instead of returning Untrusted; accept signed user records |
| `peers-services/src/peers/connection-server.ts` | Update stored user keys when they change |
| `peers-sdk/src/device/device.ts` | Include signed user record in `IDeviceInfo` |
| `peers-sdk/src/device/connection.ts` | Pass through signed user record during handshake |
| `peers-sdk/src/data/devices.ts` | Extend `IDeviceInfo` type |
| `peers-device/src/tracked-data-source.ts` | Add validation hook for sync writes |
| `peers-sdk/src/context/user-context.ts` | Validate signatures before cross-context propagation |
