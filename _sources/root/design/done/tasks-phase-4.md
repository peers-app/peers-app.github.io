# Phase 4: Conversation Panel (Right)

## Summary

Build the right panel: embed the existing `ThreadMessageList` component from peers-ui to display message threads associated with tasks. Include thread creation, thread switching, and empty states.

## Prerequisites

Phase 1 complete (layout shell, task schema with `threadIds` field). Phase 2 complete (task list populates `selectedTaskId`). Phase 3 recommended but not strictly required.

## Key Existing Components to Reuse

These components already exist in peers-ui and should be embedded, not recreated:

| Component | Location | Props |
|-----------|----------|-------|
| `ThreadMessageList` | `peers-ui/src/components/messages/thread-message-list.tsx` | `{ threadId: string, effects?, scrollChanged? }` |
| `MessageCompose` | `peers-ui/src/components/messages/message-compose.tsx` | `{ channelId, threadId?, onMessageSubmit }` |

`ThreadMessageList` includes `MessageCompose` internally, so embedding just `ThreadMessageList` gives us the full thread view with message composition.

## Files to Create

### 1. `peers-core/src/ui/panels/conversation-panel.tsx` — Right Panel

Displays the conversation thread associated with the selected task. Handles:
- No task selected → "Select a task" empty state
- Task selected, no threads → "Start a conversation" button
- Task selected, one thread → Embed `ThreadMessageList`
- Task selected, multiple threads → Thread switcher + `ThreadMessageList`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ITask, Tasks } from '../../data/tasks';
import { Messages, IMessage, newid, myUserId } from '@peers-app/peers-sdk';
import { selectedTaskId } from '../task-state';
// ThreadMessageList is in peers-ui — import at runtime
// The exact import path depends on how peers-ui exports are structured
// import { ThreadMessageList } from '@peers-app/peers-ui';

interface ConversationPanelProps {
  // ThreadMessageList component passed as prop to avoid cross-package import issues
  ThreadMessageList: React.ComponentType<{ threadId: string }>;
}

