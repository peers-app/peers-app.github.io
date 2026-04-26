# Cross-Group Operations Test

## Overview

This document demonstrates how to use the updated table functions with optional `dataContext` parameters to perform cross-group operations.

## Test Patterns

### 1. Single Group Operations (Default Behavior)
```typescript
import { Messages, Users, getUserContext } from 'peers-sdk';

// Uses currently active group automatically
const messages = await Messages().list();
const users = await Users().list();

// This is equivalent to:
const userContext = await getUserContext();
const activeContext = userContext.currentlyActiveGroup();
const messagesFromActive = await Messages(activeContext).list();
```

### 2. Explicit Group Context Operations
```typescript
import { Messages, Users, getUserContext } from 'peers-sdk';

const userContext = await getUserContext();

// Get messages from personal group specifically
const personalContext = userContext.userDataContext;
const personalMessages = await Messages(personalContext).list();

// Get messages from a specific group
const teamContext = userContext.groupDataContexts.get('team-alpha-id');
if (teamContext) {
  const teamMessages = await Messages(teamContext).list();
}
```

### 3. Cross-Group Analysis
```typescript
import { Messages, Users, getUserContext } from 'peers-sdk';

async function analyzeMessagesAcrossGroups() {
  const userContext = await getUserContext();
  const results = new Map<string, any>();

  // Analyze personal messages
  const personalMessages = await Messages(userContext.userDataContext).list();
  results.set('personal', {
    groupName: 'Personal',
    messageCount: personalMessages.length,
    recentMessages: personalMessages.slice(0, 5)
  });

  // Analyze each group's messages
  for (const [groupId, groupContext] of userContext.groupDataContexts) {
    const groupMessages = await Messages(groupContext).list();
    results.set(groupId, {
      groupName: groupContext.dataContextId, // or get actual group name
      messageCount: groupMessages.length,
      recentMessages: groupMessages.slice(0, 5)
    });
  }

  return results;
}
```

### 4. Group Switching with Automatic Context Updates
```typescript
import { Messages, getUserContext } from 'peers-sdk';

async function demonstrateGroupSwitching() {
  const userContext = await getUserContext();

  // Switch to personal group
  userContext.currentlyActiveGroup(userContext.userDataContext);
  let messages = await Messages().list(); // Gets personal messages
  console.log(`Personal messages: ${messages.length}`);

  // Switch to team group
  const teamContext = userContext.groupDataContexts.get('team-alpha-id');
  if (teamContext) {
    userContext.currentlyActiveGroup(teamContext);
    messages = await Messages().list(); // Now gets team messages
    console.log(`Team messages: ${messages.length}`);
  }
}
```

### 5. Utility Function for Cross-Group Queries
```typescript
import { getUserContext, DataContext } from 'peers-sdk';

async function queryAllGroups<T>(
  tableQueryFn: (context: DataContext) => Promise<T[]>
): Promise<Map<string, { groupName: string; data: T[] }>> {
  const userContext = await getUserContext();
  const results = new Map();
  
  // Query personal context
  const personalData = await tableQueryFn(userContext.userDataContext);
  results.set('personal', {
    groupName: 'Personal',
    data: personalData
  });
  
  // Query all group contexts
  for (const [groupId, groupContext] of userContext.groupDataContexts) {
    const groupData = await tableQueryFn(groupContext);
    results.set(groupId, {
      groupName: groupContext.dataContextId,
      data: groupData
    });
  }
  
  return results;
}

// Usage examples:
const allMessages = await queryAllGroups((ctx) => Messages(ctx).list());
const allUsers = await queryAllGroups((ctx) => Users(ctx).list());
const allAssistants = await queryAllGroups((ctx) => Assistants(ctx).list());
```

## Validation Tests

### Test 1: Verify Default Behavior Still Works
```typescript
async function testDefaultBehavior() {
  try {
    // These should work exactly as before
    const messages = await Messages().list();
    const users = await Users().list();
    const assistants = await Assistants().list();
    
    console.log('✅ Default behavior test passed');
    return true;
  } catch (error) {
    console.error('❌ Default behavior test failed:', error);
    return false;
  }
}
```

### Test 2: Verify Explicit Context Works
```typescript
async function testExplicitContext() {
  try {
    const userContext = await getUserContext();
    
    // Test with personal context
    const personalMessages = await Messages(userContext.userDataContext).list();
    const personalUsers = await Users(userContext.userDataContext).list();
    
    // Test with group context if available
    if (userContext.groupDataContexts.size > 0) {
      const firstGroup = userContext.groupDataContexts.values().next().value;
      const groupMessages = await Messages(firstGroup).list();
      const groupUsers = await Users(firstGroup).list();
    }
    
    console.log('✅ Explicit context test passed');
    return true;
  } catch (error) {
    console.error('❌ Explicit context test failed:', error);
    return false;
  }
}
```

### Test 3: Verify Data Isolation
```typescript
async function testDataIsolation() {
  try {
    const userContext = await getUserContext();
    
    if (userContext.groupDataContexts.size === 0) {
      console.log('⚠️ No groups available for isolation test');
      return true;
    }
    
    // Get data from personal and first group context
    const personalMessages = await Messages(userContext.userDataContext).list();
    const firstGroup = userContext.groupDataContexts.values().next().value;
    const groupMessages = await Messages(firstGroup).list();
    
    // They should be different datasets (isolation test)
    const personalIds = personalMessages.map(m => m.messageId);
    const groupIds = groupMessages.map(m => m.messageId);
    const hasOverlap = personalIds.some(id => groupIds.includes(id));
    
    if (hasOverlap) {
      console.error('❌ Data isolation test failed: Found overlapping message IDs');
      return false;
    }
    
    console.log('✅ Data isolation test passed');
    return true;
  } catch (error) {
    console.error('❌ Data isolation test failed:', error);
    return false;
  }
}
```

## Running the Tests

```typescript
async function runAllTests() {
  console.log('🧪 Running Cross-Group Operations Tests...\n');
  
  const results = await Promise.all([
    testDefaultBehavior(),
    testExplicitContext(), 
    testDataIsolation()
  ]);
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Cross-group operations are working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the logs above.');
  }
}

// Run tests
runAllTests();
```

## Expected Benefits

After implementing these changes:

✅ **Backward Compatibility**: All existing code continues to work unchanged  
✅ **Cross-Group Queries**: Can explicitly query data from any group  
✅ **Data Isolation**: Each group's data is completely separate  
✅ **Context Switching**: Can change active group and all subsequent calls use new context  
✅ **Flexible Operations**: Can mix operations across groups in same function  

## Next Steps

With table functions now supporting optional `dataContext` parameters, the next phase is implementing:

1. **PeerDeviceManager** - Manage peer devices per group
2. **PeerGroupDevice** - Group-isolated peer device instances  
3. **Virtual Connection Manager** - Share connections between groups when appropriate
4. **Group Management UI** - Allow users to switch between groups

This foundation enables true multi-group functionality while maintaining the elegant existing API.