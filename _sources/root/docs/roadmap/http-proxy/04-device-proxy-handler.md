# Device-Side Proxy Handler

## Overview

Implement the device-side infrastructure that receives and processes proxied HTTP requests forwarded from peers-services.

## Architecture

```
peers-services → RPC: handleProxyRequest → Device → ProxyHandlerManager → Route Handler → Response
```

## Phase 1 Constraints

> **⚠️ Important:** In Phase 1 (path-based URLs), devices return **markdown only**. HTML rendering happens server-side at peers-services with DOMPurify sanitization. This prevents XSS since all proxied content shares cookies with `peers.app`.

**Phase 2 (subdomains)** will allow full HTTP responses including custom HTML/CSS/JS.

## Proxy Types

**File:** `peers-device/src/proxy/proxy-types.ts`

```typescript
// Phase 1: GET-only, markdown responses
interface IProxyRequest {
  method: 'GET';  // Phase 1: GET only
  path: string;
  query: Record<string, string | string[]>;
  targetType: 'group' | 'device';
  targetId: string;
  friendlyName?: string;
}

// Phase 1: Markdown response (peers-services renders to HTML)
interface IProxyResponse {
  statusCode: number;
  markdown: string;  // Raw markdown content
  title?: string;    // Optional page title
}

interface IProxyConfig {
  enabled: boolean;
  defaultResponse: 'reject' | 'not-found';
  allowedPaths: string[];
}

type ProxyHandler = (request: IProxyRequest) => Promise<IProxyResponse>;

// Helper functions
function createProxyErrorResponse(statusCode: number, message: string): IProxyResponse;
function createMarkdownResponse(markdown: string, title?: string, statusCode?: number): IProxyResponse;
```

## Proxy Handler Manager

**File:** `peers-device/src/proxy/proxy-handler-manager.ts`

Singleton manager for routing proxy requests to appropriate handlers.

```typescript
class ProxyHandlerManager {
  private routes: IProxyRoute[] = [];
  private config: IProxyConfig = {
    enabled: true,
    defaultResponse: 'not-found',
    allowedPaths: []
  };

  // Route registration (Phase 1: GET only)
  registerRoute(route: IProxyRoute): () => void;
  get(pathPattern: string, handler: ProxyHandler): () => void;
  // post/put/delete will be added in Phase 2 (subdomains)
  
  // Configuration
  configure(config: Partial<IProxyConfig>): void;
  getConfig(): IProxyConfig;
  
  // Request handling
  async handleRequest(request: IProxyRequest): Promise<IProxyResponse>;
  
  // Path matching
  private routeMatches(route: IProxyRoute, request: IProxyRequest): boolean;
  private pathMatchesPattern(path: string, pattern: string): boolean;
  extractParams(path: string, pattern: string): Record<string, string>;
}

// Singleton access
function getProxyHandlerManager(): ProxyHandlerManager;
```

**Path Pattern Matching:**
- Exact match: `/api/users`
- Wildcard: `/api/*` (matches `/api/anything/here`)
- Named params: `/blog/:slug` (extracts `slug` parameter)

## RPC Handler

**Modify:** `peers-device/src/connection-manager/connection-manager.ts`

Add in `addConnection()`:
```typescript
connection.exposeRPC('handleProxyRequest', async (request: IProxyRequest): Promise<IProxyResponse> => {
  const proxyManager = getProxyHandlerManager();
  return proxyManager.handleRequest(request);
});
```

Add cleanup in `removeConnection()`:
```typescript
connection.removeAllListeners('handleProxyRequest');
```

## Default Response Behavior

When proxy receives a request:

1. **Proxy Disabled:** Return 503 "Proxy is disabled on this device"
2. **Path Not Allowed:** Return 403 "This path is not allowed"
3. **No Handler Found:**
   - If `defaultResponse === 'reject'`: Return 403 "Request rejected"
   - If `defaultResponse === 'not-found'`: Return 404 "No handler found"
4. **Handler Error:** Return 500 with error message

## Configuration UI

**Modify:** `peers-ui/src/screens/settings/settings-page.tsx`

Add `ProxySettings` component:

```tsx
const ProxySettings: React.FC = () => {
  // Load/save config from PersistentVars with key 'proxyConfig'
  
  return (
    <div className="mt-4">
      <h6>HTTP Proxy Settings</h6>
      
      {/* Enable/Disable Toggle */}
      <div className="form-check form-switch">
        <input type="checkbox" checked={config.enabled} onChange={...} />
        <label>Enable HTTP Proxy</label>
      </div>
      
      {/* Default Response */}
      <select value={config.defaultResponse} onChange={...}>
        <option value="not-found">404 Not Found</option>
        <option value="reject">403 Forbidden</option>
      </select>
      
      {/* Link to Friendly Names */}
      <a href="#friendly-names">Manage Friendly Names</a>
    </div>
  );
};
```

## Configure Proxy RPC

**Add to:** `peers-sdk/src/rpc-types.ts`

```typescript
configureProxy: (config: Partial<IProxyConfig>) => Promise<void>;
```

**Implement in:** `peers-electron/src/server/peers-init.ts`

```typescript
rpcServerCalls.configureProxy = async (config) => {
  const proxyManager = getProxyHandlerManager();
  proxyManager.configure(config);
};
```

## Files to Create/Modify

**New:**
- `peers-device/src/proxy/proxy-types.ts`
- `peers-device/src/proxy/proxy-handler-manager.ts`
- `peers-device/src/proxy/index.ts`

**Modify:**
- `peers-device/src/connection-manager/connection-manager.ts` - Add handleProxyRequest RPC
- `peers-device/src/index.ts` - Export proxy module
- `peers-sdk/src/rpc-types.ts` - Add configureProxy
- `peers-electron/src/server/peers-init.ts` - Implement configureProxy
- `peers-ui/src/screens/settings/settings-page.tsx` - Add ProxySettings component

## Effort Estimate

1-2 days

