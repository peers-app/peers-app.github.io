# Friendly Names Registry

## Overview

Allow group admins to register human-friendly names that map to their groupId or deviceId, making URLs memorable and shareable.

> **Note:** Every user has an implicit "personal group" with the same ID as their userId. All ownership and permissions are managed through group admin roles.

## Data Model

**Collection:** `friendlyNames` in MongoDB (peers-services)

```typescript
interface IFriendlyName {
  friendlyName: string;      // unique, lowercase, alphanumeric + hyphens
  targetType: 'group' | 'device';
  targetId: string;          // groupId or deviceId
  ownerGroupId: string;      // groupId whose admin registered this
  registeredByPublicKey: string;  // public key of the admin who registered
  signature: string;         // proves admin controls target
  createdAt: Date;
}
```

## Validation Rules

### Friendly Name Format
- Length: 3-32 characters
- Characters: lowercase alphanumeric + hyphens
- Pattern: `/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/`
- No leading/trailing hyphens

### Reserved Names
Cannot register:
- `api`, `admin`, `www`, `app`, `auth`
- `download`, `ping`, `health`, `status`
- `static`, `assets`, `public`, `private`
- `system`, `peers`, `blog`, `proxy`
- `webhook`, `ws`, `socket`

### Ownership Rules
- One friendly name per group (initially)
- One friendly name per device (initially)
- Only an admin of the owning group can delete the friendly name
- **For group targets:** caller must be an admin of the target group
- **For device targets:** caller must be an admin of a group that includes the device (typically the device owner's personal group)

## Implementation

### 1. MongoDB Collection

**File:** `peers-services/src/data/friendly-names.ts`

```typescript
import { MongoCollection } from "./mongo-collection";
import { z } from 'zod';

export const friendlyNameSchema = z.object({
  friendlyName: z.string().min(3).max(32).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/),
  targetType: z.enum(['group', 'device']),
  targetId: z.string().min(1),
  ownerGroupId: z.string().min(1),
  registeredByPublicKey: z.string().min(1),
  signature: z.string().min(1),
  createdAt: z.date(),
});

export class FriendlyNameCollection extends MongoCollection<IFriendlyName> {
  // Methods: resolveNameOrId, getByOwnerGroup, getByTarget, isNameAvailable
}
```

### 2. Registration RPC Endpoints

**Add to:** `peers-services/src/peers/connection-server.ts`

```typescript
// Register a friendly name (requires signed registration, caller must be group admin)
connection.exposeRPC('registerFriendlyName', async (signedRegistration) => { ... });

// Delete a friendly name (caller must be admin of the owning group)
connection.exposeRPC('deleteFriendlyName', async (friendlyName: string) => { ... });

// List all friendly names for groups where caller is admin
connection.exposeRPC('listFriendlyNames', async () => { ... });

// Check if a name is available
connection.exposeRPC('checkFriendlyNameAvailability', async (name: string) => { ... });
```

### 3. Registration Flow

1. Group admin creates registration data: `{friendlyName, targetId, targetType, ownerGroupId, timestamp}`
2. Admin signs the data with their **personal secret key**
3. Client sends signed object to `registerFriendlyName` RPC
4. Server verifies:
   - Signature is valid
   - Extract signer's public key from signature
   - Look up user by public key and verify they have admin+ role in `ownerGroupId` (uses same pattern as `getUserRoleFromPublicKey` in peers-sdk)
   - Timestamp is recent (within 5 minutes)
   - Name is available and not reserved
   - Target doesn't already have a friendly name
   - For group targets: `ownerGroupId` must equal `targetId`
   - For device targets: device must belong to a member of `ownerGroupId`
5. Server saves to MongoDB

> **Note:** Groups have their own public/private key pairs (used for encrypting group secrets), but registration signatures use the **admin's personal key**. Verification checks that the signer is a group admin by looking up their public key in the group's membership.

## Client-Side Support

### New RPC Types

**Modify:** `peers-sdk/src/rpc-types.ts`

```typescript
// Sign an object with the device's secret key (used to prove admin identity)
signObject: <T extends object>(obj: T) => Promise<ISignedObject<T>>;

// Call RPC on peers-services
callPeersServices: <T = any>(rpcName: string, ...args: any[]) => Promise<T>;
```

### Server-Side Implementation

**Modify:** `peers-electron/src/server/peers-init.ts`

```typescript
rpcServerCalls.signObject = async (obj) => { ... };
rpcServerCalls.callPeersServices = async (rpcName, ...args) => { ... };
```

## Files to Create/Modify

**New:**
- `peers-services/src/data/friendly-names.ts`

**Modify:**
- `peers-services/src/peers/connection-server.ts` - Add registration RPCs
- `peers-sdk/src/rpc-types.ts` - Add signObject, callPeersServices
- `peers-electron/src/server/peers-init.ts` - Implement new RPCs
- `peers-electron/src/server/connections/websocket-client.ts` - Add helper for peers-services connection

## Effort Estimate

1-2 days

