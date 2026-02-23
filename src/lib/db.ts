import { createClient } from '@libsql/client';

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
  published_at: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE published = 1 ORDER BY published_at DESC, created_at DESC',
    args: [],
  });
  return result.rows as unknown as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1',
    args: [slug],
  });
  return (result.rows[0] as unknown as BlogPost) ?? null;
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
    sql: 'SELECT * FROM blog_posts WHERE published = 1 AND category = ? ORDER BY published_at DESC, created_at DESC',
    args: [category],
  });
  return result.rows as unknown as BlogPost[];
}

export async function getRelatedPosts(slug: string, category: string, limit: number = 3): Promise<BlogPost[]> {
  const result = await client.execute({
    sql: 'SELECT * FROM blog_posts WHERE published = 1 AND category = ? AND slug != ? ORDER BY published_at DESC LIMIT ?',
    args: [category, slug, limit],
  });
  return result.rows as unknown as BlogPost[];
}

export async function getAdjacentPosts(slug: string): Promise<{
  prev: Pick<BlogPost, 'title' | 'slug'> | null;
  next: Pick<BlogPost, 'title' | 'slug'> | null;
}> {
  const current = await client.execute({
    sql: 'SELECT published_at, created_at FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1',
    args: [slug],
  });
  if (current.rows.length === 0) return { prev: null, next: null };

  const publishedAt = current.rows[0].published_at ?? current.rows[0].created_at;

  const [prevResult, nextResult] = await Promise.all([
    client.execute({
      sql: 'SELECT title, slug FROM blog_posts WHERE published = 1 AND COALESCE(published_at, created_at) < ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1',
      args: [publishedAt as string],
    }),
    client.execute({
      sql: 'SELECT title, slug FROM blog_posts WHERE published = 1 AND COALESCE(published_at, created_at) > ? ORDER BY COALESCE(published_at, created_at) ASC LIMIT 1',
      args: [publishedAt as string],
    }),
  ]);

  return {
    prev: prevResult.rows.length > 0 ? (prevResult.rows[0] as unknown as Pick<BlogPost, 'title' | 'slug'>) : null,
    next: nextResult.rows.length > 0 ? (nextResult.rows[0] as unknown as Pick<BlogPost, 'title' | 'slug'>) : null,
  };
}
