# Tabs-Based UI Redesign Plan

## Current State
- Existing UI has left/right sidebars and a non-functional top bar
- Need to redesign for better user experience and app management

## Vision: Tabs-Based Interface

### Core Concept
Transform the current layout into a modern tabs-based interface that provides:
- Intuitive app discovery and management
- Multiple concurrent app instances
- Cross-app navigation and integration

### UI Structure

#### App Launcher Tab (Always Present)
The leftmost tab serves as the central app hub with organized sections:

1. **Recently Used** - Quick access to frequently opened apps
2. **User Apps** - Custom/third-party applications
3. **System Apps** - Core platform functionality
4. **Suggested Apps** - Recommendations based on usage patterns

#### Dynamic Tabs
- Each app opens in its own tab
- Apps can spawn multiple tabs (not limited to one instance)
- Cross-app linking: apps can open/reference tabs from other apps
- Visual identification via app-specific icons

### App Categories

**System Apps:**
- Users management
- Groups management
- Device management
- Connection management
- Workflow builder
- Event monitoring

**User Apps:**
- Task management
- Knowledge base (second brain)
- Games
- Story creator
- Social features

## Implementation Approach

### Leveraging Existing Architecture
The current system provides excellent foundation:
- **Package System:** `IPackage` interface with `appNavs[]` for app icons
- **Dynamic Loading:** `routes-loader.ts` and `ui-loader.tsx` for component loading  
- **UI Router:** Existing `UIRouter` for component resolution
- **Layout System:** `ThreeBarLayout` as reference for responsive design

### New Top-Level Entry Point: `tabs-layout.tsx`
Create a complete standalone layout component:
- Serves as the primary UI entry point for the entire application
- Implements tabs-based interface using current package system
- Leverages `allPackages()` observable for app discovery
- Uses existing `UIRouter` for tab content rendering

### Technology Stack
- **Framework:** React with existing hooks (`useObservable`, `usePromise`)
- **Styling:** Bootstrap (consistent with current system)
- **Icons:** Package `appNavs[].iconClassName` for tab identification
- **State:** Observable-based state management (peers-sdk pattern)

### Component Architecture

#### Core Components
```
tabs-layout.tsx
├── TabsContainer
│   ├── AppLauncherTab (always visible)
│   │   ├── RecentlyUsedSection
│   │   ├── UserAppsSection  
│   │   ├── SystemAppsSection
│   │   └── SuggestedAppsSection
│   └── DynamicTabs[]
│       ├── TabHeader (with icon + close)
│       └── TabContent (UIRouter)
└── TabsState (observables for active tabs)
```

#### Integration Points
- **Package Discovery:** Use `allPackages()` from `routes-loader.ts`
- **Content Rendering:** Use `UIRouter` from `ui-loader.tsx` 
- **Navigation:** Integrate with `globals.mainContentPath` observable
- **Icons:** Extract from package `appNavs[].iconClassName`

### Development Phases

#### Phase 1: Basic Tabs Infrastructure
- Create `tabs-layout.tsx` component
- Implement tab container with basic open/close
- Create app launcher tab with package listing
- Basic navigation between tabs

#### Phase 2: Package Integration  
- Load packages via `allPackages()` observable
- Extract app icons from `appNavs[]`
- Integrate `UIRouter` for tab content
- Implement cross-app tab opening

#### Phase 3: Enhanced Features
- Recently used tracking (extend package metadata)
- App suggestions based on usage patterns
- Tab state persistence in localStorage
- Keyboard shortcuts for tab navigation

#### Phase 4: Advanced Layout (Future)
- Grid-based layout within tabs
- Configurable app routes as tab components  
- Save/restore tab configurations
- Split-screen tab arrangements

## Technical Implementation Details

### State Management
```typescript
// Observable-based tab state
const activeTabs = observable<TabState[]>([]);
const activeTabId = observable<string>('launcher');
const recentlyUsedApps = observable<string[]>([]);

interface TabState {
  tabId: string;
  packageId?: string; // 'launcher' for app launcher tab
  path: string;
  title: string;
  iconClassName?: string;
  closable: boolean;
}
```

