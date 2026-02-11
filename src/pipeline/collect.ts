import Parser from "rss-parser";
import { neon } from "@neondatabase/serverless";

const RSS_FEEDS = [
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    name: "MIT Tech Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
  },
];

interface CollectedItem {
  title: string;
  url: string;
  source: string;
  summary: string | null;
  content_snippet: string | null;
  published_at: Date | null;
}

export async function collectNews(): Promise<CollectedItem[]> {
  const parser = new Parser({
    timeout: 10000,
    headers: {
      "User-Agent": "AI-AppPro-Newsletter-Bot/1.0",
    },
  });

  const allItems: CollectedItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[collect] Fetching RSS: ${feed.name}...`);
      const result = await parser.parseURL(feed.url);

      const items = (result.items || []).slice(0, 10).map((item) => ({
        title: item.title || "Untitled",
        url: item.link || "",
        source: feed.name,
        summary: item.contentSnippet?.slice(0, 500) || null,
        content_snippet: item.content?.slice(0, 1000) || null,
        published_at: item.pubDate ? new Date(item.pubDate) : null,
      }));

      allItems.push(...items);
      console.log(`[collect] ${feed.name}: ${items.length} items`);
    } catch (err) {
      console.error(`[collect] Error fetching ${feed.name}:`, err);
    }
  }

  console.log(`[collect] Total collected: ${allItems.length} items`);
  return allItems;
}

export async function saveCollectedNews(
  items: CollectedItem[]
): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error("[collect] DATABASE_URL not set");
    return 0;
  }

  const sql = neon(process.env.DATABASE_URL);
  let saved = 0;

  for (const item of items) {
    if (!item.url) continue;
    try {
      await sql`
        INSERT INTO collected_news (title, url, source, summary, content_snippet, published_at)
        VALUES (${item.title}, ${item.url}, ${item.source}, ${item.summary}, ${item.content_snippet}, ${item.published_at?.toISOString() || null})
        ON CONFLICT (url) DO NOTHING
      `;
      saved++;
    } catch (err) {
      // Duplicate URL, skip silently
    }
  }

  console.log(`[collect] Saved ${saved} new items to DB`);
  return saved;
}

export async function getUnusedNews(
  limit: number = 10
): Promise<CollectedItem[]> {
  if (!process.env.DATABASE_URL) {
    console.error("[collect] DATABASE_URL not set");
    return [];
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT title, url, source, summary, content_snippet, published_at
    FROM collected_news
    WHERE used_in_newsletter = false
    ORDER BY published_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows as CollectedItem[];
}

export async function markNewsAsUsed(urls: string[]): Promise<void> {
  if (!process.env.DATABASE_URL || urls.length === 0) return;

  const sql = neon(process.env.DATABASE_URL);
  await sql`
    UPDATE collected_news SET used_in_newsletter = true
    WHERE url = ANY(${urls})
  `;
}

// CLI entry point
if (process.argv[1]?.includes("collect")) {
  (async () => {
    const items = await collectNews();
    const saved = await saveCollectedNews(items);
    console.log(`[collect] Done. ${saved} new items saved.`);
  })();
}
