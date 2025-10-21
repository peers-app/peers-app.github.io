# User Update Permission System

## Overview

This document outlines the permission system for user updates in the Peers SDK. Similar to the group and group-members tables, user records should have different update permissions depending on the data context where they are being modified.

## Current State Analysis

### Existing Permission Patterns

The codebase already has sophisticated permission systems:

**Groups Table (`groups.ts`)**:
- Uses `verifyGroupSignature()` to validate updates
- Only Admin+ role members can modify group properties
- Signature verification ensures only authorized users can make changes

**GroupMembers Table (`group-members.ts`)**:
- Uses `isGroupMemberSignatureValid()` to validate updates  
- Only Admin+ role members can modify group membership
- Role hierarchy prevents users from assigning higher roles than their own

### Users Table Current State

**Current Implementation (`users.ts`)**:
- Uses standard `Table<IUser>` class without custom save logic
- No signature verification on updates
- No permission checking based on context
- All updates are allowed regardless of signer

## Proposed User Update Permission System

### Permission Rules

**Personal Context (`userDataContext`)**:
- ✅ **Full Control**: User can update any user record without restrictions
- ✅ **No Signature Required**: User manages their personal contact database
- ✅ **Trust Level Changes**: User can change trust levels for their contacts
- **Rationale**: Personal context represents the user's own contact management

**Group Context (`groupDataContext`)**:
- 🔒 **Self-Update Only**: User can only update their own user record
- 🔒 **Signature Required**: Updates must be signed by the user's own private key
- 🔒 **Public Key Immutable**: Public key cannot be changed (for now)
- 🔒 **Verification**: Signature must match the existing `publicKey` on the user record
- **Rationale**: Group context represents shared data where only the user themselves can modify their profile

### Technical Implementation Design

#### 1. Create UsersTable Class with Custom Save Logic

```typescript
// src/data/users.ts
export class UsersTable extends Table<IUser> {
  
  public static isPassthrough: boolean = false;

  public async save(user: IUser, opts?: ISaveOptions): Promise<IUser> {
    if (UsersTable.isPassthrough) {
      return super.save(user, opts);
    }

    // Check if this is a personal context or group context
    const userContext = await getUserContext();
    const isPersonalContext = this.dataContext === userContext.userDataContext;
    
    if (isPersonalContext) {
      // Personal context: allow all updates without signature verification
      return super.save(user, opts);
    } else {
      // Group context: verify user can only update themselves
      const oldUser = await this.get(user.userId);
      if (await isUserUpdateValid(user, oldUser, this.dataContext)) {
        return super.save(user, opts);
      }
      throw new Error('User update signature verification failed');
    }
  }
}
```

#### 2. Create User Permission Verification Functions

```typescript
// src/data/user-permissions.ts (new file)
export async function isUserUpdateValid(
  newUser: IUser, 
  oldUser: IUser | undefined,
  groupDataContext: DataContext
): Promise<boolean> {
  
  // Basic signature verification
  if (!isObjectSignatureValid(newUser)) {
    return false;
  }

  // Get the public key that signed this user update
  const signerPublicKey = getPublicKeyFromObjectSignature(newUser);
  if (!signerPublicKey) {
    return false;
  }

  // For new users, allow if signature matches the user's own public key
  if (!oldUser) {
    return signerPublicKey === newUser.publicKey;
  }

  // For existing users, signature must match the existing public key
  if (signerPublicKey !== oldUser.publicKey) {
    return false; // Only the user themselves can update their profile
  }

  // Prevent public key changes (for now)
  if (newUser.publicKey !== oldUser.publicKey) {
    return false; // Public key cannot be changed
  }

  return true;
}

export function signUserObject(user: IUser, secretKey: string): IUser {
  return addSignatureToObject(user, secretKey);
}

export async function verifyUserSignature(user: IUser, oldUser?: IUser): Promise<boolean> {
  verifyObjectSignature(user);
  const signerPublicKey = getPublicKeyFromObjectSignature(user) ?? '';
  
  // New user: signature must match their own public key
  if (!oldUser) {
    return signerPublicKey === user.publicKey;
  }
  
  // Existing user: signature must match existing public key
  return signerPublicKey === oldUser.publicKey;
}
```

