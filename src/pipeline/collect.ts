import Parser from "rss-parser";
import { createClient } from "@libsql/client/web";

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
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
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
    url: "https://cdn.aitimes.com/rss/gn_rss_allArticle.xml",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "테크니들",
    url: "https://techneedle.com/feed",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "ZDNet Korea",
    url: "https://feeds.feedburner.com/zdkorea",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "전자신문",
    url: "https://rss.etnews.com/Section901.xml",
    lang: "ko",
    grade: "A",
    category: "news",
  },
  {
    name: "ITWorld Korea",
    url: "https://www.itworld.co.kr/feed/",
    lang: "ko",
    grade: "A",
    category: "news",
  },

  // === Community / Tech Aggregators ===
  {
    name: "Hacker News AI Latest",
    url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT",
    lang: "en",
    grade: "B",
    category: "community",
  },
  {
    name: "Techmeme",
    url: "https://www.techmeme.com/feed.xml",
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

// --- 1단계 경량 필터링 (토큰 소비 0) ---

/** 5대 필라 키워드 매칭 테이블 */
const PILLAR_KEYWORDS: Record<string, string[]> = {
  "월요일_AI주간동향": [
    "ai", "인공지능", "chatgpt", "claude", "gemini", "gpt", "llm",
    "모델", "발표", "출시", "launch", "release", "announce", "model",
    "openai", "anthropic", "google", "meta", "microsoft",
  ],
  "화요일_실무활용": [
    "활용", "사용법", "팁", "튜토리얼", "업무", "자동화", "생산성",
    "워크플로우", "how to", "guide", "tutorial", "productivity",
    "workflow", "automate", "automation", "tips",
  ],
  "수요일_도구리뷰": [
    "도구", "툴", "서비스", "앱", "플랫폼", "비교", "리뷰", "추천",
    "tool", "app", "platform", "review", "compare", "alternative",
    "service", "software",
  ],
  "목요일_비즈니스": [
    "스타트업", "창업", "비즈니스", "수익", "마케팅", "고객", "매출",
    "saas", "startup", "business", "revenue", "marketing", "customer",
    "sales", "ecommerce", "entrepreneur",
  ],
  "금요일_트렌드": [
    "트렌드", "미래", "전망", "예측", "연구", "논문", "기술", "혁신",
    "trend", "future", "forecast", "research", "paper", "innovation",
    "breakthrough", "study",
  ],
};

/** 즉시 제거 키워드 (광고성/무관) */
const REJECT_KEYWORDS = [
  "할인", "프로모션", "이벤트 참여", "무료 증정", "쿠폰",
  "sale", "giveaway", "sweepstakes",
];

/** 무관 카테고리 키워드 (스포츠/연예/정치) */
const IRRELEVANT_KEYWORDS = [
  "스포츠", "연예", "정치", "아이돌", "야구", "축구",
  "sports", "celebrity", "politics", "entertainment",
];

/**
 * Count how many pillar keywords match in the given text.
 * Returns the total across all pillars.
 */
function countPillarKeywordMatches(text: string): number {
  const lower = text.toLowerCase();
  let totalMatches = 0;
  for (const keywords of Object.values(PILLAR_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        totalMatches++;
      }
    }
  }
  return totalMatches;
}

/**
 * 1단계 경량 필터: 필라 키워드 매칭 + 등급 기반 통과 여부 판단.
 * AI 호출 없음 (토큰 소비 0).
 *
 * - S등급: 무조건 통과
 * - A등급: 키워드 1개 이상 매칭 시 통과
 * - B등급: 키워드 2개 이상 매칭 시만 통과
 * - 광고성/무관 기사: 즉시 제거
 */
