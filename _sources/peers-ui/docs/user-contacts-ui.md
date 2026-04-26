# Contacts System App - Implementation Plan

## Overview

The Contacts system app provides a unified interface for managing and viewing all users that the current user knows about, aggregated from both their personal database and all group databases they're a member of.

## Key Features

### **📋 Unified User Directory**
- **Personal Contacts**: Users stored in the user's personal `Users` table
- **Group Contacts**: Users discovered from `Users` tables across all joined groups
- **Deduplication**: Each user appears only once, prioritizing personal contacts over group contacts
- **Efficient Loading**: Cursor-based lazy loading to handle thousands of users

### **🔍 Smart Aggregation Strategy**
1. **Primary Source**: Load users from personal `Users` table first
2. **Secondary Sources**: Load users from group `Users` tables
3. **Deduplication Logic**: Skip users already shown from personal context
4. **Visual Separation**: Horizontal divider between personal and group-discovered users

## System App Definition

### **App Registration**
```typescript
// src/system-apps/contacts.app.ts
export const contactsApp: IAppNav = {
  name: 'Contacts',
  displayName: 'Contacts',
  iconClassName: 'bi-person-fill-check',
  navigationPath: 'contacts'
};
```

### **Integration**
- Add to `systemApps` array in Core Management Apps section
- Register routes using modern `registerInternalPeersUI` system

## UI Architecture

### **Component Structure**
```
src/screens/contacts/
├── index.ts                    # Component imports and exports
├── contact-list.tsx           # Main list screen with lazy loading
└── contact-details.tsx        # Individual contact profile view (future)
```

### **List Screen Design**
```typescript
// Main component structure
export const ContactList = () => {
  return (
    <div className="container-fluid p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>
          <i className="bi-person-fill-check me-2" />
          Contacts
        </h4>
        <UserStats />
      </div>
      
      <SearchAndFilter />
      <LazyUserList />
    </div>
  );
};
```

## Data Loading Strategy

### **Cursor-Based Lazy Loading**
Using `LazyScrollableList` component (following existing patterns):

```typescript
// Load personal users first
const personalUsersLoader = async (cursor?: string, limit = 50) => {
  const userContext = await getUserContext();
  const personalUsersTable = Users(userContext.userDataContext);
  
  return await personalUsersTable.list({
    // Exclude current user
    userId: { $ne: userContext.userId() }
  }, {
    cursor,
    limit,
    sortBy: ['name']
  });
};

// Load group users after personal users exhausted
const groupUsersLoader = async (cursor?: string, limit = 50) => {
  const userContext = await getUserContext();
  const groups = await Groups(userContext.userDataContext).list({});
  
  // Aggregate users from all group contexts
  const allGroupUsers = [];
  for (const group of groups) {
    const groupDataContext = userContext.getDataContext(group.groupId);
    const groupUsersTable = Users(groupDataContext);
    const groupUsers = await groupUsersTable.list({}, { cursor, limit });
    allGroupUsers.push(...groupUsers.map(u => ({ ...u, sourceGroupId: group.groupId })));
  }
  
  return deduplicateUsers(allGroupUsers);
};
```

### **Deduplication Logic**
```typescript
interface UserWithSource extends IUser {
  sourceType: 'personal' | 'group';
  sourceGroupId?: string;
  sourceGroupName?: string;
}

const deduplicateUsers = (users: IUser[], seenUserIds: Set<string>) => {
  return users.filter(user => {
    if (seenUserIds.has(user.userId)) {
      return false; // Skip already seen users
    }
    seenUserIds.add(user.userId);
    return true;
  });
};
```

## UI Components

### **UserCard Component**
```typescript
interface UserCardProps {
  user: UserWithSource;
  isCurrentUser: boolean;
  onViewDetails?: (userId: string) => void;
}

const UserCard = ({ user, isCurrentUser }: UserCardProps) => (
  <div className="list-group-item d-flex align-items-center justify-content-between">
    <div className="d-flex align-items-center">
      <i className="bi-person-circle me-3" style={{ fontSize: '32px' }} />
      <div>
        <strong>
          {user.name}
          {isCurrentUser && ' (You)'}
        </strong>
        <div className="d-flex align-items-center">
          <small className="text-muted">{user.userId}</small>
          {user.sourceType === 'group' && (
            <>
              <span className="mx-1">•</span>
              <small className="text-primary">
                From: {user.sourceGroupName}
              </small>
            </>
          )}
        </div>
      </div>
    </div>
    
    <div className="d-flex align-items-center">
      {user.trustLevel && (
        <TrustLevelBadge level={user.trustLevel} />
      )}
      <button className="btn btn-outline-primary btn-sm ms-2">
        View Details
      </button>
    </div>
  </div>
);
```

### **Section Headers**
```typescript
const SectionHeader = ({ title, icon, count }: SectionHeaderProps) => (
  <div className="d-flex align-items-center justify-content-between mb-3 mt-4">
    <h6 className="mb-0">
      <i className={`${icon} me-2`} />
      {title}
    </h6>
    <span className="badge bg-secondary">{count}</span>
  </div>
);

// Usage
<SectionHeader 
  title="Personal Contacts" 
  icon="bi-person-fill" 
  count={personalUsers.length} 
/>

<hr className="my-4" /> {/* Separator */}

<SectionHeader 
  title="Group Contacts" 
  icon="bi-people-fill" 
  count={groupUsers.length} 
/>
```

