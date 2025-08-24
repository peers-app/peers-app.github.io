---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection3.md'
---
# Cross-Package Container Sharing Question

## Question
So if we have a project like peers-electron which relies on peers-sdk and also peers-device (which itself relies on peers-sdk) then we can have main.ts in peers-electron call `setGlobalContainer(container)` and also call `init(container)` peers-device (same container) and even though they are using different instances of peers-sdk, because the container is the same all the code should work?

## Answer
**Yes, exactly!** This is the key benefit of the ambient DI approach - it solves the multi-instance problem while maintaining ergonomics.

Here's how it works:

### Architecture
```
peers-electron
├── peers-sdk (instance A)
└── peers-device
    └── peers-sdk (instance B)
```

### Setup in peers-electron/main.ts
```typescript
import { setGlobalContainer, createContainer } from "peers-sdk";
import * as peersDevice from "peers-device";

// Create shared container with real data source
const container = createContainer(new SqliteDataSource('./app.db'));

// Set global container for peers-electron's peers-sdk instance
setGlobalContainer(container);

// Initialize peers-device with same container
peersDevice.init(container);
```

### In peers-device/init.ts
```typescript
import { setGlobalContainer } from "peers-sdk";

export function init(container: DIContainer) {
  // Set the same container for peers-device's peers-sdk instance
  setGlobalContainer(container);
}
```

### Result
- Both peers-sdk instances use the **same container instance**
- Same TableFactory, same data source, same table instances
- `Users()` in peers-electron and `Users()` in peers-device return identical table instances
- Data is perfectly synchronized because it's literally the same objects

### Key Benefits
1. **Shared state**: Both packages access the same table instances
2. **Single data source**: No conflicts or synchronization issues  
3. **Clean APIs**: All existing code continues to work unchanged
4. **Explicit control**: The top-level app controls the dependency graph
5. **Testability**: Easy to inject mock containers for testing

### Pattern for All Packages
```typescript
// peers-ui/init.ts
export function init(container?: DIContainer) {
  if (container) setGlobalContainer(container);
}

// peers-react-native/init.ts  
export function init(container?: DIContainer) {
  if (container) setGlobalContainer(container);
}
```

This approach transforms the current "fight over globals" problem into "share the same dependency graph" - which is exactly what we want for a cohesive application architecture.
