# Persistent Variables (pvars)

Persistent variables (pvars) are observable values that automatically persist to the database. They provide a simple reactive API for storing and syncing application state.

## Location

- **Implementation**: `peers-sdk/src/data/persistent-vars.ts`
- **Tests**: `peers-device/src/persistent-vars.test.ts` (requires SQLite)

## Core Concept

A pvar is an `Observable<T>` that:
1. Loads its initial value from the database
2. Automatically saves changes to the database
3. Syncs across devices (depending on scope)
4. Reacts to database changes from other sources (sync, other pvar instances)

## Scopes

Pvars have different scopes that determine where they're stored and how they sync:

| Scope | Storage | Syncs To | Use Case |
|-------|---------|----------|----------|
| `device` | User's personal DB | This device only | Device-specific settings |
| `user` | User's personal DB | All user's devices | User preferences |
| `group` | Group's DB | All group members | Shared group settings |
| `groupDevice` | User's personal DB | This device only | Per-group device settings |
| `groupUser` | User's personal DB | All user's devices | Per-group user settings |

## API

### Factory Functions

```typescript
import { deviceVar, userVar, groupVar, groupDeviceVar, groupUserVar } from "@peers-app/peers-sdk";

// Device-only (not synced)
const theme = deviceVar<string>('theme', { defaultValue: 'light' });

// Synced across user's devices
const fontSize = userVar<number>('fontSize', { defaultValue: 14 });

// Shared with entire group
const groupName = groupVar<string>('groupName', { defaultValue: 'My Group' });

// Per-group, device-only
const sidebarOpen = groupDeviceVar<boolean>('sidebarOpen', { defaultValue: true });

// Per-group, synced to user's devices
const lastReadTime = groupUserVar<number>('lastReadTime', { defaultValue: 0 });
```

### Reading and Writing

```typescript
// Create a pvar
const myVar = deviceVar<string>('myVar', { defaultValue: 'initial' });

// IMPORTANT: Wait for loading before using
await myVar.loadingPromise;

// Read current value (call as function)
const currentValue = myVar();  // 'initial'

// Write new value (call with argument)
myVar('new value');

// Subscribe to changes
myVar.subscribe(value => {
  console.log('Value changed to:', value);
});
```

### Options

```typescript
interface IPersistentVarOptions<T> {
  defaultValue?: T;           // Value if not in DB
  dbValue?: T;                // Override initial value (skip DB load)
  userContext?: UserContext;  // Explicit context (for testing)
  dataContext?: DataContext;  // Pin to specific data context
  isSecret?: boolean;         // Encrypt value in DB
}
```

## Important Patterns

### Always Await loadingPromise

Pvars load asynchronously. Always wait before using:

```typescript
const myVar = deviceVar<string>('myVar', { defaultValue: 'default' });

// WRONG - may get undefined or stale value
console.log(myVar());

// CORRECT - wait for DB load
await myVar.loadingPromise;
console.log(myVar());
```

### Async Writes

Writes are queued in a promise chain. If you need to wait for a write to complete:

```typescript
myVar('new value');
await myVar.loadingPromise;  // Now the write is complete
```

### Singleton Pattern

Calling the same pvar factory with the same name returns the **same instance**:

```typescript
const var1 = deviceVar<string>('myVar', { defaultValue: 'a' });
const var2 = deviceVar<string>('myVar', { defaultValue: 'a' });

var1 === var2;  // TRUE - same instance!
```

This prevents issues with rapid updates causing infinite loops between multiple instances. The cache is keyed by:
- **Scope** (device, user, group, etc.)
- **Name** (the variable name)
- **DataContext** (for group-scoped vars with explicit dataContext)
- **UserContext** (ensures test isolation)

Note: Different UserContexts get different instances, which is important for test isolation.

## Database Schema

Pvars are stored in the `PersistentVars` table:

