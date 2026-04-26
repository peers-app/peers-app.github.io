# Friendly Names Management UI

## Overview

Create a system app for group admins to manage their friendly name registrations, including viewing existing names, registering new ones, and deleting names.

> **Note:** Every user is implicitly an admin of their own "personal group" (groupId = userId). This UI shows friendly names for all groups where the current user is an admin.

## System App Definition

**File:** `peers-ui/src/system-apps/friendly-names.app.ts`

```typescript
export const friendlyNamesApp: IAppNav = {
  name: 'Friendly Names',
  displayName: 'Friendly Names',
  iconClassName: 'bi-link-45deg',
  navigationPath: 'friendly-names'
};
```

## UI Screens

### Friendly Names List/Management Screen

**File:** `peers-ui/src/screens/friendly-names/friendly-names-list.tsx`

**Features:**
- Display all friendly names owned by the current user
- Show target type (Personal/Group) and public URL for each
- Register new friendly names with real-time availability checking
- Delete existing friendly names with confirmation
- Link to Proxy Settings in the settings page

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ 🔗 Friendly Names                    [+ New Name]   │
├──────────────────────────────────────────────────────┤
│ ℹ️ Friendly names let you create memorable URLs...   │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ Register New Friendly Name                       │ │
│ │ ┌────────────────────────────────────────────┐   │ │
│ │ │ peers.app/proxy/ [___yourname___]          │   │ │
│ │ └────────────────────────────────────────────┘   │ │
│ │ ✓ This name is available!                       │ │
│ │                                                  │ │
│ │ Target Type: [Personal ▼]                       │ │
│ │                                                  │ │
│ │                          [Register Friendly Name]│ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ Your Friendly Names                                  │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🔗 myblog                              [Delete]  │ │
│ │    Personal · https://peers.app/proxy/myblog/    │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 🔗 myteam                              [Delete]  │ │
│ │    Group: Team Project                           │ │
│ │    https://peers.app/proxy/myteam/               │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**State Management:**
- `friendlyNames: IFriendlyName[]` - List of user's friendly names
- `groups: IGroup[]` - User's groups for target selection
- `newName: string` - Input for new friendly name
- `selectedTargetType: 'group' | 'device'` - Target type selector
- `selectedTargetId: string` - Selected group ID (when type is 'group')
- `availabilityStatus: 'unknown' | 'checking' | 'available' | 'taken'`
- `registering: boolean` - Loading state for registration
- `loading: boolean` - Initial load state

**Key Functions:**
```typescript
// Load data from peers-services
async function loadData() {
  const names = await rpcServerCalls.callPeersServices('listFriendlyNames');
  const groups = await Groups(userContext.userDataContext).list({ disabled: { $ne: true } });
}

// Check availability with debounce (500ms)
useEffect(() => {
  const result = await rpcServerCalls.callPeersServices('checkFriendlyNameAvailability', name);
}, [newName]);

// Register new friendly name
async function handleRegister() {
  const registration = { friendlyName, targetType, targetId, timestamp: Date.now() };
  const signed = await rpcServerCalls.signObject(registration);
  await rpcServerCalls.callPeersServices('registerFriendlyName', signed);
}

// Delete friendly name
async function handleDelete(friendlyName: string) {
  await rpcServerCalls.callPeersServices('deleteFriendlyName', friendlyName);
}
```

## Route Registration

**Modify:** `peers-ui/src/components/router.tsx`

```typescript
import "../screens/friendly-names";
```

**In screen file:**
```typescript
registerInternalPeersUI({
  peersUIId: '00mfn4m3s0fr13ndlyn4m3s1',
  component: FriendlyNamesList,
  routes: [{
    isMatch: (props, context) => context.path === 'friendly-names',
    uiCategory: 'screen',
    priority: 2
  }]
});
```

## Add to System Apps

**Modify:** `peers-ui/src/system-apps/index.ts`

```typescript
export { friendlyNamesApp } from './friendly-names.app';
import { friendlyNamesApp } from './friendly-names.app';

// In systemApps array:
export const systemApps: IAppNav[] = [
  // ...
  friendlyNamesApp,
  // ...
];
```

## Files to Create/Modify

**New:**
- `peers-ui/src/system-apps/friendly-names.app.ts`
- `peers-ui/src/screens/friendly-names/friendly-names-list.tsx`
- `peers-ui/src/screens/friendly-names/index.ts`

**Modify:**
- `peers-ui/src/system-apps/index.ts` - Add friendlyNamesApp
- `peers-ui/src/components/router.tsx` - Import screens

## Effort Estimate

1 day