#### 3. Context Detection Logic

```typescript
// Determine if update is in personal vs group context
private async isPersonalContext(): Promise<boolean> {
  const userContext = await getUserContext();
  return this.dataContext === userContext.userDataContext;
}
```

## Permission Matrix

| Context | Action | Signature Required | Who Can Update | Restrictions |
|---------|--------|-------------------|----------------|--------------|
| **Personal** | Create User | ❌ No | Anyone | None |
| **Personal** | Update Any User | ❌ No | Anyone | None |
| **Personal** | Change Trust Level | ❌ No | Anyone | None |
| **Group** | Create User | ✅ Yes | User themselves | Must sign with own key |
| **Group** | Update Own Profile | ✅ Yes | User themselves | Cannot change publicKey |
| **Group** | Update Other User | ❌ Blocked | Nobody | Always fails |
| **Group** | Change Public Key | ❌ Blocked | Nobody | Immutable (for now) |

## Security Benefits

### 1. **Personal Privacy Control**
- Users maintain full control over their personal contact database
- Can set trust levels and modify contact info without restrictions
- Personal context remains flexible for contact management

### 2. **Group Data Integrity** 
- Prevents users from impersonating others in group contexts
- Ensures only users can modify their own profile information
- Signature verification prevents tampering with user records

### 3. **Public Key Immutability**
- Prevents key rotation attacks during transition period
- Maintains consistent identity verification
- Future enhancement: controlled key rotation with proper validation

### 4. **Consistent Permission Model**
- Follows same patterns as Groups and GroupMembers tables
- Uses existing signature verification infrastructure
- Maintains familiar passthrough mode for testing

## Migration Strategy

### Phase 1: Add New UsersTable Class (Non-Breaking)
- Create `UsersTable` class extending `Table<IUser>`
- Add user permission verification functions
- Keep existing `Users()` function unchanged initially

### Phase 2: Enable Custom Logic
- Update `Users()` function to return `UsersTable` instances
- Add passthrough mode for backward compatibility
- Update group sharing functionality to use signatures

### Phase 3: Enforce Signatures in Groups
- Enable signature verification in group contexts
- Add UI for users to sign their profile updates
- Provide clear error messages for failed updates

### Phase 4: Full Deployment
- Remove passthrough mode
- Update documentation and examples
- Monitor for any compatibility issues

## Implementation Files

**New Files:**
- `src/data/user-permissions.ts` - Permission verification logic

**Modified Files:**
- `src/data/users.ts` - Add UsersTable class with custom save logic
- `src/data/index.ts` - Export new user permission functions

**Test Files:**
- `src/data/user-permissions.test.ts` - Comprehensive permission testing
- `src/data/users.test.ts` - Update existing tests for new behavior

## Use Cases

### Personal Contact Management
```typescript
// Personal context - no signature required
const personalUsers = Users(userContext.userDataContext);
await personalUsers.save({
  userId: 'contact-123',
  name: 'Updated Name',
  publicKey: 'existing-key',
  publicBoxKey: 'existing-box-key',
  trustLevel: TrustLevel.Trusted
});
```

### Group Profile Updates
```typescript
// Group context - signature required
const groupUsers = Users(groupDataContext);
const signedUser = signUserObject({
  userId: 'my-user-id',
  name: 'My Updated Name', 
  publicKey: 'my-public-key',
  publicBoxKey: 'my-box-key',
  trustLevel: TrustLevel.Trusted
}, mySecretKey);

await groupUsers.save(signedUser);
```

## Future Enhancements

### Phase 2: Controlled Public Key Rotation
- Allow public key changes with proper validation
- Require multiple signatures or admin approval
- Maintain audit trail of key changes

### Phase 3: Trust Level Management
- Allow group admins to modify trust levels
- Implement trust level change notifications
- Add group-specific trust level overrides

### Phase 4: Advanced Permissions
- Role-based user management permissions
- Bulk user operations with proper validation
- Integration with group member roles for user management

This permission system ensures that user data maintains appropriate security while preserving the flexibility needed for personal contact management and group collaboration.