# Blog Data Model

## Overview

Create a data model for blog posts that supports drafts, publishing, tags, cover images, and markdown content with embedded media.

## Schema

**File:** `peers-sdk/src/data/blog-posts.ts`

```typescript
import { z } from 'zod';

export const blogPostStatusSchema = z.enum(['draft', 'published', 'archived']);
export type BlogPostStatus = z.infer<typeof blogPostStatusSchema>;

export const blogPostSchema = z.object({
  postId: zodPeerId,
  title: z.string().describe('The title of the blog post'),
  slug: z.string().describe('URL-friendly identifier for the post'),
  content: z.string().describe('The markdown content of the blog post'),
  excerpt: z.string().optional().describe('A short summary of the post'),
  authorId: z.string().describe('The userId of the post author'),
  status: blogPostStatusSchema.describe('The publication status'),
  publishedAt: z.date().optional().describe('When the post was published'),
  coverImageFileId: z.string().optional().describe('The fileId of the cover image'),
  tags: z.string().array().optional().describe('Tags for categorizing'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type IBlogPost = z.infer<typeof blogPostSchema>;
```

## Database Indexes

```typescript
const metaData: ITableMetaData = {
  name: 'BlogPosts',
  description: 'Blog posts for public publishing',
  primaryKeyName: 'postId',
  fields: schemaToFields(blogPostSchema),
  indexes: [
    { fields: ['authorId'] },
    { fields: ['status'] },
    { fields: ['slug'], unique: true },
    { fields: ['status', { name: 'publishedAt', order: 'DESC' }] },
    { fields: ['authorId', { name: 'createdAt', order: 'DESC' }] },
  ]
};
```

## Table Access Function

```typescript
export function BlogPosts(dataContext?: DataContext) {
  return getTableContainer(dataContext).getTable<IBlogPost>(metaData, blogPostSchema);
}
```

## Helper Functions

### Generate Slug

```typescript
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')     // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 100);            // Limit length
}
```

### Create Blog Post

```typescript
export async function createBlogPost(
  title: string,
  authorId: string,
  content: string = '',
  dataContext?: DataContext
): Promise<IBlogPost> {
  const now = new Date();
  const slug = generateSlug(title) + '-' + newid().substring(0, 8);
  
  const post: IBlogPost = {
    postId: newid(),
    title,
    slug,
    content,
    authorId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  
  return BlogPosts(dataContext).save(post);
}
```

### Publish Blog Post

```typescript
export async function publishBlogPost(
  postId: string,
  dataContext?: DataContext
): Promise<IBlogPost | null> {
  const post = await BlogPosts(dataContext).get(postId);
  if (!post) return null;
  
  post.status = 'published';
  post.publishedAt = new Date();
  post.updatedAt = new Date();
  
  return BlogPosts(dataContext).save(post);
}
```

### Query Functions

```typescript
export async function getPublishedPosts(
  limit?: number,
  dataContext?: DataContext
): Promise<IBlogPost[]> {
  return BlogPosts(dataContext).list(
    { status: 'published' },
    { sortBy: [{ name: 'publishedAt', order: 'DESC' }], limit }
  );
}

export async function getPostBySlug(
  slug: string,
  dataContext?: DataContext
): Promise<IBlogPost | null> {
  return BlogPosts(dataContext).findOne({ slug });
}
```

## Export from Data Index

**Modify:** `peers-sdk/src/data/index.ts`

```typescript
export * from "./blog-posts";
```

## Files to Create/Modify

**New:**
- `peers-sdk/src/data/blog-posts.ts`

**Modify:**
- `peers-sdk/src/data/index.ts` - Add export

## Effort Estimate

0.5 days