### Package Integration
```typescript
// Leverage existing package system
const [packages] = useObservable(allPackages);
const appPackages = packages.filter(p => !p.disabled && p.appNavs?.length);

// App categorization
const systemApps = appPackages.filter(p => isSystemApp(p.name));
const userApps = appPackages.filter(p => !isSystemApp(p.name));
```

### Content Rendering
```typescript
// Use existing UIRouter for tab content
const renderTabContent = (tab: TabState) => {
  if (tab.packageId === 'launcher') {
    return <AppLauncherContent />;
  }
  return <UIRouter path={tab.path} uiCategory="screen" props={{}} />;
};
```

### Performance Considerations
- **Lazy Tab Loading:** Only render active tab content
- **Package Caching:** Leverage existing bundle loading cache
- **Memory Management:** Cleanup inactive tabs after threshold
- **Efficient Re-rendering:** Use React.memo for tab components

### User Experience
- **Familiar Navigation:** Bootstrap tab styling for consistency  
- **Visual Feedback:** Loading states during package loading
- **Responsive Design:** Mobile-friendly tab overflow handling
- **Keyboard Support:** Tab switching with Ctrl+Tab, etc.

## Application Entry Point

### Complete UI Replacement
- **`tabs-layout.tsx`:** New primary layout component
- **Direct Integration:** Replace existing layout in App.tsx
- **Standalone System:** Self-contained tabs-based interface

### Integration Points
- **App.tsx:** Use `TabsLayout` as main component
- **Route Loading:** Reuse existing `routes-loader.ts`
- **Package System:** Leverage current `allPackages()` observable
- **UI Components:** Reuse via existing `UIRouter`

## Implementation Status

✅ **COMPLETED** - Tabs-based UI has been fully implemented and integrated:

### What's Done
1. **Complete TabsLayout Component** (`src/tabs-layout/tabs-layout.tsx`)
   - Full tabs-based interface replacing three-bar layout
   - App launcher tab with categorized app discovery
   - Dynamic tab management (open/close/switch)
   - **Multiple App Instances**: Apps can be opened in multiple tabs simultaneously
   - Integration with existing UIRouter for content rendering

2. **Persistent State Management**
   - `activeTabs`: Device-scoped persistent variable storing tab states
   - `activeTabId`: Device-scoped active tab tracking
   - `recentlyUsedApps`: User-scoped recently used apps (syncs across devices)
   - All state persists between application reloads

3. **App Discovery & Categorization**
   - **Nav Item-Based Apps**: Each `navItem` in packages becomes an individual app
   - **Built-in System Apps**: Core system functionality (Assistants, Tools, Workflows, etc.)
   - Automatic package discovery via `allPackages()` observable
   - Smart categorization: Recently Used, User Apps, System Apps
   - Icon and metadata extraction from `appNavs[]` (name, iconClassName, navigationPath)
   - **Multi-App Packages**: Packages with multiple nav items show multiple app icons
   - **Dual Path Routing**: Direct paths for system apps, `package-nav/` format for packages

4. **UI/UX Features**
   - Bootstrap-based responsive design with mobile optimization
   - Browser-style compact tabs with minimal UI footprint (36px height)
   - Mobile-friendly dropdown tab switcher
   - Home screen style app launcher with theme-aware icons
   - Keyboard-friendly navigation
   - Loading states during package discovery
   - Full color mode support (light/dark themes)
   - Adaptive layouts for desktop and mobile

5. **Integration Complete**
   - `App.tsx` updated to use TabsLayout as primary component
   - **System Apps Integration**: All left-bar functionality now available as individual apps
   - Leverages existing infrastructure (UIRouter, routes-loader, package system)
   - No breaking changes to existing package/route system
   - **Modular App Structure**: Each system app defined in separate `.app.ts` files

### Technical Implementation

#### Persistent State Management
```typescript
// Database-backed persistent variables
export const activeTabs = persistentVar<TabState[]>('activeTabs', {
  defaultValue: [launcherTab],
  scope: 'device'  // Per-device tab states
});

export const activeTabId = persistentVar<string>('activeTabId', {
  defaultValue: 'launcher',
  scope: 'device'
});

export const recentlyUsedApps = persistentVar<string[]>('recentlyUsedApps', {
  defaultValue: [],
  scope: 'user'  // Syncs across user's devices
});
```

