# Building Peers Packages

## TODO 
- [ ] note about using newid() to generate ids (even if they are hardcoded)
- [ ] note about how files work

## What is a Peers Package?

A Peers Package is a self-contained module that extends the Peers App platform with custom UI screens, data tables, tools, assistants, and more. UI packages follow a standard 3-bundle structure.

## Package Structure

```
my-package/
├── src/
│   ├── consts.ts      # Package IDs (packageId, screenIds, toolIds, tableIds)
│   ├── package.ts     # Package definition (IPeersPackage) - app nav, tools, tables
│   ├── routes.ts      # Navigation routes (IPeersPackageRoutes) - keep minimal!
│   ├── uis.ts         # UI exports (IPeersPackageUIs)
│   └── ui/
│       └── app.tsx    # React components
├── dist/              # Built bundles
│   ├── package.bundle.js
│   ├── routes.bundle.js
│   └── uis.bundle.js
├── webpack.*.config.js  # Three webpack configs for each bundle
└── package.json         # Has peers.packageId field
```

## Build System

Three separate webpack bundles:

| Bundle | Entry | Purpose |
|--------|-------|---------|
| `package.bundle.js` | `package.ts` | Package metadata, app nav, tools, tables, assistants |
| `routes.bundle.js` | `routes.ts` | Navigation routes (kept minimal for fast loading) |
| `uis.bundle.js` | `uis.ts` | React UI components |

**Commands:**
- `npm run build` - Production build of all bundles
- `npm run dev` - Watch mode for all bundles (uses concurrently)

## Key SDK Interfaces

From `@peers-app/peers-sdk`:

- `IPeersPackage` - Main package definition
- `IPeersPackageRoutes` - Route collection
- `IPeersPackageUIs` - UI collection
- `IPeersUI` - Single UI component (has `peersUIId`, `content`, `propsSchema`)
- `IPeersUIRoute` - Single route (has `packageId`, `peersUIId`, `path`, `uiCategory`)

## Adding Features

### Adding a New Screen
1. Add screen ID to `consts.ts`
2. Create React component in `ui/`
3. Export `IPeersUI` from the component file
4. Add route in `routes.ts`
5. Add UI to `uis.ts`

### Adding Tables (Data)
1. Add table ID to `consts.ts`
2. Create `data/` folder with Zod schema and `ITableDefinition`
3. Export `tableDefinitions` array
4. Import in `package.ts` and add to `IPeersPackage`

### Adding Tools
1. Add tool ID to `consts.ts`
2. Create `tools/` folder with `ITool` and `IToolInstance`
3. Export `toolInstances` array
4. Import in `package.ts` and add to `IPeersPackage`

## External Dependencies

Shared dependencies are externalized (provided by the Peers runtime):
- `react` → `React`
- `@peers-app/peers-sdk` → `PeersSDK`
- `zod` → `zod`

## Peers App Monorepo

The core Peers platform is split across several repositories at [github.com/peers-app](https://github.com/peers-app):

| Repository | Description |
|------------|-------------|
| [peers-sdk](https://github.com/peers-app/peers-sdk) | SDK types and utilities |
| [peers-device](https://github.com/peers-app/peers-device) | Device-level functionality |
| [peers-electron](https://github.com/peers-app/peers-electron) | Desktop app |
| [peers-react-native](https://github.com/peers-app/peers-react-native) | Mobile app |
| [peers-ui](https://github.com/peers-app/peers-ui) | Shared UI components |
| [peers-services](https://github.com/peers-app/peers-services) | Backend services |

