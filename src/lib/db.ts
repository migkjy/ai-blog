import { createClient } from '@libsql/client/web';

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_DB_TOKEN!,
});

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  author: string;
  published: boolean;
  publishedAt: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRow(row: any): BlogPost {
  const post = row as BlogPost;
  if (typeof post.tags === 'string') {
    try { post.tags = JSON.parse(post.tags); } catch { post.tags = null; }
  }
  return post;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE published = 1 ORDER BY publishedAt DESC, createdAt DESC',
    args: [],
  });
  return result.rows.map(parseRow);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1',
    args: [slug],
  });
  return result.rows[0] ? parseRow(result.rows[0]) : null;
}

export async function getAllSlugs(): Promise<string[]> {
  const result = await client.execute({
    sql: 'SELECT slug FROM blog_posts WHERE published = 1',
    args: [],
  });
  return result.rows.map((r) => r.slug as string);
}

export async function getCategories(): Promise<{ category: string; count: number }[]> {
  const result = await client.execute({
    sql: 'SELECT category, COUNT(*) as count FROM blog_posts WHERE published = 1 AND category IS NOT NULL GROUP BY category ORDER BY count DESC',
    args: [],
  });
  return result.rows as unknown as { category: string; count: number }[];
}

export async function getPostsByCategory(category: string): Promise<BlogPost[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE published = 1 AND category = ? ORDER BY publishedAt DESC, createdAt DESC',
    args: [category],
  });
  return result.rows.map(parseRow);
}

export async function getRelatedPosts(slug: string, category: string, limit: number = 3): Promise<BlogPost[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE published = 1 AND category = ? AND slug != ? ORDER BY publishedAt DESC LIMIT ?',
    args: [category, slug, limit],
  });
  return result.rows.map(parseRow);
}

export async function getAdjacentPosts(slug: string): Promise<{
  prev: Pick<BlogPost, 'title' | 'slug'> | null;
  next: Pick<BlogPost, 'title' | 'slug'> | null;
}> {
  const current = await client.execute({
    sql: 'SELECT publishedAt, createdAt FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1',
    args: [slug],
  });
  if (current.rows.length === 0) return { prev: null, next: null };

  const pubAt = current.rows[0].publishedAt ?? current.rows[0].createdAt;

  const [prevResult, nextResult] = await Promise.all([
    client.execute({
      sql: 'SELECT title, slug FROM blog_posts WHERE published = 1 AND COALESCE(publishedAt, createdAt) < ? ORDER BY COALESCE(publishedAt, createdAt) DESC LIMIT 1',
      args: [pubAt as string],
    }),
    client.execute({
      sql: 'SELECT title, slug FROM blog_posts WHERE published = 1 AND COALESCE(publishedAt, createdAt) > ? ORDER BY COALESCE(publishedAt, createdAt) ASC LIMIT 1',
      args: [pubAt as string],
    }),
  ]);

  return {
    prev: prevResult.rows.length > 0 ? (prevResult.rows[0] as unknown as Pick<BlogPost, 'title' | 'slug'>) : null,
    next: nextResult.rows.length > 0 ? (nextResult.rows[0] as unknown as Pick<BlogPost, 'title' | 'slug'>) : null,
  };
}
