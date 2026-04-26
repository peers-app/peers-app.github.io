# getTrustLevelFn — Trust Evaluation State Machine

`peers-sdk/src/device/get-trust-level-fn.ts`

Called at the end of every successful handshake to determine how much a connecting device should be trusted and to persist the device/user records locally.

---

## TrustLevel Enum

```
Malicious  = -20   (permanent ban — not yet assigned here, reserved)
Untrusted  = -10   (key mismatch or explicit rejection)
Unknown    =   0   (seen but not yet evaluated)
NewUser    =  10   (first time we've seen this userId anywhere)
NewDevice  =  20   (known user, new or recently-seen device)
Known      =  30   (device first seen > 7 days ago)
Trusted    =  50   (device + user both independently marked Trusted)
Self       = 100   (own device — assigned by the own-device fast path)
```

Connections are allowed through when `trustLevel >= TrustLevel.Unknown`.

---

## Decision Flow (State Machine)

```
                    ┌─────────────────────────────────────────────────┐
                    │  getTrustLevel(deviceInfo)                      │
                    └─────────────────┬───────────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────────────┐
                    │  Is this my own userId+publicKey+publicBoxKey?  │
                    └─────────────────┬───────────────────────────────┘
                             YES │                       NO │
                                 ▼                          ▼
              ┌──────────────────────────┐    ┌────────────────────────────┐
              │  OWN DEVICE FAST PATH    │    │  Parallel lookup in        │
              │                          │    │  personal DB:              │
              │  Load or create device   │    │  · Users (by userId)       │
              │  record. Update lastSeen.│    │  · Devices (by deviceId)   │
              │                          │    │  · UserTrustLevels         │
              │  firstSeen > 2 days?     │    └────────────┬───────────────┘
              │    YES → Trusted (50)    │                 │
              │    NO  → NewDevice (20)  │                 ▼
              │                          │    ┌────────────────────────────┐
              │  Save (weakInsert).      │    │  Device record exists AND  │
              │  Return trust level.     │    │  device.trustLevel < Unknown│
              └──────────────────────────┘    │  (i.e. explicitly blocked)?│
                                              └────────────┬───────────────┘
                                                   YES │           NO │
                                                       ▼              │
                                              ┌────────────┐          │
                                              │ RETURN     │          │
                                              │ device.    │          │
                                              │ trustLevel │          │
                                              │ (blocked)  │          │
                                              └────────────┘          ▼
                                              ┌────────────────────────────┐
                                              │  user found in personal DB?│
                                              └────────────┬───────────────┘
                                                   YES │           NO │
                                                       │              ▼
                                                       │  ┌───────────────────────────────┐
                                                       │  │  GROUP USER LOOKUP            │
                                                       │  │                               │
                                                       │  │  Iterate groupDataContexts:   │
                                                       │  │  · Users(ctx).get(userId)     │
                                                       │  │  · UserTrustLevels(ctx).get() │
                                                       │  │                               │
                                                       │  │  groupUser = first found      │
                                                       │  │  groupTrustLevel = min across │
                                                       │  │  all groups with a trust entry│
                                                       │  └────────────┬──────────────────┘
                                                       │               │
                                                       └───────┬───────┘
                                                               │ effectiveUser = user ?? groupUser
                                                               ▼
                                              ┌────────────────────────────┐
                                              │  effectiveUser AND device  │
                                              │  exist, but userId/key/    │
                                              │  boxKey don't all match?   │
                                              └────────────┬───────────────┘
                                                   YES │           NO │
                                                       ▼              │
                                              ┌────────────┐          │
                                              │ RETURN     │          │
                                              │ Untrusted  │          │
                                              │ (-10)      │          │
                                              └────────────┘          ▼
                                              ┌────────────────────────────┐
                                              │  Personal userTrustLevel   │
                                              │  >= Trusted AND device     │
                                              │  >= Trusted?               │
                                              └────────────┬───────────────┘
                                                   YES │           NO │
                                                       ▼              │
                                              ┌────────────┐          │
                                              │ Update     │          │
                                              │ lastSeen,  │          │
                                              │ RETURN     │          │
                                              │ Trusted(50)│          │
                                              └────────────┘          ▼
                                              ┌────────────────────────────┐
                                              │  Resolve device record     │
                                              │  (personal DB only)        │
                                              │                            │
                                              │  No device?                │
                                              │    → Create (NewDevice)    │
                                              │                            │
                                              │  Existing device?          │
                                              │    Update lastSeen.        │
                                              │    firstSeen > 7 days?     │
                                              │      YES → Known (30)      │
                                              └────────────┬───────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────────┐
                                              │  Resolve user & trust level│
                                              │                            │
                                              │  personal user found?      │
                                              │    → existing logic        │
                                              │                            │
                                              │  groupUser found?          │
                                              │    → DO NOT write to any DB│
                                              │    → apply groupTrustLevel │
                                              │      as a floor on result  │
                                              │                            │
                                              │  no user anywhere?         │
                                              │    → create stub (no sig)  │
                                              │    → save (weakInsert)     │
                                              │    → trustLevel = NewUser  │
                                              └────────────┬───────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────────────┐
                                              │  Save device (weakInsert,  │
                                              │  personal DB)              │
                                              │  RETURN trustLevel         │
                                              └────────────────────────────┘
```

