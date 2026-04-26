# Conversation Tab Implementation Plan

## Current State Analysis

### Existing Thread/Conversation System
The codebase has a robust thread/conversation system with the following components:

#### **Data Model**
- **IMessage interface** with hierarchical threading via `messageParentId`
- **Thread Logic**: Parent message + replies with same `messageParentId`
- **Channel Integration**: Threads exist within channels but are filtered from main channel view

#### **State Management**
```typescript
// Existing persistent variables in globals.tsx
openThreads: persistentVar<(string | IMessage)[]>  // Array of open thread IDs
threadViewOpen: persistentVar<boolean>              // Controls side panel visibility
openThread(thread): Function                        // Opens thread in side panel
```

#### **Existing Components**
- **ThreadContainer**: Main thread UI with tabbed interface for multiple threads
- **ThreadMessageList**: Displays messages within specific thread
- **MessageDisplay**: Individual message rendering with thread context
- **OpenThreads**: Dropdown for thread switching

#### **Current Limitations**
- ❌ No URL routing for threads (`/threads/[id]`)
- ❌ No standalone thread detail views (always side panel)
- ❌ No deep-linking to specific conversations
- ❌ No integration with tabs system

## Implementation Plan: Phase 1 - Conversation Tabs

### **Goal**: Integrate existing thread system with tabs architecture

### **Step 1: Thread Routing Integration**
Add thread detail routes to main Router component:

```typescript
// In router.tsx
if (path.match(/^threads\/([a-zA-Z0-9]{25})/)) {
  const threadId = path.split('/')[1];
  return <ThreadDetailView threadId={threadId} />;
}
```

### **Step 2: Create ThreadDetailView Component**
New component that renders thread as main content instead of side panel:

```typescript
// src/screens/threads/thread-details.tsx
export const ThreadDetails = (props: { threadId: string }) => {
  const thread = usePromise(async () => {
    const parentMessage = await Messages().get(props.threadId);
    if (!parentMessage) return null;
    updateActiveTabTitle(`Thread: ${parentMessage.message.slice(0, 30)}...`);
    return parentMessage;
  }, [props.threadId]);

  // Render thread messages in main content area
  return <ThreadMessageList threadId={props.threadId} />;
};
```

### **Step 3: Thread System App Enhancement**
Update the threads system app to support individual thread opening:

```typescript
// src/system-apps/threads.app.ts
export const threadsApp: IAppNav = {
  name: 'Threads',
  iconClassName: 'bi-cpu',
  navigationPath: 'shell', // Main shell for overview
  alwaysNewTab: false      // Allow switching to existing thread list
};

// New system app for individual conversations
export const conversationApp: IAppNav = {
  name: 'Conversation',
  iconClassName: 'bi-chat-dots',
  navigationPath: 'threads/',  // Will be dynamic per thread
  alwaysNewTab: true          // Each conversation gets its own tab
};
```

### **Step 4: Thread Opening Integration**
Modify existing `openThread()` function to support both side panel and tab modes:

```typescript
// Enhanced openThread function
const openThreadInTab = (threadId: string, messagePreview?: string) => {
  const threadPath = `threads/${threadId}`;
  const threadTitle = messagePreview 
    ? `Thread: ${messagePreview.slice(0, 30)}...`
    : 'Thread';

  // Open thread in new tab
  onOpenTab({
    packageId: 'system-apps',
    path: threadPath,
    title: threadTitle,
    iconClassName: 'bi-chat-dots',
    closable: true
  }, true); // Always new tab for threads
};
```

### **Step 5: State Migration Strategy**
**Option A: Merge openThreads into activeTabs**
- Convert existing `openThreads` entries to tab format
- Remove separate thread state management
- Rely on activeTabs for persistence

**Option B: Parallel Systems (Recommended Phase 1)**
- Keep existing `openThreads` for side panel (backwards compatibility)
- Add new tab-based thread opening
- Allow users to choose: quick side panel vs dedicated tab

### **Step 6: Thread List Enhancement**
Create a thread list view for the main "Threads" app:

```typescript
// src/screens/threads/thread-list.tsx
export const ThreadList = () => {
  // Show user's recent threads/conversations
  // Each thread gets "Open in Tab" button
  // Integration with search functionality
};
```

## Benefits of Tab-Based Threads

### **User Experience**
- **Multiple Conversations**: Several AI chats open simultaneously
- **Context Preservation**: Threads survive app reloads
- **Deep Linking**: Direct URLs to specific conversations  
- **Mobile Friendly**: Tabs work better than sliding panels on mobile

### **Technical Benefits**  
- **Consistent Architecture**: Threads follow same patterns as other detail screens
- **Dynamic Titles**: Smart titles showing conversation context
- **Search Integration**: Threads appear in app launcher search
- **Grid Layout Ready**: Perfect foundation for Phase 2 grid system

## Implementation Phases

### **Phase 1: Basic Thread Tabs** (This Plan)
- [ ] Add thread routing to Router component
- [ ] Create ThreadDetails component
- [ ] Update openThread function for tab support
- [ ] Add thread list view
- [ ] Update system apps configuration

### **Phase 2: State Unification**
- [ ] Migrate openThreads data to activeTabs
- [ ] Remove duplicate thread state management
- [ ] Enhance thread persistence and sync

### **Phase 3: Advanced Features**
- [ ] Thread search and filtering
- [ ] Conversation previews in app launcher
- [ ] Thread grouping and organization
- [ ] Integration with AI assistant selection

### **Phase 4: Grid Layout Integration** (Future)
- [ ] Split screen: content + conversation
- [ ] Multiple conversations in grid cells
- [ ] Flexible conversation positioning
- [ ] Context-aware conversation suggestions

## Technical Considerations

### **Thread ID Format**
- Existing thread IDs are message IDs (25-character strings)
- URL pattern: `/threads/[messageId]`
- Compatible with existing message lookup

### **Title Generation Strategy**
```typescript
const generateThreadTitle = (parentMessage: IMessage): string => {
  // Use first 30 characters of parent message
  const preview = parentMessage.message.slice(0, 30);
  return `Thread: ${preview}${parentMessage.message.length > 30 ? '...' : ''}`;
};
```

### **Integration Points**
- **Router**: Add thread routing patterns  
- **ThreadMessageList**: Reuse existing component
- **TabsLayout**: Thread tabs with conversation icons
- **App Launcher**: Threads searchable and launchable

## Migration Path

1. **Implement parallel systems** (old side panel + new tabs)
2. **User choice** during transition period
3. **Gradual migration** of state and preferences  
4. **Remove legacy** side panel system once tabs proven

This approach ensures no disruption to existing users while providing enhanced capabilities for power users who want multiple conversations open simultaneously.