#### System Apps Integration
```typescript
// Individual system app definitions
export const assistantsApp: IAppNav = {
  name: 'Assistants',
  iconClassName: 'bi-person-fill-gear',
  navigationPath: 'assistants'
};

// Virtual system package containing all system apps
export const systemPackage = {
  packageId: 'system-apps',
  name: 'System Apps',
  appNavs: [assistantsApp, toolsApp, workflowsApp, /* ... */],
  hasUIBundle: false // Uses existing router
};

// Combined package discovery with system apps
const allPackages_ = [...packages, systemPackage];
```

#### Nav Item-Based App Discovery
```typescript
// Transform all packages (including system) into individual nav item apps
const allApps: AppItem[] = allPackages_
  .filter(p => !p.disabled && p.appNavs && p.appNavs.length > 0)
  .flatMap(pkg => 
    pkg.appNavs!.map(navItem => {
      // Dual path handling: direct for system apps, package-nav for others
      let path: string;
      if (pkg.packageId === 'system-apps') {
        // System apps use direct routing (assistants, tools, etc.)
        path = navItem.navigationPath ?? navItem.name.replace(/\s/g, '-').toLowerCase();
      } else {
        // Regular packages use package-nav format
        path = `package-nav/${pkg.packageId}/${(navItem.navigationPath ?? navItem.name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        while (path.includes('//')) path = path.replace('//', '/');
      }
      
      return {
        packageId: pkg.packageId,
        packageName: pkg.name,
        navItem, path, name: navItem.name,
        iconClassName: navItem.iconClassName || 'bi-box-seam'
      };
    })
  );