---

## Key Behaviours

### Own-device fast path
If all three identity fields (`userId`, `publicKey`, `publicBoxKey`) match the local device's own identity, the device is treated as self. Trust advances to `Trusted` after the device has been seen for more than 2 days.

### Two-phase user lookup
The user record is looked up in two stages:

1. **Personal DB first** — `userContext.userDataContext`. If found, all subsequent logic uses that record exclusively (existing behaviour, unchanged).
2. **Group DBs second** — only when the personal lookup returns nothing. Iterates `userContext.groupDataContexts` and collects the first matching user record (`groupUser`) plus the minimum `UserTrustLevel` found across all groups (`groupTrustLevel`). Nothing is written to the group DBs here.

Personal data always takes precedence. A user in the personal DB will never be superseded by a group-DB version.

### Group-sourced user is never copied to personal DB
When `groupUser` is found, it is used only for the key-mismatch check and trust-floor calculation. The user is **not** written to the personal DB. That requires an explicit user action (e.g. accepting an invite or adding a contact).

### Key-mismatch guard
Uses `effectiveUser = user ?? groupUser`. When **both** an effective user record and a device record exist and the identity fields don't match, the connection is immediately rejected as `Untrusted`. This covers both the personal and group-sourced cases.

Note: this check only fires when **both** records exist. On a true first-ever connection (no device record yet) it is skipped.

### Group trust floor
If `groupTrustLevel` is defined (i.e. at least one group has an explicit `UserTrustLevel` for this user), it is applied as a floor on the final trust level:

```
trustLevel = min(device.trustLevel, groupTrustLevel)
```

Examples:
- Personal DB has no entry, group A marks Malicious (−10), group B marks Trusted (50) → result is **Malicious** (min = −10)
- Personal DB has entry → group trust is ignored entirely

If no group has an explicit `UserTrustLevel` for this user, the result is `device.trustLevel` as usual.

### Explicit trust fast path
Only checks personal `UserTrustLevel` (not group trust levels). If the personal DB says Trusted and the device is also Trusted, we short-circuit and return `Trusted` immediately without touching any group data.

### Device aging
A device first seen more than **7 days** ago is promoted from `NewDevice` to `Known` automatically on each connection. Device records are only stored in the personal DB.

### Unsigned user stubs
When a user is not found in the personal DB **and** not found in any group DB (`!user && !groupUser`), a stub record is created with no signature and saved with `weakInsert: true`. This gives the stub a very early `createdAt` timestamp so a properly-signed user record arriving later via sync will always win.

### `weakInsert`
Both new user stubs and new/updated device records are saved with `weakInsert: true`, meaning they use a minimal timestamp. Any real synced record from the peer will supersede them without conflict.

---

## Planned (TODO in code)

- **User trust level early exit** — if a user is explicitly untrusted in the personal DB, return immediately before device resolution (currently commented out)
- **Remote trust verification** — ask trusted peers whether they know this device (commented out, needs reimplementation)

---

## Related Files

| File | Role |
|------|------|
| `peers-sdk/src/device/socket.type.ts` | `TrustLevel` enum definition |
| `peers-sdk/src/data/users.ts` | `UsersTable` with signature enforcement |
| `peers-sdk/src/data/user-permissions.ts` | `verifyUserSignature` — stub vs signed save rules |
| `peers-sdk/src/data/user-trust-levels.ts` | `UserTrustLevels` table — per-context trust overrides |
| `peers-sdk/src/device/connection.ts` | Calls `getTrustLevel` after handshake completes |
| `peers-sdk/src/device/binary-peer-connection-v2.ts` | Passes `getTrustLevelFn` into `wrapWrtc` / `wrapBinaryPeer` |
