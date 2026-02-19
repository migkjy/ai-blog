/**
 * WordPress → Next.js blog_posts migration script
 * Fetches all published posts from blog.apppro.kr WP REST API
 * and inserts them into NeonDB blog_posts table.
 */
import { neon } from '@neondatabase/serverless';

const WP_API = 'https://blog.apppro.kr/wp-json/wp/v2';

const sql = neon(process.env.DATABASE_URL!);

// WP category ID → human-readable name
const CATEGORY_MAP: Record<number, string> = {
  1: 'Uncategorized',
  2: 'Cryptocurrency',
  3: 'Programming',
  4: 'Technologies',
};

interface WPPost {
  id: number;
  date: string;
  slug: string;
  status: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categories: number[];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8230;/g, '…')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<\/?strong>/g, '')
    .replace(/<\/?em>/g, '')
    .replace(/<\/?b>/g, '');
}

function stripHtmlForExcerpt(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function fetchAllPosts(): Promise<WPPost[]> {
  const allPosts: WPPost[] = [];
  let page = 1;
  while (true) {
    const url = `${WP_API}/posts?per_page=100&page=${page}&status=publish`;
    const res = await fetch(url);
    if (!res.ok) break;
    const posts: WPPost[] = await res.json();
    if (posts.length === 0) break;
    allPosts.push(...posts);
    page++;
  }
  return allPosts;
}

async function main() {
  console.log('Fetching WordPress posts...');
  const posts = await fetchAllPosts();
  console.log(`Found ${posts.length} published posts`);

  // Check existing slugs to avoid duplicates
  const existing = await sql`SELECT slug FROM blog_posts`;
  const existingSlugs = new Set(existing.map((r) => r.slug));
  console.log(`Existing blog_posts: ${existingSlugs.size}`);

  let inserted = 0;
  let skipped = 0;

  for (const post of posts) {
    const slug = decodeSlug(post.slug);
    if (existingSlugs.has(slug)) {
      console.log(`  SKIP (exists): ${slug}`);
      skipped++;
      continue;
    }

    const title = decodeHtmlEntities(post.title.rendered);
    const content = post.content.rendered;
    const excerpt = stripHtmlForExcerpt(post.excerpt.rendered);
    const category = post.categories.length > 0
      ? CATEGORY_MAP[post.categories[0]] || 'Uncategorized'
      : 'Uncategorized';
    const publishedAt = post.date;

    // Skip posts with empty title or content
    if (!title.trim() || !content.trim()) {
      console.log(`  SKIP (empty): id=${post.id}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO blog_posts (title, slug, content, excerpt, category, tags, author, published, published_at, meta_description)
      VALUES (
        ${title},
        ${slug},
        ${content},
        ${excerpt},
        ${category},
        ${[] as string[]},
        ${'APPPRO'},
        true,
        ${publishedAt}::timestamptz,
        ${excerpt}
      )
    `;
    console.log(`  INSERT: ${title.slice(0, 50)}...`);
    inserted++;
  }

  console.log(`\nMigration complete: ${inserted} inserted, ${skipped} skipped`);
}

main().catch(console.error);
