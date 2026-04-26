# Groups MVP Implementation Plan

## Overview

This document outlines the minimal viable product (MVP) approach for implementing Groups functionality in the Peers SDK. The goal is to enable users to participate in multiple groups while maintaining data isolation between groups.

## Architecture Goals

1. **Minimal Changes**: Extend existing architecture rather than major refactoring
2. **Data Isolation**: Each group has separate SQLite database and tables
3. **Context Switching**: Ability to switch between groups seamlessly
4. **Virtual Connections**: Share connections when devices are in multiple groups (future)

## Current State Analysis

### Existing Infrastructure
- ✅ `UserContext`: Has `groupIds` observable, manages personal data
- ✅ `GroupContext`: Basic structure exists
- ✅ `Groups` table: Defined for personal DB to track group membership
- ✅ `TableFactory`: Manages table instantiation (currently singleton)
- ✅ `DBProxy`: Database operations wrapper
- ✅ Connection management for device-to-device communication

### What's Missing
- ❌ Separate `TableFactory` instances per group
- ❌ Group-specific `DBProxy` instances 
- ❌ Active group switching mechanism
- ❌ Group data isolation enforcement
- ❌ Virtual connection management

## MVP Implementation Plan

### Phase 1: Core Group Infrastructure

#### 1.1 Extend GroupContext
```typescript
// src/context/group-context.ts
export class GroupContext {
  public readonly groupId: Observable<string>
  public readonly groupName: Observable<string>
  public readonly groupDb: DBProxy           // group-specific database
  public readonly isActive: Observable<boolean> // is this the active group?
}
```

#### 1.2 Create GroupManager
```typescript
// src/context/group-manager.ts
export class GroupManager {
  private groupContexts: Map<string, GroupContext> = new Map()
  public readonly activeGroupId: Observable<string>
  
  async switchToGroup(groupId: string): Promise<GroupContext>
  async createGroup(name: string): Promise<GroupContext>
  async joinGroup(groupId: string): Promise<GroupContext>
  getGroupContext(groupId: string): GroupContext | undefined
  getAllGroupContexts(): GroupContext[]
}
```

#### 1.3 Database Isolation Strategy
- **Personal DB**: Contains `Groups` table, user settings, device info
- **Group DBs**: Separate SQLite files per group (e.g., `group-${groupId}.db`)
- **TableFactory per Group**: Each group gets isolated table factory
- **DBProxy per Group**: Each group gets isolated database proxy

### Phase 2: Integration Points

#### 2.1 Update UserContext
```typescript
// src/context/user-context.ts
export class UserContext {
  public readonly groupManager: GroupManager
  public readonly activeGroup: Observable<GroupContext | undefined>
  
  // Initialize with personal group as default
  constructor(userDb: DBProxy) {
    this.groupManager = new GroupManager(this, userDb)
    // Create/load personal group
    // Load all groups from Groups table
  }
}
```

#### 2.2 Connection Virtualization (Simplified MVP)
For MVP, keep connections simple:
- Each group maintains its own connections 
- No sharing between groups initially
- Future: Add connection pooling/sharing

#### 2.3 Data Access Pattern
```typescript
// Usage pattern
const userContext = await getUserContext()
const activeGroup = userContext.activeGroup.value
if (activeGroup) {
  const messagesTable = await activeGroup.groupDb.getTableById('Messages')
  const messages = await messagesTable.list()
}
```

### Phase 3: User Experience

#### 3.1 Group Switching
```typescript
// Switch to different group
await userContext.groupManager.switchToGroup('group-123')

// The activeGroup observable will update
// UI components can react to group changes
```

#### 3.2 Group Creation/Joining
```typescript
// Create new group
const newGroup = await userContext.groupManager.createGroup('My Team')

// Join existing group (via invitation/group ID)
const existingGroup = await userContext.groupManager.joinGroup('group-456')
```

## Implementation Strategy

### MVP Scope (Keep It Simple)
1. **Basic group switching** - ability to change active group
2. **Data isolation** - each group has separate database
3. **Group persistence** - groups survive app restart
4. **Minimal UI integration** - observable patterns work with existing UI

### Not in MVP (Future Enhancements)
1. **Virtual connections** - share connections between groups
2. **Advanced permission system** - fine-grained access control  
3. **Group synchronization** - conflict resolution between devices
4. **Dependency injection refactor** - better isolation and testing
5. **Connection pooling** - optimize connection usage

## Database Structure

### Personal Database (`user-${userId}.db`)
- `Groups` table - registry of all groups user belongs to
- `PersistentVars` table - user preferences, device settings
- `Devices` table - known devices (shared across groups?)

### Group Databases (`group-${groupId}.db`)
- `Messages` table - group-specific messages
- `Files` table - group-specific files  
- `PersistentVars` table - group-specific settings
- `Channels` table - group-specific channels
- All other group-specific data tables

## Migration Strategy

1. **Existing users**: Create personal group from existing data
2. **Table factory**: Extend to support multiple instances
3. **Backward compatibility**: Ensure existing APIs continue working
4. **Gradual rollout**: Phase in group features incrementally

## Success Criteria

### MVP Complete When:
- ✅ User can switch between multiple groups
- ✅ Each group has isolated data storage
- ✅ Groups persist across app restarts  
- ✅ Basic group creation/joining works
- ✅ Existing single-group workflows unaffected

### Future Enhancements:
- Connection sharing between groups
- Advanced group management (permissions, invites)
- Better dependency injection architecture
- Performance optimizations
- Rich group UI features

## Implementation Notes

- **Start Small**: Focus on data isolation and basic switching
- **Extend Gradually**: Build on existing patterns rather than rewrite
- **Test Thoroughly**: Ensure no data leakage between groups
- **Document Changes**: Keep API changes minimal and well-documented
- **Performance**: Monitor database file proliferation, optimize later

This MVP provides the foundation for full Groups functionality while maintaining system stability and keeping changes focused.