export function ConversationPanel({ ThreadMessageList }: ConversationPanelProps) {
  const [task, setTask] = useState<ITask | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Sync selected task ID
  useEffect(() => {
    selectedTaskId.loadingPromise.then(() => setTaskId(selectedTaskId() ?? null));
    const sub = selectedTaskId.subscribe(v => setTaskId(v ?? null));
    return () => sub.unsubscribe();
  }, []);

  // Load task when ID changes
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setActiveThreadId(null);
      return;
    }
    async function load() {
      const t = await Tasks().get(taskId!);
      setTask(t || null);
      // Set active thread to first thread, or null
      const threads = t?.threadIds || [];
      setActiveThreadId(threads.length > 0 ? threads[0] : null);
    }
    load();

    const sub = Tasks().dataChanged.subscribe((evt) => {
      if (evt.dataObject.taskId === taskId) load();
    });
    return () => sub.unsubscribe();
  }, [taskId]);

  // Create a new thread and link to task
  const handleStartConversation = useCallback(async () => {
    if (!task || creating) return;
    setCreating(true);

    try {
      // Create a thread parent message
      const threadParent: IMessage = {
        messageId: newid(),
        channelId: myUserId(), // Use user's own channel for task threads
        userId: myUserId(),
        message: `Thread for task: **${task.title}**`,
        createdAt: new Date(),
      };
      await Messages().save(threadParent);

      // Link thread to task
      const threadIds = [...(task.threadIds || []), threadParent.messageId];
      await Tasks().save({
        ...task,
        threadIds,
        updatedAt: new Date(),
      });

      setActiveThreadId(threadParent.messageId);
    } finally {
      setCreating(false);
    }
  }, [task, creating]);

  // --- Render states ---

  // No task selected
  if (!task) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 text-muted">
        <div className="text-center">
          <i className="bi bi-chat-dots d-block mb-2" style={{ fontSize: '2rem' }} />
          <p>Select a task to view its conversation</p>
        </div>
      </div>
    );
  }

  const threads = task.threadIds || [];

  // Task selected, no threads
  if (threads.length === 0 || !activeThreadId) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="text-center">
          <i className="bi bi-chat-dots d-block mb-2 text-muted" style={{ fontSize: '2rem' }} />
          <p className="text-muted mb-3">No conversation yet</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleStartConversation}
            disabled={creating}
          >
            {creating ? (
              <><span className="spinner-border spinner-border-sm me-1" /> Creating...</>
            ) : (
              <><i className="bi bi-plus me-1" /> Start conversation</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Task with thread(s)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Thread switcher (only if multiple threads) */}
      {threads.length > 1 && (
        <div className="d-flex align-items-center gap-2 px-2 py-1 border-bottom">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto', fontSize: '0.8rem' }}
            value={activeThreadId}
            onChange={(e) => setActiveThreadId(e.target.value)}
          >
            {threads.map((tid, i) => (
              <option key={tid} value={tid}>Thread {i + 1}</option>
            ))}
          </select>
          <button
            className="btn btn-sm btn-outline-secondary py-0"
            onClick={handleStartConversation}
            disabled={creating}
            title="New thread"
          >
            <i className="bi bi-plus" />
          </button>
        </div>
      )}

      {/* Thread message list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ThreadMessageList threadId={activeThreadId} />
      </div>
    </div>
  );
}
```

**Important: Cross-package import strategy**

`ThreadMessageList` lives in `peers-ui`, but `peers-core` may not have a direct import dependency on peers-ui. Two options:

**Option A — Pass as prop:** The parent `TasksScreen` component (in `tasks.tsx`) imports `ThreadMessageList` from peers-ui and passes it as a prop to `ConversationPanel`. Since `tasks.tsx` is in the `uis` bundle which runs in the peers-ui context, it should have access.

**Option B — Direct import:** If peers-core's webpack config allows importing from peers-ui (check the externals config), import directly. This is simpler but may not work depending on bundle boundaries.

Start with Option A (prop passing) as it's guaranteed to work. The `tasks.tsx` layout container handles the import.

## Files to Modify

### 2. `peers-core/src/ui/tasks.tsx` — Wire Conversation Panel

Replace the conversation placeholder with the real `ConversationPanel`. Import `ThreadMessageList` from peers-ui and pass it down.

```tsx
// At the top of tasks.tsx:
import { ConversationPanel } from './panels/conversation-panel';
// Import ThreadMessageList — exact path depends on peers-ui exports:
import { ThreadMessageList } from '@peers-app/peers-ui';
// OR if not available as a package export, the runtime may provide it differently.
// Fallback: use a dynamic import or check if it's on a global registry.

// In the right panel section, replace placeholder with:
<ConversationPanel ThreadMessageList={ThreadMessageList} />
```

## Thread Lifecycle

1. User selects a task in the left panel
2. Right panel checks `task.threadIds`
3. If empty: shows "Start conversation" button
4. User clicks button → creates a thread parent `IMessage` → saves to Messages table → adds messageId to `task.threadIds` → thread appears
5. User types in the `MessageCompose` input at the bottom of `ThreadMessageList` → messages save with `messageParentId = threadParent.messageId`
6. AI assistants can also reply to the thread (their messages have `assistantId` set)
7. If task has multiple threads: dropdown switcher lets user switch between them

## Verification

1. **Build:** `cd peers-core && npm run build` — compiles successfully
2. **No task selected:** Right panel shows "Select a task to view its conversation" empty state
3. **Task selected, no thread:** Right panel shows "No conversation yet" with "Start conversation" button
4. **Start conversation:** Click button — thread parent message is created, `ThreadMessageList` renders showing the thread parent and a message compose input
5. **Send message:** Type a message and send — it appears in the thread. This uses the existing messages infrastructure.
6. **Multiple threads:** If a task has multiple `threadIds`, a dropdown switcher appears at the top. Switching changes which thread is displayed.
7. **New thread on existing task:** The "+" button next to the switcher creates a new thread and adds it to `threadIds`
8. **Task change:** Select a different task — conversation panel updates to show that task's thread (or empty state)
9. **Reactive:** If a message is added to the thread from another context, it appears automatically (handled by `ThreadMessageList`'s internal `dataChanged` subscription)
