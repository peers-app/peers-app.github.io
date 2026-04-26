# HTTP Proxy & Blog System

This folder contains design documents for the HTTP proxy system and blog application features.

## Overview

The HTTP proxy system allows users to expose services running on their connected devices through memorable URLs. The blog application is the first use case, allowing users to publish a blog that's hosted on their own device but accessible via `https://peers.app/proxy/{friendlyName}/`.

## Architecture (Phase 1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                  Browser                                 │
│                     https://peers.app/proxy/myblog/                     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             peers-services                               │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  Proxy Handler      │───▶│  FriendlyNames DB   │                     │
│  │  /proxy/:nameOrId/* │    │  (MongoDB)          │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
│            │                                                             │
│            │ Find connected device                                       │
│            ▼                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  Connection Server  │    │  Markdown Renderer  │ ◀─── Phase 1:       │
│  │  (WebSocket)        │    │  (marked+DOMPurify) │      Server-side    │
│  └─────────────────────┘    └─────────────────────┘      HTML rendering │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ RPC: handleProxyRequest
                                      │ Returns: markdown string
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          User's Device (peers-electron)                  │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  Connection Manager │───▶│  Proxy Handler      │                     │
│  │                     │    │  Manager            │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
│                                      │                                   │
│                                      │ Route to handler                  │
│                                      ▼                                   │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  Blog Proxy Handler │    │  BlogPosts Table    │                     │
│  │  (returns markdown) │◀──▶│  (peers-sdk)        │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Feature Documents

| Document | Description | Effort |
|----------|-------------|--------|
| [01-proxy-infrastructure.md](01-proxy-infrastructure.md) | Core HTTP proxy routing in peers-services | 2-3 days |
| [02-friendly-names.md](02-friendly-names.md) | Friendly name registry and validation | 1-2 days |
| [03-friendly-names-ui.md](03-friendly-names-ui.md) | UI for managing friendly names | 1 day |
| [04-device-proxy-handler.md](04-device-proxy-handler.md) | Device-side request handling | 1-2 days |
| [05-blog-data-model.md](05-blog-data-model.md) | BlogPosts table schema | 0.5 days |
| [06-markdown-image-support.md](06-markdown-image-support.md) | Image embedding in markdown editor | 2-3 days |
| [07-markdown-mermaid-support.md](07-markdown-mermaid-support.md) | Mermaid diagram support | 2-3 days |
| [08-blog-app-ui.md](08-blog-app-ui.md) | Blog management screens | 1-2 days |
| [09-blog-proxy-handler.md](09-blog-proxy-handler.md) | Blog HTTP handler on device | 1 day |

**Total Estimated Effort: 12-18 days**

## Implementation Order

### Phase 1: Core Infrastructure (4-5 days)
1. Proxy Infrastructure (01)
2. Friendly Names Registry (02)
3. Device Proxy Handler (04)

### Phase 2: UI & Management (2 days)
4. Friendly Names UI (03)

### Phase 3: Blog Foundation (3-4 days)
5. Blog Data Model (05)
6. Blog App UI (08)
7. Blog Proxy Handler (09)

### Phase 4: Editor Enhancements (4-6 days)
8. Markdown Image Support (06)
9. Markdown Mermaid Support (07)

## URL Format

**Phase 1 (Current):** `https://peers.app/proxy/{nameOrId}/{path}`

**Phase 2 (Future):** `https://{nameOrId}.peers.app/{path}`
- Requires wildcard SSL certificate
- More user-friendly URLs
- **Required for full proxy functionality**

## Phase 1 Limitations

> **⚠️ Static Content Only:** Phase 1 uses path-based URLs where all proxied content shares cookies with `peers.app`. For security, we restrict Phase 1 to serving static content only.

| Feature | Phase 1 (Path) | Phase 2 (Subdomain) |
|---------|----------------|---------------------|
| GET requests | ✅ | ✅ |
| POST/PUT/DELETE | ❌ | ✅ |
| Markdown content | ✅ | ✅ |
| Custom HTML/CSS/JS | ❌ | ✅ |
| Interactive apps | ❌ | ✅ |
| Forms & user input | ❌ | ✅ |
| APIs & webhooks | ❌ | ✅ |
| Custom cookies | ❌ | ✅ |

**Phase 1 is ideal for:** Blogs, documentation, static pages

**Phase 2 unlocks:** Full web applications, APIs, interactive content

## Key Design Decisions

1. **Proxy mounted at `/proxy`** - Avoids conflicts with existing peers-services routes
2. **Friendly names stored in MongoDB** - Consistent with other peers-services data
3. **Signed registration** - Proves ownership without requiring full authentication
4. **Server-side markdown rendering (Phase 1)** - Devices return markdown, peers-services renders to HTML with DOMPurify sanitization
5. **GET-only in Phase 1** - Prevents CSRF and cookie-based attacks until subdomain isolation
6. **Handler manager pattern** - Extensible system for adding more proxy handlers
7. **Lazy-loaded mermaid** - CDN loading to avoid bundle bloat

## Security Considerations

**Phase 1 security (path-based):**
- GET-only requests (no state changes)
- Markdown responses only (no user-controlled scripts)
- Server-side HTML sanitization via DOMPurify
- Controlled HTML template with peers.app branding

**General protections:**
- Rate limiting per friendly name and IP
- Request size limits
- Timeout handling
- Signed registrations with timestamps
- Reserved name protection

> **Note:** Full proxy functionality (POST, custom HTML/JS, etc.) requires Phase 2 subdomain support for proper cookie isolation.

