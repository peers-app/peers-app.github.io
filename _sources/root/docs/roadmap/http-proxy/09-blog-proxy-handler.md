# Blog Proxy Handler

## Overview

Implement a device-side proxy handler that serves blog content, turning the user's device into a blog server accessible through their friendly name URL.

## Phase 1 Constraints

> **⚠️ Important:** In Phase 1, devices return **markdown only**. peers-services renders the markdown to HTML with DOMPurify sanitization. This is required for security since path-based URLs share cookies with `peers.app`.

## Architecture

```
https://peers.app/proxy/myblog/ 
  → peers-services 
  → Device (handleProxyRequest) 
  → BlogProxyHandler 
  → Markdown Response
  → peers-services (render to HTML)
  → Browser
```

## Routes (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Blog home page (list of posts as markdown) |
| GET | `/index.html` | Same as `/` |
| GET | `/{slug}` | Single post (markdown content) |

> **Phase 2 additions:** JSON APIs (`/api/posts`), RSS feeds (`/feed.xml`), and other content types will be supported once we move to subdomain-based URLs.

## Implementation

**File:** `peers-device/src/proxy/blog-proxy-handler.ts`

### Registration Function (Phase 1)

```typescript
export function registerBlogProxyHandler(): () => void {
  const proxyManager = getProxyHandlerManager();
  const unregisterFns: (() => void)[] = [];

  unregisterFns.push(proxyManager.get('/', handleBlogHome));
  unregisterFns.push(proxyManager.get('/index.html', handleBlogHome));
  
  // Catch-all for post slugs (low priority)
  unregisterFns.push(proxyManager.registerRoute({
    pathPattern: '/:slug',
    methods: ['GET'],
    handler: handleSinglePost,
    priority: -1,
  }));

  return () => unregisterFns.forEach(fn => fn());
}
```

### Handler Functions (Phase 1 - Return Markdown)

```typescript
async function handleBlogHome(request: IProxyRequest): Promise<IProxyResponse> {
  const userContext = await getUserContext();
  const posts = await getPublishedPosts(20, userContext.userDataContext);
  const markdown = renderBlogHomeMarkdown(posts);
  return createMarkdownResponse(markdown, request.friendlyName || 'Blog');
}

async function handleSinglePost(request: IProxyRequest): Promise<IProxyResponse> {
  const slug = request.path.replace(/^\//, '').replace(/\/$/, '');
  const post = await getPostBySlug(slug, userContext.userDataContext);
  
  if (!post || post.status !== 'published') {
    return createProxyErrorResponse(404, 'Post not found');
  }
  
  // Return the post's markdown content directly
  return createMarkdownResponse(post.content, post.title);
}
```

### Markdown Generation (Phase 1)

Devices return markdown; peers-services handles HTML rendering.

```typescript
function renderBlogHomeMarkdown(posts: IBlogPost[]): string {
  const postList = posts.map(post => {
    const date = formatDate(post.publishedAt);
    const excerpt = post.excerpt ? `\n${post.excerpt}` : '';
    return `## [${post.title}](${post.slug})\n*${date}*${excerpt}`;
  }).join('\n\n---\n\n');
  
  return postList || '*No posts yet.*';
}
```

> **Note:** For single posts, we return `post.content` directly — it's already markdown.

## Auto-Registration

**Modify:** `peers-electron/src/server/peers-init.ts`

Register blog handler after device initialization:

```typescript
import { registerBlogProxyHandler } from "@peers-app/peers-device";

// In doInit(), after loadSystemData():
registerBlogProxyHandler();
logger.log('Blog proxy handler registered');
```

## Export

**Modify:** `peers-device/src/proxy/index.ts`

```typescript
export * from './blog-proxy-handler';
```

## Files to Create/Modify

**New:**
- `peers-device/src/proxy/blog-proxy-handler.ts`

**Modify:**
- `peers-device/src/proxy/index.ts` - Add export
- `peers-electron/src/server/peers-init.ts` - Register handler

## Future Enhancements

**Phase 1 (can do now):**
- Image serving from Files table (handle `peers-file://` URLs in markdown)
- Server-side mermaid rendering (peers-services can render mermaid in markdown)

**Phase 2 (requires subdomains):**
- Theme customization (custom CSS)
- Custom HTML templates
- JSON APIs (`/api/posts`)
- RSS feeds (`/feed.xml`)
- Comments system
- Analytics
- Syntax highlighting with custom JS

## Effort Estimate

1 day

