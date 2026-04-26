# UI Router

The UI Router is a powerful system that allows Peers packages to register and render UI components dynamically. It enables a pluggable UI architecture where components can be matched and rendered based on context, category, and data type.

## Overview

The UI Router works by:

1. **Registering routes** - Components register themselves with metadata about when they should be used
2. **Matching routes** - When `<PeersUI>` is rendered, it finds the best matching component based on the provided context
3. **Loading and rendering** - The matched component is loaded (from a package bundle if needed) and rendered with the provided props

This enables packages to provide custom UI for specific data types or contexts without modifying core application code.

## Using PeersUI Component

The `PeersUI` component is the main way to render routed UI components:

```tsx
import { PeersUI } from "@peers-app/peers-sdk";

// Render a markdown field in view mode
<PeersUI
  uiCategory="field"
  uiSubcategory="markdown"
  uiEditMode="view"
  props={{ value: myMarkdownContent }}
/>

// Render a markdown field in edit mode
<PeersUI
  uiCategory="field"
  uiSubcategory="markdown"
  uiEditMode="edit"
  props={{ 
    value: content, 
    onChange: setContent 
  }}
/>
```

### PeersUI Props

| Prop | Type | Description |
|------|------|-------------|
| `peersUIId` | `string` | Optional. Directly specify a component by ID |
| `uiCategory` | `UICategory` | Category of UI: `field`, `list`, `details`, `screen`, `list-item`, `other`, `*` |
| `uiSubcategory` | `string` | Subcategory for more specific matching (e.g., `markdown`, `date`, `user`) |
| `uiEditMode` | `UIEditMode` | Mode: `view`, `edit`, `create`, `*` |
| `props` | `Record<string, any>` | Props passed to the matched component |

### Route Matching

Routes are matched in priority order based on:

1. **uiCategory** - Must match (or be `*` for wildcard)
2. **uiSubcategory** - Must match if specified (or be `*` for wildcard)
3. **uiEditMode** - Must match if specified (or be `*` for wildcard)
4. **propsSchema** - Props must validate against the schema (if defined)
5. **isMatch** - Custom function must return true (if defined)
6. **priority** - Higher priority routes are checked first

## Registering Internal Components

For components within `peers-ui`, use `registerInternalPeersUI`:

```tsx
import { registerInternalPeersUI } from "../ui-router/ui-loader";
import { z } from "zod";

// Define your component
const MyFieldComponent = (props: { value: string; onChange?: (v: string) => void }) => {
  return <div>{props.value}</div>;
};

// Define props schema
const propsSchema = z.object({
  value: z.string(),
  onChange: z.function().optional(),
});

// Register with routes
registerInternalPeersUI({
  component: MyFieldComponent,
  propsSchema: propsSchema,
  routes: [
    {
      uiCategory: 'field',
      uiSubcategory: 'my-custom-type',
      uiEditMode: 'view',
    },
    {
      uiCategory: 'field', 
      uiSubcategory: 'my-custom-type',
      uiEditMode: 'edit',
    }
  ]
});
```

### registerInternalPeersUI Options

| Option | Type | Description |
|--------|------|-------------|
| `component` | `React.ComponentType` | The React component to render |
| `propsSchema` | `ZodSchema` | Zod schema for validating props |
| `routes` | `Omit<IPeersUIRoute, 'peersUIId' \| 'packageId'>[]` | Array of route configurations |
| `peersUIId` | `string` | Optional. Custom ID (auto-generated if not provided) |

## Registering Package Components

For components in external packages, export routes via the routes bundle:

### 1. Define the UI Component (in uis bundle)

```tsx
// src/ui/my-component.tsx
import { IPeersUI, zodAnyObjectOrArray } from "@peers-app/peers-sdk";

export const MyComponent = (props: { data: any }) => {
  return <div>My custom UI</div>;
};

export const MyComponentUI: IPeersUI = {
  peersUIId: 'my-unique-component-id',
  content: MyComponent,
  propsSchema: zodAnyObjectOrArray,
};
```

### 2. Export the UI (in uis.ts)

```tsx
// src/uis.ts
import type { IPeersPackageUIs } from "@peers-app/peers-sdk";
import { MyComponentUI } from "./ui/my-component";

const uis: IPeersPackageUIs = {
  uis: [MyComponentUI]
};

declare const exportUIs: (uis: IPeersPackageUIs) => void;
exportUIs(uis);
```

### 3. Define Routes (in routes.ts)

