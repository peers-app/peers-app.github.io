# Blog Application UI

## Overview

Create a system app for managing blog posts, including a post list, editor with extended markdown support, and preview functionality.

## System App Definition

**File:** `peers-ui/src/system-apps/blog.app.ts`

```typescript
export const blogApp: IAppNav = {
  name: 'Blog',
  displayName: 'Blog',
  iconClassName: 'bi-journal-richtext',
  navigationPath: 'blog'
};
```

## Screens

### 1. Blog Post List

**File:** `peers-ui/src/screens/blog/blog-post-list.tsx`
**Route:** `#blog`

**Features:**
- List all blog posts with status badges (Draft/Published)
- Search posts by title/excerpt
- Filter by status (All/Drafts/Published)
- Create new post button
- Click to edit post

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ 📓 Blog Posts                          [+ New Post] │
├──────────────────────────────────────────────────────┤
│ [Search posts...        ] [All Posts ▼]             │
├──────────────────────────────────────────────────────┤
│ 📄 My First Blog Post                   Published ✓ │
│    A short excerpt about this post...               │
│    Published Jan 15, 2026 · tech, tutorial          │
│                                                      │
│ 📄 Work in Progress                     Draft      │
│    Another excerpt here...                          │
│    Created Jan 20, 2026                             │
└──────────────────────────────────────────────────────┘
```

**Key Functions:**
```typescript
async function handleNewPost() {
  const me = await getMe();
  const post = await createBlogPost('Untitled Post', me.userId, '', userContext.userDataContext);
  mainContentPath(`blog/${post.postId}`);
}
```

### 2. Blog Post Editor

**File:** `peers-ui/src/screens/blog/blog-post-editor.tsx`
**Route:** `#blog/{postId}`

**Features:**
- Edit title, slug, excerpt, tags
- Extended markdown editor (images + mermaid)
- Auto-save or manual save
- Publish/Unpublish toggle
- Delete post
- Preview button

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ ← Edit Draft                    [Preview] [Save] [Publish] │
├──────────────────────────────────────────────────────┤
│ Title: [My Blog Post                              ] │
│ Slug:  [my-blog-post-abc12345                     ] │
│ Excerpt: [A short summary...                      ] │
│ Tags: [tech, tutorial, news                       ] │
├──────────────────────────────────────────────────────┤
│ Content                                             │
│ ┌──────────────────────────────────────────────────┐│
│ │ [B] [I] [S] | [•] [1.] [☑] | [📷] [📊]         ││
│ ├──────────────────────────────────────────────────┤│
│ │                                                  ││
│ │ # Introduction                                   ││
│ │                                                  ││
│ │ This is my blog post with **bold** text...      ││
│ │                                                  ││
│ │ [Embedded Image]                                 ││
│ │                                                  ││
│ │ [Mermaid Diagram - Click to Edit]               ││
│ │                                                  ││
│ └──────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────┤
│ [Delete Post]                  Last saved: 2:30 PM  │
└──────────────────────────────────────────────────────┘
```

**Key Functions:**
```typescript
async function handleSave() {
  const updatedPost = {
    ...post,
    title: title.trim(),
    slug: slug.trim(),
    content,
    excerpt: excerpt.trim(),
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    updatedAt: new Date(),
  };
  await BlogPosts(userContext.userDataContext).save(updatedPost);
}

async function handlePublish() {
  await handleSave();
  await publishBlogPost(postId, userContext.userDataContext);
}

async function handleDelete() {
  if (confirm('Are you sure?')) {
    await BlogPosts(userContext.userDataContext).delete(postId);
    mainContentPath('blog');
  }
}
```

### 3. Blog Post Preview

**File:** `peers-ui/src/screens/blog/blog-post-view.tsx`
**Route:** `#blog/{postId}/preview`

**Features:**
- Render post as it would appear publicly
- Show title, date, tags, content
- Draft warning banner
- Back to editor link

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ ← Preview                                    [Edit] │
├──────────────────────────────────────────────────────┤
│ ⚠️ This is a preview of your draft.                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│ My Blog Post                                         │
│ ═════════════                                        │
│ Published January 15, 2026                           │
│ [tech] [tutorial]                                    │
│                                                      │
│ A short summary of the post...                       │
│                                                      │
│ ─────────────────────────────────────────────────    │
│                                                      │
│ # Introduction                                       │
│                                                      │
│ This is my blog post with **bold** text...          │
│                                                      │
│ [Rendered Image]                                     │
│                                                      │
│ [Rendered Mermaid Diagram]                           │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Permalink: /blog/my-blog-post-abc12345              │
└──────────────────────────────────────────────────────┘
```

## Route Registration

**File:** `peers-ui/src/screens/blog/index.ts`

```typescript
import './blog-post-list';
import './blog-post-editor';
import './blog-post-view';

export * from "./blog-post-list";
export * from "./blog-post-editor";
export * from "./blog-post-view";
```

**Route matchers:**
```typescript
// List: exact match 'blog'
isMatch: (props, context) => context.path === 'blog'

// Editor: blog/{postId} but not blog/{postId}/preview
isMatch: (props, context) => /^blog\/[^\/]+$/.test(context.path) && !context.path.endsWith('/preview')

// Preview: blog/{postId}/preview
isMatch: (props, context) => /^blog\/[^\/]+\/preview$/.test(context.path)
```

## Add to System Apps

**Modify:** `peers-ui/src/system-apps/index.ts`

```typescript
export { blogApp } from './blog.app';
import { blogApp } from './blog.app';

// In systemApps array, after friendlyNamesApp:
blogApp,
```

**Modify:** `peers-ui/src/components/router.tsx`

```typescript
import "../screens/blog";
```

## Files to Create/Modify

**New:**
- `peers-ui/src/system-apps/blog.app.ts`
- `peers-ui/src/screens/blog/blog-post-list.tsx`
- `peers-ui/src/screens/blog/blog-post-editor.tsx`
- `peers-ui/src/screens/blog/blog-post-view.tsx`
- `peers-ui/src/screens/blog/index.ts`

**Modify:**
- `peers-ui/src/system-apps/index.ts` - Add blogApp
- `peers-ui/src/components/router.tsx` - Import screens

## Effort Estimate

1-2 days

