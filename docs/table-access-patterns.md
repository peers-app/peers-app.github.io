# Table Access Patterns in Peers-App

## Overview

This document diagrams how tables are accessed across the peers-app codebase, showing the evolution from single-group patterns to the new multi-group architecture with cross-group operations support.

## New Multi-Group Architecture

```mermaid
graph TB
    %% Application Layer
    subgraph "Application Layer"
        UI["peers-ui<br/>React Components"]
        Electron["peers-electron<br/>Server Logic"]
        RN["peers-react-native<br/>Host Logic"]
    end
    
    %% Enhanced Table Functions
    subgraph "Enhanced Table Functions"
        TableFuncs["Table Functions<br/>Messages(ctx?), Users(ctx?)<br/>Tools(ctx?), Assistants(ctx?)"]
    end
    
    %% UserContext with Multi-Group Support
    subgraph "UserContext (Multi-Group Manager)"
        UserContext["UserContext"]
        ActiveGroup["currentlyActiveGroup<br/>(Observable)"]
        PersonalDC["userDataContext<br/>(Personal)"]
        GroupDCs["groupDataContexts<br/>(Map&lt;groupId, DataContext&gt;)"]
    end
    
    %% Group-Isolated Data Contexts  
    subgraph "Group-Isolated Data Contexts"
        PersonalContext["DataContext<br/>(Personal Group)"]
        TeamContext["DataContext<br/>(Team Alpha)"]
        ProjectContext["DataContext<br/>(Project Beta)"]
    end
    
    %% Group-Specific Infrastructure
    subgraph "Group-Specific Infrastructure"
        PersonalTF["TableFactory<br/>(Personal DB)"]
        TeamTF["TableFactory<br/>(Team DB)"] 
        ProjectTF["TableFactory<br/>(Project DB)"]
        
        PersonalTables["Tables<br/>(Personal)"]
        TeamTables["Tables<br/>(Team)"]
        ProjectTables["Tables<br/>(Project)"]
    end
    
    %% Data Layer
    subgraph "Data Layer"
        PersonalDB["personal.db"]
        TeamDB["group-team.db"]
        ProjectDB["group-project.db"]
    end
    
    %% Application → Table Functions
    UI -->|"await Messages().list()<br/>(uses active group)"| TableFuncs
    Electron -->|"await Users(teamCtx).get(id)<br/>(cross-group query)"| TableFuncs
    RN -->|"await Tools().save()<br/>(uses active group)"| TableFuncs
    
    %% Table Functions → Context Resolution
    TableFuncs -->|"getTableFactory(ctx?)"| UserContext
    
    %% UserContext Management
    UserContext --> ActiveGroup
    UserContext --> PersonalDC
    UserContext --> GroupDCs
    
    PersonalDC --> PersonalContext
    GroupDCs --> TeamContext
    GroupDCs --> ProjectContext
    
    %% Context → Infrastructure
    PersonalContext --> PersonalTF
    TeamContext --> TeamTF
    ProjectContext --> ProjectTF
    
    PersonalTF --> PersonalTables
    TeamTF --> TeamTables
    ProjectTF --> ProjectTables
    
    %% Infrastructure → Data
    PersonalTables --> PersonalDB
    TeamTables --> TeamDB
    ProjectTables --> ProjectDB
    
    %% Styling
    classDef solution fill:#e8f5e8,stroke:#2e7d32
    classDef manager fill:#e1f5fe,stroke:#0277bd
    classDef isolation fill:#f3e5f5,stroke:#7b1fa2
    classDef data fill:#fff3e0,stroke:#ef6c00
    
    class TableFuncs,UI,Electron,RN solution
    class UserContext,ActiveGroup,PersonalDC,GroupDCs manager
    class PersonalContext,TeamContext,ProjectContext,PersonalTF,TeamTF,ProjectTF isolation
    class PersonalTables,TeamTables,ProjectTables,PersonalDB,TeamDB,ProjectDB data
```

## New Access Patterns

### ✅ Pattern 1: Default Group Access (Backward Compatible)
```typescript
// In UI Components, Electron, React Native - UNCHANGED!
import { Messages, Users, Assistants } from 'peers-sdk';

// Uses currently active group automatically
const messages = await Messages().list({ channelId: 'channel-123' });
const user = await Users().get('user-456');
const assistant = await Assistants().save(newAssistant);
```

**Benefits:**
- ✅ **Zero breaking changes** - all existing code works unchanged
- ✅ **Active group context** - automatically uses currently selected group
- ✅ **Observable switching** - UI updates when user switches groups
- ✅ **Data isolation** - each group has separate database

