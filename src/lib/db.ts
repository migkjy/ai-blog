import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

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
  const rows = await sql`
    SELECT * FROM blog_posts
    WHERE published = true
    ORDER BY published_at DESC NULLS LAST, created_at DESC
  `;
  return rows as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const rows = await sql`
    SELECT * FROM blog_posts
    WHERE slug = ${slug} AND published = true
    LIMIT 1
  `;
  return (rows[0] as BlogPost) ?? null;
}

export async function getAllSlugs(): Promise<string[]> {
  const rows = await sql`
    SELECT slug FROM blog_posts WHERE published = true
  `;
  return rows.map((r) => r.slug as string);
}

export async function getCategories(): Promise<{ category: string; count: number }[]> {
  const rows = await sql`
    SELECT category, COUNT(*)::int as count
    FROM blog_posts
    WHERE published = true AND category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
  `;
  return rows as { category: string; count: number }[];
}

export async function getPostsByCategory(category: string): Promise<BlogPost[]> {
  const rows = await sql`
    SELECT * FROM blog_posts
    WHERE published = true AND category = ${category}
    ORDER BY published_at DESC NULLS LAST, created_at DESC
  `;
  return rows as BlogPost[];
}

export async function getRelatedPosts(slug: string, category: string, limit: number = 3): Promise<BlogPost[]> {
  const rows = await sql`
    SELECT * FROM blog_posts
    WHERE published = true AND category = ${category} AND slug != ${slug}
    ORDER BY published_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows as BlogPost[];
}

export async function getAdjacentPosts(slug: string): Promise<{
  prev: Pick<BlogPost, 'title' | 'slug'> | null;
  next: Pick<BlogPost, 'title' | 'slug'> | null;
}> {
  const current = await sql`
    SELECT published_at, created_at FROM blog_posts
    WHERE slug = ${slug} AND published = true
    LIMIT 1
  `;
  if (current.length === 0) return { prev: null, next: null };

  const publishedAt = current[0].published_at ?? current[0].created_at;

  const [prevRows, nextRows] = await Promise.all([
    sql`
      SELECT title, slug FROM blog_posts
      WHERE published = true
        AND COALESCE(published_at, created_at) < ${publishedAt}
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 1
    `,
    sql`
      SELECT title, slug FROM blog_posts
      WHERE published = true
        AND COALESCE(published_at, created_at) > ${publishedAt}
      ORDER BY COALESCE(published_at, created_at) ASC
      LIMIT 1
    `,
  ]);

  return {
    prev: prevRows.length > 0 ? (prevRows[0] as Pick<BlogPost, 'title' | 'slug'>) : null,
    next: nextRows.length > 0 ? (nextRows[0] as Pick<BlogPost, 'title' | 'slug'>) : null,
  };
}