## Performance Optimizations

### **Lazy Loading Implementation**
```typescript
const LazyUserList = () => {
  const [personalUsersComplete, setPersonalUsersComplete] = useState(false);
  const [seenUserIds] = useState(new Set<string>());

  return (
    <div>
      {/* Personal Users Section */}
      <LazyScrollableList
        loader={personalUsersLoader}
        renderItem={(user) => (
          <UserCard 
            user={{ ...user, sourceType: 'personal' }} 
            isCurrentUser={user.userId === currentUserId}
          />
        )}
        onComplete={() => setPersonalUsersComplete(true)}
        onUserLoad={(user) => seenUserIds.add(user.userId)}
      />

      {/* Separator when personal users complete */}
      {personalUsersComplete && (
        <>
          <hr className="my-4" />
          <SectionHeader title="Group Contacts" icon="bi-people-fill" />
        </>
      )}

      {/* Group Users Section */}
      {personalUsersComplete && (
        <LazyScrollableList
          loader={(cursor, limit) => groupUsersLoader(cursor, limit, seenUserIds)}
          renderItem={(user) => (
            <UserCard 
              user={{ ...user, sourceType: 'group' }} 
              isCurrentUser={user.userId === currentUserId}
            />
          )}
        />
      )}
    </div>
  );
};
```

### **Search and Filtering**
```typescript
const SearchAndFilter = ({ onFilter }: SearchAndFilterProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'personal' | 'group'>('all');

  return (
    <div className="row g-2 mb-4">
      <div className="col-md-8">
        <div className="position-relative">
          <i className="bi-search position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search contacts by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>
      <div className="col-md-4">
        <select 
          className="form-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as any)}
        >
          <option value="all">All Contacts</option>
          <option value="personal">Personal Only</option>
          <option value="group">Group Only</option>
        </select>
      </div>
    </div>
  );
};
```

## User Statistics

### **Summary Component**
```typescript
const UserStats = () => {
  const stats = usePromise(async () => {
    const userContext = await getUserContext();
    
    const personalCount = await Users(userContext.userDataContext).count({
      userId: { $ne: userContext.userId() }
    });
    
    const groups = await Groups(userContext.userDataContext).list({});
    let groupUsersCount = 0;
    const uniqueGroupUsers = new Set<string>();
    
    for (const group of groups) {
      const groupDataContext = userContext.getDataContext(group.groupId);
      const groupUsers = await Users(groupDataContext).list({});
      groupUsers.forEach(u => uniqueGroupUsers.add(u.userId));
    }
    
    return {
      personalContacts: personalCount,
      groupContacts: uniqueGroupUsers.size,
      totalGroups: groups.length
    };
  });

  if (!stats) return null;

  return (
    <div className="d-flex gap-3">
      <span className="badge bg-primary">{stats.personalContacts} Personal</span>
      <span className="badge bg-secondary">{stats.groupContacts} From Groups</span>
      <span className="badge bg-info">{stats.totalGroups} Groups</span>
    </div>
  );
};
```

## Trust Level Integration

### **Trust Level Badge**
```typescript
const TrustLevelBadge = ({ level }: { level: TrustLevel }) => {
  const config = {
    [TrustLevel.Trusted]: { color: 'success', icon: 'bi-shield-check', text: 'Trusted' },
    [TrustLevel.Unknown]: { color: 'warning', icon: 'bi-shield-exclamation', text: 'Unknown' },
    [TrustLevel.Blocked]: { color: 'danger', icon: 'bi-shield-x', text: 'Blocked' }
  }[level];

  return (
    <span className={`badge bg-${config.color} d-flex align-items-center gap-1`}>
      <i className={config.icon} />
      {config.text}
    </span>
  );
};
```

## Future Enhancements

### **Phase 2 Features**
- **Contact Details View**: Comprehensive user profiles with interaction history
- **Trust Level Management**: Update trust levels and manage blocked users  
- **Contact Actions**: Message, invite to groups, share contacts
- **Advanced Search**: Filter by trust level, group membership, recent activity

### **Phase 3 Features**
- **Contact Import/Export**: Sync with external contact systems
- **Relationship Mapping**: Visualize user connections across groups
- **Activity Tracking**: Show recent interactions and shared content
- **Bulk Operations**: Manage multiple contacts simultaneously

## Implementation Checklist

### **Core Implementation**
- [ ] Create `contacts.app.ts` system app definition
- [ ] Add to systemApps array and router integration
- [ ] Implement `ContactList` component with lazy loading
- [ ] Create `UserCard` component with source attribution
- [ ] Implement cursor-based loading for personal users
- [ ] Implement cursor-based loading for group users
- [ ] Add deduplication logic with Set-based tracking

### **UI Polish**
- [ ] Add search and filtering functionality
- [ ] Implement user statistics summary
- [ ] Add section headers and visual separators
- [ ] Integrate trust level badges
- [ ] Add responsive design for mobile

### **Performance**
- [ ] Implement lazy scrollable list with virtualization
- [ ] Add proper loading states and error handling
- [ ] Optimize group user aggregation queries
- [ ] Add caching for expensive group discovery operations

This implementation will provide a comprehensive, performant contacts system that scales to thousands of users while maintaining a clean, intuitive interface.