```typescript
interface IPersistentVar {
  persistentVarId: string;     // Primary key
  name: string;                // Unique name (indexed)
  scope: 'device' | 'user' | 'group' | 'groupDevice' | 'groupUser';
  value: { value: any };       // JSON-wrapped value
  description?: string;
  userCreated?: boolean;
  isSecret?: boolean;          // If true, value is encrypted
  modifiedAt?: number;         // Timestamp of last modification
}
```

## Internal Flow

### Write Flow

1. `myVar('newValue')` updates the observable synchronously
2. Subscriber queues `reactToValueChanged(newValue)` in the promise chain
3. `reactToValueChanged` checks if value is stale (observable moved on)
4. If not stale, saves to database via `PersistentVarsTable.save()`
5. Database triggers change event
6. Other pvar instances receive event and update their observables

### Read Flow (on creation)

1. `deviceVar()` creates observable with `defaultValue`
2. `loadingPromise` begins async initialization
3. Loads existing record from DB (if any)
4. Updates observable with DB value
5. Sets up DB change subscription
6. Sets up value change subscription
7. `loadingPromise` resolves

## Known Issues and Fixes

### Infinite Update Loop (FIXED)

**Problem**: When two pvar instances exist for the same variable and rapid updates occur, they could get into an infinite loop:

1. pvar1 updates to A, B, C rapidly
2. pvar2 receives DB events and queues writes for A, B, C
3. pvar2's write for A runs after its record was updated to C
4. This writes stale value A to DB, triggering more events
5. Infinite ping-pong loop

**Fix**: In `reactToValueChanged()`, check if the observable has moved on:

```typescript
// Skip if the observable has already moved on (handles rapid updates)
if (!isEqual(persistentVar(), value)) {
  return;
}
```

This check prevents stale writes by ensuring we only save values that match the current observable state.

### Singleton Pattern (IMPLEMENTED)

Multiple calls to the same pvar factory with the same parameters return the **same instance**:

```typescript
const var1 = deviceVar<string>('myVar', { defaultValue: 'a' });
const var2 = deviceVar<string>('myVar', { defaultValue: 'a' });
var1 === var2;  // TRUE - same instance
```

The cache key is based on: `scope:name:userContextId:dataContextId`. This means:
- Same name + scope + userContext + dataContext = same instance
- Different userContexts (e.g., in tests) = different instances
- Options from the first call win (defaultValue, isSecret, etc.)

## Testing Pvars

Tests must be in `peers-device` (requires SQLite). See `testing-with-usercontext.md` for setup.

```typescript
import { deviceVar, sleep } from "@peers-app/peers-sdk";

it("should persist a value", async () => {
  const userContext = await createTestUserContext();
  
  const myVar = deviceVar<string>('testVar', { 
    defaultValue: 'initial',
    userContext   // Pass context for testing
  });
  await myVar.loadingPromise;

  expect(myVar()).toBe('initial');
  
  myVar('updated');
  await sleep(100);  // Allow async DB write
  
  expect(myVar()).toBe('updated');
});
```

## Common Usage Examples

### Settings/Preferences

```typescript
// In a React component
const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
  const pvar = deviceVar<boolean>('darkMode', { defaultValue: false });
  pvar.loadingPromise.then(() => {
    setDarkMode(pvar());
    pvar.subscribe(setDarkMode);
  });
}, []);

const toggleDarkMode = () => {
  pvar(!pvar());  // Toggle and persist
};
```

### Secret Values

```typescript
// API keys are encrypted in the database
const apiKey = groupVar<string>('openaiApiKey', { 
  defaultValue: '',
  isSecret: true  // Encrypted at rest
});
```

### Group Context Changes

Group-scoped pvars automatically reload when the active group changes:

```typescript
const groupSetting = groupVar<string>('setting', { defaultValue: 'default' });

// When user switches to a different group, groupSetting automatically
// reloads from the new group's database
```

## See Also

- `peers-sdk/src/observable.ts` - Observable implementation
- `peers-device/src/persistent-vars.test.ts` - Test examples
- `testing-with-usercontext.md` - Test setup guide
