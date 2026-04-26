# Website Routing & Architecture

## Overview

The peers-services Express server hosts both the PWA and several static pages. A `peers-auth` cookie determines whether `/` serves the landing page or the PWA.

## Routes

| Path | Serves | Notes |
|------|--------|-------|
| `/` | `landing.html` or `index.html` | Cookie/`?app` check (see below) |
| `/landing` | `landing.html` | Always serves landing page |
| `/download` | `download.html` | Desktop app downloads |
| `/account` | `account.html` | Stub — coming soon |
| `/privacy` | `privacy.html` | Privacy policy |
| `/?app` | `index.html` (PWA) | Forces PWA regardless of cookie |
| `*` (catch-all) | `index.html` or redirect | Cookie present → PWA; absent → redirect to `/landing` |

## Cookie-Based Routing

The server checks for a `peers-auth` cookie on `GET /`:

```
GET / → peers-auth cookie present? → YES → serve index.html (PWA)
                                   → NO  → ?app param? → YES → serve index.html (PWA)
                                                        → NO  → serve landing.html
```

The cookie is a **routing hint only**, not a security token. Actual auth is client-side (localStorage).

### Cookie lifecycle

- **Set on login**: `peers-pwa/src/peers-init.ts` sets `peers-auth=1` in both `rpcServerCalls.setUserIdAndSecretKey` and `initializePWA()` (for existing sessions).
- **Cleared on logout**: `rpcServerCalls.logout` sets `max-age=0` then redirects to `/`.
- Cookie params: `path=/; max-age=31536000; SameSite=Lax`

### Server implementation

`peers-services/src/server.ts` uses `cookie-parser` middleware. The root route and the SPA catch-all both read `req.cookies['peers-auth']`.

## Service Worker

`peers-pwa/src/sw.ts` uses Workbox with `injectManifest` strategy:

- **Precache**: All Vite build assets via `precacheAndRoute(self.__WB_MANIFEST)` with `directoryIndex: ''` to prevent `/` from being silently resolved to cached `index.html`.
- **Navigation handler**: `NetworkFirst` — online requests hit the server (which uses the cookie to decide). On network failure, if the `peers-auth` cookie is present in the request headers, the SW serves the precached `index.html` directly via `matchPrecache('/index.html')`.
- **Fonts/images**: `CacheFirst`.

This ensures:
- New visitors never download the PWA bundle (server serves lightweight landing page)
- Logged-in users get the PWA offline (SW falls back to precached shell)
- Non-PWA pages (`/landing`, `/download`, etc.) are served from network

## Static Pages

All static pages (`landing.html`, `download.html`, `account.html`, `privacy.html`) are standalone HTML files using Bootstrap from CDN. They share a consistent dark theme and nav bar with links between each other and to `/?app`.

## Release Flow

```bash
cd peers-pwa && yarn release   # builds PWA, copies dist/* into peers-services/public/
```

The built PWA assets coexist with the static HTML pages in `peers-services/public/`.
