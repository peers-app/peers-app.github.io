# HTTP Proxy Infrastructure

## Overview

Implement the core HTTP proxy system in peers-services that routes requests to connected devices based on friendly names or raw IDs.

## URL Format

**Phase 1 (Simple):** `https://peers.app/proxy/{nameOrId}/{path}`
- Mounted at `/proxy` to avoid conflicts with existing routes
- `nameOrId` can be a friendly name or raw groupId/deviceId

**Phase 2 (Future - requires wildcard SSL):** `https://{nameOrId}.peers.app/{path}`
- Requires wildcard SSL certificate for `*.peers.app`
- More user-friendly URLs
- **Unlocks full proxy functionality** (see limitations below)

## Phase 1 Limitations

> **⚠️ Important:** Phase 1 path-based proxying is intentionally limited for security reasons. All proxied content shares cookies with `peers.app`, so we cannot safely serve user-controlled HTML/JavaScript.

**Phase 1 constraints:**
- **GET requests only** — no POST, PUT, DELETE, etc.
- **Markdown responses only** — devices return raw markdown content
- **Server-side rendering** — peers-services wraps markdown in a controlled HTML template
- **Static content only** — no interactive applications, forms, or client-side JS

**What Phase 1 supports:**
- Blogs and documentation sites
- Static pages with text, images, and links
- Read-only content viewing

**What requires Phase 2 (subdomains):**
- Full HTTP method support (POST, PUT, DELETE)
- User-controlled HTML/CSS/JavaScript
- Interactive web applications
- Forms and user input
- APIs and webhooks
- Custom headers and cookies

## Architecture

```
Browser → peers-services → MongoDB (lookup name) → Connected Device → Response
```

## Implementation

### 1. Proxy Route Handler (peers-services)

**File:** `peers-services/src/proxy/proxy-handler.ts`

```typescript
// Route: /proxy/:nameOrId/*
// 1. Resolve nameOrId to groupId/deviceId via FriendlyNames collection
// 2. Find connected device (direct lookup or group member)
// 3. Forward request via RPC: handleProxyRequest
// 4. Render markdown response to HTML and return
```

**Request structure sent to devices (Phase 1):**
```typescript
interface IProxyRequest {
  method: 'GET';  // Phase 1: GET only
  path: string;
  query: Record<string, string | string[]>;
  targetType: 'group' | 'device';
  targetId: string;
  friendlyName?: string;
}
```

**Response structure from devices (Phase 1):**
```typescript
interface IProxyResponse {
  statusCode: number;
  markdown: string;  // Phase 1: markdown content only
}
```

**Server-side rendering (Phase 1):**
```typescript
// peers-services renders the markdown in a controlled template
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function renderMarkdownResponse(markdown: string, friendlyName: string): string {
  const safeHtml = DOMPurify.sanitize(marked.parse(markdown));
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${friendlyName} - Peers</title>
      <link rel="stylesheet" href="/proxy-styles.css">
    </head>
    <body>
      <header><!-- peers.app branding --></header>
      <main class="markdown-content">${safeHtml}</main>
    </body>
    </html>
  `;
}
```

### 2. Connection Lookup

Connections are already tracked by `deviceId` in `connection-server.ts`. For proxy routing:

- **`targetType: 'device'`** — Look up directly: `deviceConnections[targetId]`
- **`targetType: 'group'`** — Query group membership to find member devices, then check which are connected

No additional connection tracking infrastructure needed.

### 3. Mount Proxy Routes

**Modify:** `peers-services/src/server.ts`

```typescript
import { createProxyRouter } from "./proxy/proxy-handler";

// After other routes, before 404 handler
app.use('/proxy', createProxyRouter());
```

## HTTP Response Codes

| Status | Meaning |
|--------|---------|
| 404 | Invalid friendly name or groupId not found |
| 503 | No connected devices available |
| 502 | Device rejected or errored |
| 200+ | Proxied response from device |

## Device Selection

When `targetType: 'group'` and multiple devices are connected:
1. Check for `X-Peers-Device-Id` header to prefer specific device
2. Fall back to first available verified connection for any group member

## Security Considerations

**Phase 1 security model:**
- **GET-only** prevents CSRF and state-changing attacks
- **Markdown-only responses** prevent XSS (no user-controlled scripts)
- **Server-side rendering with DOMPurify** sanitizes all HTML output
- **Controlled template** ensures peers.app branding (prevents phishing confusion)

**General protections:**
- Rate limiting per friendly name/IP
- Request size limits
- Timeout handling for device responses

> **Why these restrictions?** Path-based proxying means all content shares cookies with `peers.app`. Without subdomain isolation, user-controlled JavaScript could steal session tokens or perform actions as the user. Moving to subdomains (Phase 2) removes this risk via browser cookie isolation.

## Files to Create/Modify

**New:**
- `peers-services/src/proxy/proxy-handler.ts`

**Modify:**
- `peers-services/src/peers/connection-server.ts` - Export connection lookup helpers
- `peers-services/src/server.ts` - Mount proxy router

## Effort Estimate

2-3 days

