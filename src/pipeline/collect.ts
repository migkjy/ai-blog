import Parser from "rss-parser";
import { neon } from "@neondatabase/serverless";

// --- RSS Feed Sources (from content-strategy.md) ---

export interface FeedSource {
  name: string;
  url: string;
  lang: "en" | "ko";
  grade: "S" | "A" | "B";
  category: "news" | "official" | "community" | "research";
}

export const RSS_FEEDS: FeedSource[] = [
  // === International AI News (English) ===
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    lang: "en",
    grade: "A",
    category: "news",
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    lang: "en",
    grade: "A",
    category: "news",
  },
  {
    name: "MIT Tech Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    lang: "en",
    grade: "S",
    category: "news",
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    lang: "en",
    grade: "A",
    category: "news",
  },
  {
    name: "Hacker News AI",
    url: "https://hnrss.org/best?q=AI+OR+LLM+OR+GPT",
    lang: "en",
    grade: "A",
    category: "community",
  },

  // === Official Blogs ===
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    lang: "en",
    grade: "S",
    category: "official",
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    lang: "en",
    grade: "S",
    category: "official",
  },
  {
    name: "Anthropic Blog",
    url: "https://www.anthropic.com/rss.xml",
    lang: "en",
    grade: "S",
    category: "official",
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    lang: "en",
    grade: "A",
    category: "official",
  },
  {
    name: "NVIDIA AI Blog",
    url: "https://blogs.nvidia.com/feed/",
    lang: "en",
    grade: "A",
    category: "official",
  },

  // === Korean AI News ===
  {
    name: "AI타임스",
    url: "https://www.aitimes.com/rss/allArticle.xml",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "인공지능신문",
    url: "https://www.aitimes.kr/rss/allArticle.xml",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "ZDNet Korea AI",
    url: "https://zdnet.co.kr/rss/news_ai.xml",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "블로터",
    url: "https://www.bloter.net/feed",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "ITWorld Korea",
    url: "https://www.itworld.co.kr/rss/feed",
    lang: "ko",
    grade: "A",
    category: "news",
  },

  // === Community / Reddit ===
  {
    name: "Reddit r/artificial",
    url: "https://www.reddit.com/r/artificial/.rss",
    lang: "en",
    grade: "B",
    category: "community",
  },
  {
    name: "Reddit r/LocalLLaMA",
    url: "https://www.reddit.com/r/LocalLLaMA/.rss",
    lang: "en",
    grade: "A",
    category: "community",
  },
];

export interface CollectedItem {
  title: string;
  url: string;
  source: string;
  lang: string;
  grade: string;
  category: string;
  summary: string | null;
  content_snippet: string | null;
  published_at: Date | null;
}

/**
 * Normalize a URL for deduplication.
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign",
      "utm_content", "utm_term", "ref", "source",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
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
 * Check if two titles are similar enough to be duplicates.
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
    if (seen.has(normalizedUrl)) continue;

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

/**
 * Collect news from all configured RSS feeds.
 */
export async function collectNews(): Promise<CollectedItem[]> {
  const parser = new Parser({
    timeout: 10000,
    headers: {
      "User-Agent": "AI-AppPro-ContentPipeline/2.0",
    },
  });

  const allItems: CollectedItem[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`[collect] Fetching: ${feed.name} (${feed.lang}, ${feed.grade})...`);
      const result = await parser.parseURL(feed.url);

      const items = (result.items || []).slice(0, 10).map((item) => ({
        title: item.title || "Untitled",
        url: item.link || "",
        source: feed.name,
        lang: feed.lang,
        grade: feed.grade,
        category: feed.category,
        summary: item.contentSnippet?.slice(0, 500) || null,
        content_snippet: item.content?.slice(0, 1000) || null,
        published_at: item.pubDate ? new Date(item.pubDate) : null,
      }));

      allItems.push(...items);
      successCount++;
      console.log(`[collect]   ${feed.name}: ${items.length} items`);
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[collect]   ${feed.name}: FAILED — ${msg}`);
    }
  }

  const deduped = deduplicateNews(allItems);
  console.log(
    `[collect] Summary: ${successCount}/${RSS_FEEDS.length} feeds OK, ` +
    `${failCount} failed, ${allItems.length} raw → ${deduped.length} after dedup`
  );
  return deduped;
}

/**
 * Save collected news to DB. Returns count of newly inserted items.
 */
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

/**
 * Get recent unused news from DB, optionally filtered by language.
 */
export async function getUnusedNews(
  limit: number = 10,
  lang?: "en" | "ko"
): Promise<CollectedItem[]> {
  if (!process.env.DATABASE_URL) {
    console.error("[collect] DATABASE_URL not set");
    return [];
  }

  const sql = neon(process.env.DATABASE_URL);

  if (lang) {
    // Filter by source language using source name heuristic
    const koSources = RSS_FEEDS.filter((f) => f.lang === "ko").map((f) => f.name);
    if (lang === "ko") {
      const rows = await sql`
        SELECT title, url, source, summary, content_snippet, published_at
        FROM collected_news
        WHERE used_in_newsletter = false
          AND source = ANY(${koSources})
        ORDER BY published_at DESC NULLS LAST
        LIMIT ${limit}
      `;
      return rows as CollectedItem[];
    } else {
      const rows = await sql`
        SELECT title, url, source, summary, content_snippet, published_at
        FROM collected_news
        WHERE used_in_newsletter = false
          AND NOT (source = ANY(${koSources}))
        ORDER BY published_at DESC NULLS LAST
        LIMIT ${limit}
      `;
      return rows as CollectedItem[];
    }
  }

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

    // Print source breakdown
    const bySource = new Map<string, number>();
    for (const item of items) {
      bySource.set(item.source, (bySource.get(item.source) || 0) + 1);
    }
    console.log("\n--- Source Breakdown ---");
    for (const [source, count] of bySource) {
      console.log(`  ${source}: ${count}`);
    }

    console.log(`\n[collect] Done. ${saved} new items saved.`);
  })();
}