export function filterByPillar(articles: CollectedItem[]): CollectedItem[] {
  const result: CollectedItem[] = [];
  let passCount = 0;
  let rejectAd = 0;
  let rejectIrrelevant = 0;
  let rejectKeyword = 0;

  for (const article of articles) {
    const titleLower = article.title.toLowerCase();

    // 즉시 제거: 광고성 키워드
    if (REJECT_KEYWORDS.some((kw) => titleLower.includes(kw.toLowerCase()))) {
      rejectAd++;
      continue;
    }

    // 즉시 제거: 무관 카테고리
    if (IRRELEVANT_KEYWORDS.some((kw) => titleLower.includes(kw.toLowerCase()))) {
      rejectIrrelevant++;
      continue;
    }

    // S등급: 무조건 통과
    if (article.grade === "S") {
      result.push(article);
      passCount++;
      continue;
    }

    // 키워드 매칭 카운트 (제목 기준)
    const matches = countPillarKeywordMatches(article.title);

    // A등급: 1개 이상
    if (article.grade === "A" && matches >= 1) {
      result.push(article);
      passCount++;
      continue;
    }

    // B등급: 2개 이상
    if (article.grade === "B" && matches >= 2) {
      result.push(article);
      passCount++;
      continue;
    }

    // 등급 미지정 or 기준 미달
    rejectKeyword++;
  }

  const total = articles.length;
  const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : "0";
  console.log(
    `[filter] 1단계 필터: ${total}건 → ${passCount}건 통과 (${passRate}%) | ` +
    `광고 제거: ${rejectAd}, 무관 제거: ${rejectIrrelevant}, 키워드 미달: ${rejectKeyword}`
  );

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

  // 1단계 경량 필터링: 필라 키워드 매칭 (토큰 소비 0)
  const filtered = filterByPillar(deduped);

  return filtered;
}

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * Save collected news to DB. Returns count of newly inserted items.
 */
export async function saveCollectedNews(
  items: CollectedItem[]
): Promise<number> {
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[collect] CONTENT_OS_DB_URL not set");
    return 0;
  }

  const db = getContentDb();
  let saved = 0;

  for (const item of items) {
    if (!item.url) continue;
    const normalizedUrl = normalizeUrl(item.url);
    try {
      await db.execute({
        sql: 'INSERT INTO collected_news (title, url, source, summary, content_snippet, published_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (url) DO NOTHING',
        args: [item.title, normalizedUrl, item.source, item.summary, item.content_snippet, item.published_at?.toISOString() || null],
      });
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
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[collect] CONTENT_OS_DB_URL not set");
    return [];
  }

  const db = getContentDb();

  if (lang) {
    const koSources = RSS_FEEDS.filter((f) => f.lang === "ko").map((f) => f.name);
    if (koSources.length === 0) {
      const result = await db.execute({
        sql: 'SELECT title, url, source, summary, content_snippet, published_at FROM collected_news WHERE used_in_newsletter = 0 ORDER BY published_at DESC LIMIT ?',
        args: [limit],
      });
      return result.rows as unknown as CollectedItem[];
    }

    const placeholders = koSources.map(() => '?').join(', ');

    if (lang === "ko") {
      const result = await db.execute({
        sql: `SELECT title, url, source, summary, content_snippet, published_at FROM collected_news WHERE used_in_newsletter = 0 AND source IN (${placeholders}) ORDER BY published_at DESC LIMIT ?`,
        args: [...koSources, limit],
      });
      return result.rows as unknown as CollectedItem[];
    } else {
      const result = await db.execute({
        sql: `SELECT title, url, source, summary, content_snippet, published_at FROM collected_news WHERE used_in_newsletter = 0 AND source NOT IN (${placeholders}) ORDER BY published_at DESC LIMIT ?`,
        args: [...koSources, limit],
      });
      return result.rows as unknown as CollectedItem[];
    }
  }

  const result = await db.execute({
    sql: 'SELECT title, url, source, summary, content_snippet, published_at FROM collected_news WHERE used_in_newsletter = 0 ORDER BY published_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as CollectedItem[];
}

export async function markNewsAsUsed(urls: string[]): Promise<void> {
  if (!process.env.CONTENT_OS_DB_URL || urls.length === 0) return;

  const db = getContentDb();
  const placeholders = urls.map(() => '?').join(', ');
  await db.execute({
    sql: `UPDATE collected_news SET used_in_newsletter = 1 WHERE url IN (${placeholders})`,
    args: urls,
  });
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
