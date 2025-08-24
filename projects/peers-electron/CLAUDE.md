---
custom_edit_url: 'https://github.com/peers-app/peers-electron/edit/main/CLAUDE.md'
---
We're making a pretty fundamental change to packages and how they are loaded.  

Currently we load the routes and UI code as webpack bundles.  This is so we can load them efficiently and in parts to keep
the UI snappy (don't load everything up front, wait until a particular UI component is needed before downloading and instantiating it).
But the rest of the package is loaded as a node module with require.  This allows the tools and packages to be able to take advantage
of NodeJS specific libraries and runtime.  

This seems to be working well but now we have a new problem.  We need to be able to load the code dynamically in react-native.
To support this we need to load _all_ code as bundles.  This will allow us to load it from the SQLite (which is already synced)
so everything will work on react-native as well (We'll use a Function instance not eval but basically eval'ing the code).

I've done a lot already to support this - in particular there is now a `packageBundle` field on the IPackage interface.  

## Current Analysis

I've analyzed the current state of the package loading system. Here's what I found:

### Current State:
- `packageBundle` field exists on IPackage interface (line 217 in package-loader.ts)
- UI bundles are already being loaded from `/dist/uis.bundle.js` and stored in CodeBundles table
- Routes bundles are loaded from `/dist/routes.bundle.js` 
- Main package code is loaded via `require()` on the main file (line 65)
- Tools are registered in `packageToolInstances` object (line 67-69)
- tool-loader.ts uses `packageToolInstances` for package tools (line 26-28)

### Implementation Plan:

Next steps (High Priority):
- [ ] Update package-loader.ts to read the new `/dist/package.bundle.js` and save it to the packageBundle field
- [ ] Create a new package registry object to hold evaluated bundle packages  
- [ ] Implement Function instance evaluation of package bundles (instead of require)
- [ ] Update tool-loader.ts to use the new bundle-based system instead of packageToolInstances from require
- [ ] Test the new system with existing packages

### Key Changes Needed:
1. **package-loader.ts**: Add logic to read `/dist/package.bundle.js` similar to how UI/routes bundles are read
2. **New Registry**: Create `packageBundleInstances` object to replace require-based loading
3. **Function Evaluation**: Use `new Function()` to evaluate bundle code instead of require()  
4. **tool-loader.ts**: Update to use the new bundle registry instead of packageToolInstances

### Bundle Structure Analysis:
I examined the existing package.bundle.js structure from ~/peers-packages/tasks/dist/:

- **Bundle Format**: Webpack-compiled bundle with module.exports = __webpack_exports__
- **Export Structure**: The package exports a `.package` property containing the IPeersPackage
- **Package Object**: Contains packageId, hasUIBundle, navItems, and implicitly toolInstances, assistants, workflows
- **Side Effects**: Import statements like `import "./data"` register tables and tools during evaluation  
- **Current Tasks Package**: Only exports table definitions, no tools yet

**Key Insight**: The bundle evaluation will register tools/tables as side effects during execution, then provide the package object via exports.package

### ✅ FINAL IMPLEMENTATION - Explicit Exports + Central Registration:

**✅ COMPLETED**: Full implementation of bundle-based package loading system

**What Was Built**:
1. **tools-factory.ts** - Central registry for tool instances with `registerTool()`, `getRegisteredTool()` functions
2. **Enhanced package-loader.ts**:
   - Tries to load `/dist/package.bundle.js` first using `new Function()` evaluation  
   - Falls back to current `require()` approach if bundle doesn't exist
   - Centrally registers toolInstances from bundles using tools-factory
   - Stores bundle code in `pkg.packageBundle` field
3. **Updated tool-loader.ts**:
   - Checks tools-factory registry first for bundle-loaded tools
   - Falls back to legacy packageToolInstances for require-loaded packages
   - Maintains backwards compatibility

**How It Works**:
1. **Package Authors**: Export toolInstances explicitly in their package (no magic, no side effects)
2. **Bundle Loading**: package-loader.ts evaluates bundle with Function, extracts toolInstances, registers centrally
3. **Tool Lookup**: tool-loader.ts transparently uses new registry, falls back to legacy as needed
4. **React Native Ready**: All code loaded as bundles, can be evaluated without Node.js require()

**Benefits Achieved**:
- ✅ Explicit exports (no hidden side effects)
- ✅ Central registration (implementation detail hidden from users)  
- ✅ Backwards compatibility (require-based packages still work)
- ✅ React Native compatible (Function evaluation instead of require)
- ✅ Clean architecture (tools-factory pattern matches table-factory)