```tsx
// src/routes.ts
import type { IPeersPackageRoutes } from "@peers-app/peers-sdk";
import { packageId } from "./consts";

const routes: IPeersPackageRoutes = {
  routes: [
    {
      packageId,
      peersUIId: 'my-unique-component-id',
      uiCategory: 'details',
      uiSubcategory: 'my-data-type',
      uiEditMode: 'view',
      // Optional: custom matching logic
      isMatch: (props, context) => {
        return props.data?.type === 'my-special-type';
      },
      priority: 10, // Higher = checked first
    }
  ]
};

declare const exportRoutes: (routes: IPeersPackageRoutes) => void;
exportRoutes(routes);
```

## Route Configuration Options

### IPeersUIRoute

| Property | Type | Description |
|----------|------|-------------|
| `packageId` | `string` | Package that owns this route |
| `peersUIId` | `string` | ID of the component to render |
| `uiCategory` | `UICategory` | Category filter |
| `uiSubcategory` | `string` | Subcategory filter |
| `uiEditMode` | `UIEditMode` | Edit mode filter |
| `path` | `string` | URL path filter (supports regex: `/^\/users\/.*/`) |
| `propsSchema` | `ZodSchema` | Schema for validating props |
| `isMatch` | `(props, context) => boolean` | Custom matching function |
| `priority` | `number` | Route priority (default: 0, higher = first) |

### UICategory Values

- `field` - Form field components (inputs, editors)
- `list` - List/collection views
- `list-item` - Individual items in a list
- `details` - Detail/full view of an item
- `screen` - Full screen/page components
- `other` - Miscellaneous components
- `*` - Wildcard (matches any category)

### UIEditMode Values

- `view` - Read-only display
- `edit` - Editing existing data
- `create` - Creating new data
- `*` - Wildcard (matches any mode)

## Examples

### Markdown Field (Built-in)

The markdown field demonstrates view/edit mode routing:

```tsx
// View mode - renders markdown as HTML
registerInternalPeersUI({
  component: MarkdownFieldView,
  propsSchema: markdownFieldPropsSchema,
  routes: [{
    uiCategory: 'field',
    uiSubcategory: 'markdown',
    uiEditMode: 'view',
  }]
});

// Edit mode - renders markdown editor
registerInternalPeersUI({
  component: MarkdownFieldEdit,
  propsSchema: markdownFieldPropsSchema,
  routes: [{
    uiCategory: 'field',
    uiSubcategory: 'markdown',
    uiEditMode: 'edit',
  }]
});
```

Usage:
```tsx
// Viewing markdown content
<PeersUI
  uiCategory="field"
  uiSubcategory="markdown"
  uiEditMode="view"
  props={{ value: task.body }}
/>

// Editing markdown content
<PeersUI
  uiCategory="field"
  uiSubcategory="markdown"
  uiEditMode="edit"
  props={{ 
    value: content, 
    onChange: setContent 
  }}
/>
```

### Custom Data Type Viewer

A package could register a custom viewer for a specific data type:

```tsx
// In routes.ts
{
  packageId: 'my-package-id',
  peersUIId: 'user-profile-viewer',
  uiCategory: 'details',
  uiSubcategory: 'user',
  uiEditMode: 'view',
  isMatch: (props) => props.user?.userId != null,
  priority: 10,
}
```

Usage:
```tsx
<PeersUI
  uiCategory="details"
  uiSubcategory="user"
  uiEditMode="view"
  props={{ user: userData }}
/>
```

### Path-Based Routing

Routes can also match based on the current navigation path:

```tsx
{
  packageId: 'my-package-id',
  peersUIId: 'settings-screen',
  uiCategory: 'screen',
  path: '/settings',  // Matches /settings/*
}

// Or with regex
{
  packageId: 'my-package-id', 
  peersUIId: 'user-details-screen',
  uiCategory: 'screen',
  path: '/^\\/users\\/[a-z0-9]+$/',  // Matches /users/:id
}
```

## Best Practices

1. **Use specific subcategories** - Avoid overly generic subcategories that might conflict with other packages

2. **Set appropriate priorities** - Use higher priorities for more specific routes, lower for fallbacks

3. **Validate props** - Always define a propsSchema to catch configuration errors early

4. **Handle missing components gracefully** - `PeersUI` returns `undefined` if no match is found; wrap in a fallback if needed:

```tsx
<PeersUI {...routeProps} /> || <DefaultComponent />
```

5. **Keep components focused** - Register separate components for view/edit modes rather than one component handling both

6. **Document your routes** - Other developers need to know what subcategories and props your package expects

## Debugging

If a component isn't rendering:

1. **Check the browser console** - Route loading errors are logged
2. **Verify route registration** - Ensure your routes bundle exports correctly
3. **Check props validation** - Props must match the propsSchema
4. **Verify matching criteria** - uiCategory, uiSubcategory, uiEditMode must all match
5. **Check priority** - A higher priority route might be matching first

You can inspect registered routes via browser console:
```js
window.getPeersUIRoutes()
```