### ✅ Pattern 2: Cross-Group Access (New Capability)
```typescript
// In any component/service
import { Messages, Users, getUserContext } from 'peers-sdk';

async function analyzeAcrossGroups() {
  const userContext = await getUserContext();
  
  // Get data from personal group
  const personalMessages = await Messages(userContext.userDataContext).list();
  
  // Get data from specific groups
  for (const [groupId, groupContext] of userContext.groupDataContexts) {
    const groupMessages = await Messages(groupContext).list();
    console.log(`Group ${groupId}: ${groupMessages.length} messages`);
  }
}
```

**Benefits:**
- ✅ **Explicit context passing** - specify which group's data to access
- ✅ **Cross-group analysis** - compare data across multiple groups
- ✅ **Data isolation maintained** - each context accesses separate database

### ✅ Pattern 3: Group Switching (Observable Context)
```typescript
// In UI or business logic
import { getUserContext } from 'peers-sdk';

async function switchToTeamGroup() {
  const userContext = await getUserContext();
  const teamContext = userContext.groupDataContexts.get('team-alpha-id');
  
  if (teamContext) {
    // Switch active group - all subsequent table calls use this group
    userContext.currentlyActiveGroup(teamContext);
    
    // Now all default table calls use team context
    const teamMessages = await Messages().list(); // Team's messages
    const teamUsers = await Users().list();       // Team's users
  }
}
```

**Benefits:**
- ✅ **Seamless switching** - change active group with one call
- ✅ **Automatic context update** - all table calls use new active group
- ✅ **Observable pattern** - UI can react to group changes
- ✅ **Persistent selection** - active group persists across app restarts

## Implementation Results

### ✅ Implemented: Multi-Group Architecture
```mermaid
graph LR
    subgraph "✅ Current: Multi-Group Support"
        App1["peers-ui"] --> TF["Table Functions<br/>Messages(ctx?), Users(ctx?)"]
        App2["peers-electron"] --> TF
        App3["peers-react-native"] --> TF
        
        TF --> UC["UserContext<br/>(Group Manager)"]
        UC --> GC1["DataContext<br/>Personal"]
        UC --> GC2["DataContext<br/>Team Alpha"] 
        UC --> GC3["DataContext<br/>Project Beta"]
        
        GC1 --> DB1["personal.db"]
        GC2 --> DB2["group-team.db"]
        GC3 --> DB3["group-project.db"]
    end
    
    classDef solution fill:#e8f5e8,stroke:#2e7d32
    class TF,UC,GC1,GC2,GC3 solution
```

### ✅ Benefits Achieved
- **Zero Breaking Changes**: All existing code continues working
- **Group Isolation**: Each group has separate database and table instances  
- **Context Switching**: Change active group seamlessly with observable
- **Cross-Group Operations**: Query data from multiple groups simultaneously
- **Data Security**: No possibility of data leakage between groups

## Implementation Details

### ✅ Step 1: Enhanced Table Functions
All 25+ table functions now support optional context parameter:

```typescript
// Updated function signatures
export function Messages(dataContext?: DataContext) {
  return getTableFactory(dataContext).getTable<IMessage>(metaData, messageSchema);
}

export function Users(dataContext?: DataContext) {
  return getTableFactory(dataContext).getTable<IUser>(metaData, userSchema);
}

// Pattern applied to all: Assistants, Tools, Workflows, Groups, etc.
```

### ✅ Step 2: UserContext as Group Manager
```typescript
// UserContext manages multiple group contexts
export class UserContext {
  public readonly userDataContext: DataContext;                    // Personal group
  public readonly groupDataContexts: Map<string, DataContext>;     // All other groups  
  public readonly currentlyActiveGroup: Observable<DataContext>;   // Currently active
  
  // Context switching
  async switchToGroup(groupId: string) {
    const context = this.groupDataContexts.get(groupId) || this.userDataContext;
    this.currentlyActiveGroup(context);
  }
}
```

### ✅ Step 3: Seamless Context Resolution
```typescript
// getTableFactory automatically resolves context
export function getTableFactory(dataContext?: DataContext) {
  dataContext ??= userContextInstance!.currentlyActiveGroup();
  return dataContext.tableFactory;
}

// Table functions use this resolution
const messages = await Messages().list();        // Uses active group
const personalMessages = await Messages(personalContext).list(); // Explicit group
```

## Usage Examples