// Multiple instance tab opening
const openTab = (tab: Omit<TabState, 'tabId'>, forceNew = false) => {
  const newTab: TabState = {
    ...tab,
    tabId: `${tab.packageId || 'tab'}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  };

  if (forceNew) {
    // Always create new tab (app launcher behavior)
    activeTabs([...currentTabs, newTab]);
    activeTabId(newTab.tabId);
  } else {
    // Reuse existing tab if available (internal navigation)
    const existingTab = currentTabs.find(t => t.path === tab.path);
    if (existingTab) {
      activeTabId(existingTab.tabId);
    } else {
      activeTabs([...currentTabs, newTab]);
      activeTabId(newTab.tabId);
    }
  }
};
```

#### Theme-Aware Component Design
```typescript
// Dynamic theming for app icons
const AppCard = ({ appItem, isMobile }) => {
  const [colorMode] = useObservable(colorMode);
  const isDark = colorMode === 'dark';
  
  return (
    <div style={{
      backgroundColor: isDark ? '#343a40' : '#f8f9fa',
      border: `1px solid ${isDark ? '#495057' : '#e9ecef'}`,
      boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.08)'
    }}>
      <i className={appItem.iconClassName} style={{ color: '#0d6efd' }} />
      <span>{appItem.name}</span>
    </div>
  );
};
```

#### Browser-Style Tab Rendering
```typescript
// Professional tab styling with elevation
const TabHeader = ({ isActive, colorMode }) => (
  <div style={{
    height: '34px',
    borderRadius: isActive ? '6px 6px 0 0' : '0',
    borderTop: isActive ? '2px solid #0d6efd' : 'transparent',
    marginBottom: isActive ? '-1px' : '0',
    zIndex: isActive ? 1 : 0,
    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
  }} />
);
```

### Key Architecture Benefits
- **Zero Migration Required**: Complete standalone replacement
- **Persistent User Experience**: Tab states survive app restarts
- **Nav Item-Driven**: Each package nav item becomes an individual app
- **Complete System Integration**: All core system functions accessible as apps
- **Granular App Access**: Direct access to specific package features
- **Multiple Instances**: Same app can be opened in multiple tabs
- **Cross-Device Sync**: Recent apps sync across user devices (by path)
- **Performance Optimized**: Lazy tab content loading
- **Mobile-First Design**: Responsive interface with mobile-specific optimizations
- **Dual Path Routing**: Direct paths for system apps, package-nav for others
- **Modular Architecture**: Individual app files for maintainability
- **Future-Ready**: Foundation for grid layouts and advanced features

### Desktop & Mobile Experience Features

#### Browser-Style Tabs
- **Compact Design**: 36px height tabs with 12px fonts for minimal footprint
- **Visual Hierarchy**: Active tabs elevated with rounded corners and shadows
- **Smooth Interactions**: Hover effects and seamless transitions
- **Professional Styling**: Chrome/Firefox-like tab appearance

#### Home Screen Style App Launcher
- **Nav Item Apps**: Each package nav item displays as individual app icon
- **Icon-First Design**: Rounded square containers (64px-72px) with icons underneath titles
- **Theme-Aware Styling**: Dark/light mode adaptive backgrounds and borders
- **Touch-Optimized**: Proper spacing and hover animations (scale 1.05x)
- **Natural Grid Flow**: Flexbox layout with consistent gaps (16px-20px)
- **Desktop/Mobile Sizes**: 80px (mobile) / 90px (desktop) app icon widths
- **Granular Access**: Direct access to specific package features via nav items
- **Multiple Instances**: Each app click creates a new tab (no tab reuse)

#### Mobile Optimizations
- **Dropdown Tab Switcher**: Compact tab navigation for small screens
- **Current Tab Display**: Clear indication of active tab with icon/title
- **One-Tap Tab Closing**: Easy tab management with dedicated close buttons
- **Adaptive Typography**: Smaller fonts and compact spacing on mobile

## Future Enhancements

### Phase 2 Opportunities
- **Keyboard Shortcuts**: Ctrl+Tab navigation, Ctrl+W close
- **Tab Reordering**: Drag & drop tab arrangement
- **Tab Groups**: Organize related tabs into collapsible groups
- **Pinned Tabs**: Keep frequently used apps always open

### Phase 3 Advanced Features  
- **Split Screen**: Multiple apps visible simultaneously
- **Tab Templates**: Save and restore common tab configurations
- **Deep Linking**: URL-based tab state restoration
- **Tab Search**: Quick search through open tabs and available apps

### Phase 4 Grid Layout System
- **Configurable Layouts**: Drag & drop app components into grid
- **Layout Persistence**: Save custom workspace arrangements  
- **Component-Level Routing**: Individual app routes as layout blocks
- **Responsive Grids**: Adaptive layouts for different screen sizes

## Real-World Usage Examples

### Package with Multiple Nav Items
```typescript
// Example package structure
{
  packageId: "user-management",
  name: "User Management", 
  appNavs: [
    { name: "Users", iconClassName: "bi-people", navigationPath: "users" },
    { name: "Roles", iconClassName: "bi-shield", navigationPath: "roles" },
    { name: "Permissions", iconClassName: "bi-key", navigationPath: "permissions" }
  ]
}

// Results in 3 separate app icons:
// 1. "Users" → package-nav/user-management/users
// 2. "Roles" → package-nav/user-management/roles  
// 3. "Permissions" → package-nav/user-management/permissions
```

### Multiple App Instances
- **New Tab Per Click**: Each app launcher click creates a fresh tab
- **Unique Tab IDs**: Uses timestamp + random string for uniqueness
- **Independent Sessions**: Each tab maintains its own state
- **No Tab Reuse**: Apps can run simultaneously in different tabs

### Recently Used Tracking
- **Path-Based**: Tracks individual nav item usage by constructed path
- **Cross-Session**: Persists between app restarts
- **User-Scoped**: Syncs across devices for same user
- **Smart Ordering**: Most recently used appears first
- **Instance Agnostic**: Tracks app usage regardless of number of instances

### System Apps Collection
```typescript
// Available system apps (formerly left sidebar items)
const systemApps = [
  // Core Management
  { name: 'Variables', icon: 'bi-braces', path: 'variables' },
  { name: 'Types', icon: 'bi-code-square', path: 'peer-types' },
  { name: 'Assistants', icon: 'bi-person-fill-gear', path: 'assistants' },
  { name: 'Tools', icon: 'bi-tools', path: 'tools' },
  { name: 'Workflows', icon: 'bi-database-fill-gear', path: 'workflows' },
  { name: 'Packages', icon: 'bi-box-fill', path: 'packages' },
  
  // Communication
  { name: 'Threads', icon: 'bi-cpu', path: 'shell' },
  
  // User & Settings Apps
  { name: 'Profile', icon: 'bi-person-circle', path: 'profile' },
  { name: 'Settings', icon: 'bi-gear-fill', path: 'settings' }
];
```

### App Categorization Logic
- **System Apps**: Built-in core functionality (search, threads, variables, types, assistants, tools, workflows, packages, groups, settings, and debugging tools)
- **User Apps**: All other packages with nav items
- **Recently Used**: Cross-category recent apps section  
- **Dynamic Updates**: Automatically reflects package changes
- **Modular Structure**: Each system app in individual `src/system-apps/*.app.ts` file

## System Apps Architecture

### File Structure
```
src/system-apps/
├── index.ts                 # Main exports and system package definition
├── assistants.app.ts        # AI Assistant management
├── tools.app.ts            # Tool management
├── workflows.app.ts         # Workflow builder
├── variables.app.ts         # Variable management
├── types.app.ts             # Peer type definitions  
├── packages.app.ts          # Package management
├── threads.app.ts           # Shell/communication
├── profile.app.ts           # User profile
└── settings.app.ts          # Application settings
```

### Migration from Left Sidebar
- **Enhanced Experience**: System functions benefit from tabs (multiple instances, persistence)
- **Modular Design**: Each app independently maintainable
- **Consistent Interface**: Icons and paths align with the main navigation where applicable

### Recent Improvements (Latest)

#### Display Name Enhancement
- **Name Truncation Solution**: Added `displayName` field to `IAppNav` interface
- **Tooltip Support**: Full app names still visible on hover for context
- **Visual Polish**: Increased spacing between app launcher sections for better visual separation

#### Mobile/Desktop Responsive Improvements
- **Section Spacing**: Enhanced visual separation between "Recently Used", "User Apps", and "System Apps" sections
- **Consistent Design**: Unified spacing approach across mobile and desktop layouts

#### System Apps Expansion
- **Profile & Settings**: Added Profile and Settings as system apps to restore old left bar functionality
- **Complete Coverage**: Core left bar items are available as individual apps
- **Familiar Icons**: Used `bi-person-circle` for Profile and `bi-gear-fill` for Settings

#### Smart Tab Management
- **Configurable Tab Behavior**: Added `alwaysNewTab` property to `IAppNav` interface
- **Default Switch-to-Existing**: App launcher now switches to existing tabs by default instead of creating duplicates
- **Selective New Tabs**: Apps can set `alwaysNewTab: true` to always open fresh instances
- **Better UX**: Reduces tab clutter while preserving flexibility for apps that need multiple instances

#### Dynamic Title Updates
- **Generic Fallbacks**: Tabs system provides basic title parsing ("Assistant Details", "Tool Details")
- **Detail Screen Enhancement**: Exported `updateActiveTabTitle()` function for screens to set specific titles
- **Progressive Enhancement**: Titles improve from generic to specific as data loads
- **Separation of Concerns**: Detail screens handle their own data-driven titles

## Internal App Navigation Synchronization

### Challenge
When a tab is open, the app inside it can navigate internally by changing `mainContentPath`. Currently this creates a disconnect:
- The tab's stored `path` in `activeTabs` remains the original path
- The tab's `title` doesn't reflect the current content
- Users lose context about where they are within the app

### Requirements
When `mainContentPath` changes due to internal app navigation:
1. **Update Tab Path**: Sync the active tab's `path` in `activeTabs` persistent variable
2. **Update Tab Title**: Reflect the new content in the tab title/header

### Technical Challenges
1. **Change Detection**: Distinguish between:
   - `mainContentPath` changes from tab switching (initiated by tabs system)
   - `mainContentPath` changes from internal navigation (initiated by app)
2. **Title Derivation**: Generate meaningful titles from arbitrary paths:
   - System apps: Parse path structure (e.g., `assistants/123` → "Assistant Details")
   - Package apps: Limited routing context available
3. **State Consistency**: Avoid infinite loops or conflicting updates

### Proposed Implementation

#### 1. Path Synchronization Strategy
```typescript
// Add flag to track when we're switching tabs
const [isSwitchingTabs, setIsSwitchingTabs] = useState(false);

// Listen for mainContentPath changes
const [currentPath] = useObservable(mainContentPath);

// React to path changes that aren't from tab switching
useEffect(() => {
  if (!isSwitchingTabs && currentPath) {
    const activeTabData = tabs.find(t => t.tabId === activeTab);
    if (activeTabData && activeTabData.path !== currentPath) {
      // This is internal navigation - update the tab
      updateTabPath(activeTab, currentPath);
    }
  }
}, [currentPath, isSwitchingTabs, activeTab, tabs]);
```

#### 2. Title Derivation Approaches
**Option A: Keep Original App Name (Simple)**
- Maintain original app name as title
- Add path indicator for context: `"Assistants - Details"`

**Option B: Smart Title Generation (Complex)**
- Parse path patterns for system apps:
  - `assistants` → "Assistants" 
  - `assistants/123` → "Assistant Details"
  - `tools/456/tests/789` → "Tool Test Details"
- For package apps: Keep package nav item name

**Option C: Hybrid Approach (Recommended)**
- System apps: Use smart parsing for common patterns
- Package apps: Keep original app name
- Fallback: Use original title if parsing fails

#### 3. Implementation Plan
1. **Add Path Sync Logic**: Monitor `mainContentPath` changes and update active tab
2. **Implement Title Parser**: Create title generation for system app patterns  
3. **Add State Management**: Prevent conflicts during tab switching
4. **Update Tab Display**: Show updated titles in headers and mobile dropdown

#### 4. System App Title Patterns
```typescript
const parseSystemAppTitle = (path: string, originalTitle: string): string => {
  const segments = path.toLowerCase().split('/').filter(Boolean);
  
  if (segments.length === 1) {
    return originalTitle; // "Assistants", "Tools", etc.
  }
  
  // Pattern matching for detail views
  const patterns: Record<string, string> = {
    'assistants': 'Assistant Details',
    'tools': segments[2] === 'tests' ? 'Tool Test Details' : 'Tool Details',  
    'workflows': 'Workflow Details',
    'variables': 'Variable Details',
    'packages': 'Package Details'
  };
  
  return patterns[segments[0]] || `${originalTitle} - Details`;
};
```

### Benefits
- **Better UX**: Users always know where they are within an app
- **Accurate Navigation**: Tab switching works correctly with updated paths
- **Context Preservation**: Deep links and bookmarking work properly
- **Visual Clarity**: Tab titles reflect current content, not just app names

### Implementation Priority
**Phase 1**: Basic path synchronization and simple title updates ✅
**Phase 2**: Smart title generation for system apps ✅
**Phase 3**: Enhanced title context and breadcrumb-style navigation

### Detail Screen Title Updates

#### Challenge with Database-Driven Titles
While the tabs system can parse generic patterns (`assistants/123` → "Assistant Details"), it can't access specific data to show meaningful titles like "Assistant: GPT-4 Helper" without tight coupling to every database table.

#### Hybrid Approach (Recommended)
1. **Tabs System**: Provides generic titles as fallback ("Assistant Details", "Tool Details")
2. **Detail Screens**: Update to specific titles when data loads ("Assistant: GPT-4 Helper")

#### Implementation Strategy
```typescript
// Export a function for detail screens to update tab titles
export const updateActiveTabTitle = (newTitle: string) => {
  const currentTabs = activeTabs();
  const activeTabIndex = currentTabs.findIndex(t => t.tabId === activeTabId());
  
  if (activeTabIndex >= 0) {
    const updatedTabs = [...currentTabs];
    updatedTabs[activeTabIndex] = {
      ...updatedTabs[activeTabIndex],
      title: newTitle
    };
    activeTabs(updatedTabs);
  }
};

// Detail screens can call this when data loads
// Example: AssistantDetails component
import { updateActiveTabTitle } from '../tabs-layout/tabs-layout';

export const AssistantDetails = (props: { assistantId: string }) => {
  const assistant = usePromise(async () => {
    const assistant = await Assistants().get(props.assistantId);
    // ... load logic
    return assistant;
  }, [props.assistantId]);

  // Update tab title when assistant data loads
  React.useEffect(() => {
    if (assistant?.name) {
      updateActiveTabTitle(`Assistant: ${assistant.name}`);
    }
  }, [assistant]);

  // Component render logic...
};
```

#### Benefits
- **Separation of Concerns**: Tabs system handles navigation, detail screens handle data
- **No Tight Coupling**: Tabs system doesn't need to know about every database table
- **Progressive Enhancement**: Generic titles initially, specific ones when data loads
- **Flexible**: Each detail screen can format titles as appropriate

The tabs-based UI is now live with complete system integration, full nav item support, and polished visual design!