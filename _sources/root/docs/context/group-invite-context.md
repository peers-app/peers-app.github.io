# Group Invite System - Agent Context

Technical context for AI agents working on the group invitation system.

## Architecture Overview

The group invite system spans three packages:

```
peers-sdk/src/group-invite/     → Types, crypto utilities, pvars (state)
peers-device/src/connection-manager/group-invite-messages.ts → Business logic
peers-ui/src/screens/           → UI components (join-group, group-invite-listener)
```

## Key Files

| File | Purpose |
|------|---------|
| `peers-sdk/src/group-invite/group-invite.ts` | Crypto: password generation, alias derivation, encrypt/decrypt |
| `peers-sdk/src/group-invite/group-invite.types.ts` | TypeScript interfaces for all data structures |
| `peers-sdk/src/group-invite/group-invite.pvars.ts` | Device-level state variables and action triggers |
| `peers-device/src/connection-manager/group-invite-messages.ts` | Core logic: listening, discovery, join requests, approval |
| `peers-device/src/connection-manager/device-messages.ts` | Message routing, alias registration |
| `peers-ui/src/screens/join-group/join-group.tsx` | Joiner UI |
| `peers-ui/src/screens/groups/group-invite-listener.tsx` | Admin UI |

## Communication Pattern: Pvars

The system uses **pvars** (persistent variables) for UI-device communication:

**State pvars** (read by UI and device layer):
- `groupInviteListeners` - Active listeners keyed by groupId
- `groupInviteRequests` - Pending join requests awaiting approval
- `groupInviteResponses` - Responses to join requests (internal)
- `groupInviteStatus` / `groupJoinStatus` - Status messages for UI
- `groupInviteDiscoveryResult` - Discovered groups
- `groupInviteJoinResult` - Result of join attempt

**Action pvars** (UI sets, device layer reacts):
- `groupInviteStartListening` - Trigger to start listening
- `groupInviteStopListening` - Trigger to stop listening
- `groupInviteDiscover` - Trigger to search for groups
- `groupInviteSendRequest` - Trigger to send join request
- `groupInviteProcessRequest` - Trigger to approve/deny request

## Message Flow

### 1. Admin Starts Listening

```
UI sets groupInviteStartListening pvar
    → GroupInviteMessages.startListening()
    → Derives alias from password (SHA-256 → 8 hex chars)
    → Stores listener in groupInviteListeners pvar
    → Registers alias via device message (toDeviceId: 'device-alias')
    → Alias propagates to network peers
```

### 2. Joiner Discovers Groups

```
UI sets groupInviteDiscover pvar
    → GroupInviteMessages.discoverListeners()
    → Sends message to alias (dataContextId: 'group-invite-discover')
    → DeviceMessages routes to handleDiscoveryMessage on admin
    → Admin returns encrypted group info
    → Joiner decrypts, updates groupInviteDiscoveryResult pvar
```

### 3. Joiner Sends Request

```
UI sets groupInviteSendRequest pvar
    → GroupInviteMessages.sendJoinRequest()
    → Sends to admin's deviceId (dataContextId: 'group-invite-request')
    → DeviceMessages routes to handleJoinRequest on admin
    → Admin adds to groupInviteRequests pvar
    → Returns Promise that waits for approval via groupInviteResponses subscription
```

### 4. Admin Approves

```
UI sets groupInviteProcessRequest pvar
    → GroupInviteMessages.processJoinRequest()
    → Saves user, device, group member to DB
    → Encrypts approval with password
    → Stores in groupInviteResponses pvar
    → handleJoinRequest's subscription fires, resolves Promise
    → Response returns to joiner
    → Joiner imports group data
```

## Encryption

All invite messages use password-based symmetric encryption:

```typescript
// Key derivation
function deriveKeyFromPassword(password: string): Uint8Array {
  const normalized = password.toLowerCase().trim();
  return sha256(new TextEncoder().encode(normalized));
}

// Encryption uses NaCl secretbox (XSalsa20-Poly1305)
// Random 24-byte nonce prepended to ciphertext
// Result is base64 encoded
```

## Alias System

Aliases allow discovery without knowing the admin's deviceId:

1. Admin derives alias from password: `SHA-256(password) → first 8 hex chars`
2. Admin registers alias: sends `toDeviceId: 'device-alias'` message
3. Each device stores `alias → deviceId` mapping
4. Joiner sends to alias, network resolves to actual deviceId
5. Aliases expire after 10 minutes

## Data Saved on Approval

**Admin saves about joiner:**
- User record (userId, name, publicKey, publicBoxKey)
- Device record (deviceId, userId, trustLevel)
- GroupMember record (groupId, userId, role)

**Joiner saves about admin/group:**
- Group record
- GroupMember records for admins
- User record for admin
- Device record for admin

## Common Issues

### "deleted: true" on User/Device Records

When saving user or device records, always use `restoreIfDeleted: true`:

```typescript
await usersTable.save({
  userId: request.requester.userId,
  // ...
}, { restoreIfDeleted: true, weakInsert: true });
```

If a user was previously deleted, they won't be found by normal queries. The `restoreIfDeleted` option clears the `deleted` flag.

### Pvar Subscription Timing

The approval flow uses pvar subscriptions to coordinate:

1. `handleJoinRequest` subscribes to `groupInviteResponses`
2. `processJoinRequest` stores response in `groupInviteResponses`
3. Subscription fires, Promise resolves

This is synchronous within the same process - no timing issues.

### Alias Not Found

If joiner can't discover admin:
- Admin must be actively listening (alias registered)
- Alias must have propagated through network
- Both devices must be connected

## Testing

To test the flow manually:
1. Run two instances of the app (different users)
2. Admin: Go to group → Members → Invite, start listening with a password
3. Joiner: Go to Join Group, enter same password, search
4. Joiner: Click Join when group appears
5. Admin: Approve the request
6. Verify joiner now has access to the group