### Example 1: Default Usage (Unchanged)
```typescript
// Existing code works exactly the same
import { Messages, Users, Assistants } from 'peers-sdk';

async function processMessage(messageId: string) {
  const message = await Messages().get(messageId);      // Uses active group
  const user = await Users().get(message.userId);       // Uses active group  
  const assistant = await Assistants().get(message.assistantId); // Uses active group
}
```

### Example 2: Cross-Group Analysis
```typescript
// New capability - analyze data across all groups
import { Messages, getUserContext } from 'peers-sdk';

async function getMessageCountsByGroup() {
  const userContext = await getUserContext();
  const results = new Map();
  
  // Personal messages
  const personalMessages = await Messages(userContext.userDataContext).list();
  results.set('personal', personalMessages.length);
  
  // Group messages
  for (const [groupId, groupContext] of userContext.groupDataContexts) {
    const groupMessages = await Messages(groupContext).list();
    results.set(groupId, groupMessages.length);
  }
  
  return results;
}
```

### Example 3: Group Switching
```typescript
// Switch active group - all subsequent calls use new group
import { Messages, getUserContext } from 'peers-sdk';

async function switchToTeamAndGetMessages() {
  const userContext = await getUserContext();
  
  // Switch to team group
  const teamContext = userContext.groupDataContexts.get('team-id');
  if (teamContext) {
    userContext.currentlyActiveGroup(teamContext);
  }
  
  // All table calls now use team context automatically
  const teamMessages = await Messages().list();
  const teamUsers = await Users().list();
  
  return { teamMessages, teamUsers };
}
```

## Achieved Benefits

- ✅ **Zero Breaking Changes**: All existing code continues working unchanged
- ✅ **Group Isolation**: Each group has completely separate database and tables
- ✅ **Context Switching**: Seamless switching between groups with observable pattern
- ✅ **Cross-Group Operations**: Query and analyze data across multiple groups
- ✅ **Backward Compatibility**: Gradual adoption - teams can use new features when needed
- ✅ **Data Security**: Impossible for data to leak between groups
- ✅ **Performance**: Each group database optimized independently
- ✅ **Testability**: Easy to create isolated test contexts

## Files Updated

### ✅ Core Table Functions (All Updated)
All 25+ table function files in `peers-sdk/src/data/` now support optional `dataContext` parameter:

**High-Usage Functions:**
- ✅ `Messages(dataContext?)` - Chat and communication
- ✅ `Users(dataContext?)` - User management  
- ✅ `Assistants(dataContext?)` - AI assistant data
- ✅ `Tools(dataContext?)` - Tool definitions and execution
- ✅ `Workflows(dataContext?)` - Process automation
- ✅ `Groups(dataContext?)` - Group management

**Supporting Functions:**
- ✅ `Channels(dataContext?)` - Communication channels
- ✅ `Devices(dataContext?)` - Device management
- ✅ `Files(dataContext?)` - File storage and management
- ✅ `Packages(dataContext?)` - Package management
- ✅ `WorkflowRuns(dataContext?)` - Workflow execution
- ✅ `PeerEvents(dataContext?)` - Event handling
- ✅ `Embeddings(dataContext?)` - Vector embeddings
- ✅ `KnowledgeFrames(dataContext?)` - Knowledge management
- ✅ And 10+ more supporting table functions

### ✅ Zero Application Code Changes Required
- ✅ **50+ existing files** in peers-ui, peers-electron, peers-react-native continue working unchanged
- ✅ **Backward compatibility** maintained across entire codebase
- ✅ **Optional adoption** - teams can start using cross-group features when needed

## Next Steps

With table functions now supporting multi-group operations, the foundation is ready for:

### Phase 1: PeerDevice Group Architecture
1. **PeerDeviceManager** - Manage peer devices per group
2. **PeerGroupDevice** - Group-isolated peer device instances
3. **Virtual Connection Manager** - Share connections efficiently between groups

### Phase 2: Groups MVP UI
1. **Group switching interface** - Allow users to switch between groups
2. **Group creation/joining** - UI for group management  
3. **Cross-group features** - Analytics and data views across groups

### Phase 3: Advanced Features
1. **Group permissions** - Fine-grained access control
2. **Group synchronization** - Optimize sync performance per group
3. **Group analytics** - Rich insights and reporting

## Summary

The table access patterns have been successfully evolved from single-group to multi-group architecture while maintaining 100% backward compatibility. All existing code continues working unchanged, while new cross-group capabilities are now available for teams ready to adopt them.