# Tab Close Selection Behavior

## Problem

When a tab is closed, peers-ui currently switches to the **last tab** in the tab array, regardless of which tab was closed. The desired behavior is browser-like: select the next tab to the right, or if the closed tab was the rightmost, select the tab to the left.

## Current Behavior

Both `closeCurrentTab()` in `tabs-state.ts` and `closeTab()` in `tabs-layout.tsx` use:
```ts
const newActiveTab = newTabs[newTabs.length - 1].tabId; // always picks last tab
```

## Desired Behavior

- Close tab at index N → activate the tab now at index N (previously at N+1, shifted left)
- If closed tab was rightmost → activate the tab now at index N-1 (the new last tab)
- If no tabs remain → fall back to `'launcher'`

This matches the behavior of browser tabs (Chrome, Firefox, etc.).

## Files to Change

Two places contain duplicate close logic that both need updating:

1. **`/Users/mark.archer/peers-app/peers-ui/src/tabs-layout/tabs-state.ts`**
   - Function: `closeCurrentTab()` (lines 256–275)

2. **`/Users/mark.archer/peers-app/peers-ui/src/tabs-layout/tabs-layout.tsx`**
   - Function: `closeTab()` inside `TabsLayoutInternal` (lines 157–173)

## New Selection Logic

```ts
// Find the index of the tab being closed (before filtering)
const closedIndex = currentTabs.findIndex(t => t.tabId === tabIdToClose);

// Remove the tab
const newTabs = currentTabs.filter(t => t.tabId !== tabIdToClose);

// Pick successor: prefer right neighbor, fall back to left neighbor
let newActiveTab: string;
if (newTabs.length === 0) {
  newActiveTab = 'launcher';
} else if (closedIndex < newTabs.length) {
  // A tab exists to the right (now shifted into closedIndex position)
  newActiveTab = newTabs[closedIndex].tabId;
} else {
  // Closed tab was rightmost — pick the new last tab
  newActiveTab = newTabs[newTabs.length - 1].tabId;
}
```

## Changes in Detail

### `tabs-state.ts` — `closeCurrentTab()`

**Before:**
```ts
export const closeCurrentTab = () => {
  const currentTabs = activeTabs();
  const _activeTabId = activeTabId();
  const tabToClose = currentTabs.find(t => t.tabId === _activeTabId);

  if (!tabToClose || tabToClose.tabId === "launcher") return;

  const newTabs = currentTabs.filter(t => t.tabId !== _activeTabId);
  activeTabs(newTabs);

  initializedTabs.delete(_activeTabId);

  // If closing active tab, switch to previous tab
  if (newTabs.length > 0) {
    const newActiveTab = newTabs[newTabs.length - 1].tabId;
    activeTabId(newActiveTab);
  } else {
    activeTabId('launcher');
  }
};
```

**After:**
```ts
export const closeCurrentTab = () => {
  const currentTabs = activeTabs();
  const _activeTabId = activeTabId();
  const tabToClose = currentTabs.find(t => t.tabId === _activeTabId);

  if (!tabToClose || tabToClose.tabId === "launcher") return;

  const closedIndex = currentTabs.findIndex(t => t.tabId === _activeTabId);
  const newTabs = currentTabs.filter(t => t.tabId !== _activeTabId);
  activeTabs(newTabs);
  initializedTabs.delete(_activeTabId);

  if (newTabs.length === 0) {
    activeTabId('launcher');
  } else if (closedIndex < newTabs.length) {
    activeTabId(newTabs[closedIndex].tabId);
  } else {
    activeTabId(newTabs[newTabs.length - 1].tabId);
  }
};
```

### `tabs-layout.tsx` — `closeTab()`

**Before:**
```ts
const closeTab = (tabId: string) => {
  const currentTabs = activeTabs();
  const tabToClose = currentTabs.find(t => t.tabId === tabId);

  if (!tabToClose || tabToClose.tabId === "launcher") return;

  const newTabs = currentTabs.filter(t => t.tabId !== tabId);
  activeTabs(newTabs);
  initializedTabs.delete(tabId);

  // If closing active tab, switch to previous tab
  if (activeTab === tabId) {
    const newActiveTab = newTabs.length > 0 ? newTabs[newTabs.length - 1].tabId : 'launcher';
    activeTabId(newActiveTab);
  }
};
```

**After:**
```ts
const closeTab = (tabId: string) => {
  const currentTabs = activeTabs();
  const tabToClose = currentTabs.find(t => t.tabId === tabId);

  if (!tabToClose || tabToClose.tabId === "launcher") return;

  const closedIndex = currentTabs.findIndex(t => t.tabId === tabId);
  const newTabs = currentTabs.filter(t => t.tabId !== tabId);
  activeTabs(newTabs);
  initializedTabs.delete(tabId);

  if (activeTab === tabId) {
    if (newTabs.length === 0) {
      activeTabId('launcher');
    } else if (closedIndex < newTabs.length) {
      activeTabId(newTabs[closedIndex].tabId);
    } else {
      activeTabId(newTabs[newTabs.length - 1].tabId);
    }
  }
};
```

## Notes

- The launcher tab (`tabId === 'launcher'`) cannot be closed — this is preserved.
- The `closeTab()` in `tabs-layout.tsx` only changes the active tab if the closed tab *was* the active tab. Non-active tab closes don't affect selection. This is correct behavior and is preserved.
- `closeCurrentTab()` in `tabs-state.ts` always closes the active tab by definition, so the guard `if (activeTab === tabId)` is implicit and not needed there.
- No other files need changes — the keyboard shortcut for closing tabs calls `closeCurrentTab()` directly, and the close buttons in both desktop and mobile UI call `closeTab()`.
