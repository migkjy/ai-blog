import Parser from "rss-parser";
import { neon } from "@neondatabase/serverless";

const RSS_FEEDS = [
  // International AI news (English)
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    lang: "en",
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    lang: "en",
  },
  {
    name: "MIT Tech Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    lang: "en",
  },
  // Korean AI news
  {
    name: "AI타임스",
    url: "https://www.aitimes.com/rss/allArticle.xml",
    lang: "ko",
  },
  {
    name: "인공지능신문",
    url: "https://www.aitimes.kr/rss/allArticle.xml",
    lang: "ko",
  },
  {
    name: "ZDNet Korea AI",
    url: "https://zdnet.co.kr/rss/news_ai.xml",
    lang: "ko",
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

/**
 * Normalize a URL for deduplication.
 * Removes trailing slashes, query params for tracking, and normalizes protocol.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Remove trailing slash
    let normalized = parsed.toString();
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if two titles are similar enough to be considered duplicates.
 * Uses a simple word overlap heuristic.
 */
function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, "").split(/\s+/).filter(Boolean);

  const wordsA = normalize(a);
  const wordsB = normalize(b);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setA = new Set(wordsA);
  const overlap = wordsB.filter((w) => setA.has(w)).length;
  const overlapRatio = overlap / Math.min(wordsA.length, wordsB.length);

  return overlapRatio > 0.7;
}

/**
 * Deduplicate news items by URL normalization and title similarity.
 */
function deduplicateNews(items: CollectedItem[]): CollectedItem[] {
  const seen = new Map<string, CollectedItem>();
  const result: CollectedItem[] = [];

  for (const item of items) {
    const normalizedUrl = normalizeUrl(item.url);

    // Check URL-based duplicate
    if (seen.has(normalizedUrl)) continue;

    // Check title-based duplicate
    let isDuplicate = false;
    for (const existing of result) {
      if (isSimilarTitle(item.title, existing.title)) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    seen.set(normalizedUrl, item);
    result.push(item);
  }

  return result;
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
      console.log(`[collect] Fetching RSS: ${feed.name} (${feed.lang})...`);
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
      // Korean RSS feeds may be unreliable; log warning but continue
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[collect] Error fetching ${feed.name}: ${msg}`);
    }
  }

  // Deduplicate before returning
  const deduped = deduplicateNews(allItems);
  console.log(`[collect] Total collected: ${allItems.length} items, after dedup: ${deduped.length}`);
  return deduped;
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
    const normalizedUrl = normalizeUrl(item.url);
    try {
      await sql`
        INSERT INTO collected_news (title, url, source, summary, content_snippet, published_at)
        VALUES (${item.title}, ${normalizedUrl}, ${item.source}, ${item.summary}, ${item.content_snippet}, ${item.published_at?.toISOString() || null})
        ON CONFLICT (url) DO NOTHING
      `;
      saved++;
    } catch {
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
