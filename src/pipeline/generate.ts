import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { getUnusedNews, markNewsAsUsed } from "./collect";

const PROMPT_PATH = join(process.cwd(), "prompts", "newsletter.md");

// AI Directory tool slugs for link injection
const AI_DIRECTORY_BASE = "https://ai-directory-seven.vercel.app";
const POPULAR_TOOLS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  midjourney: "Midjourney",
  "dall-e-3": "DALL-E 3",
  "canva-ai": "Canva AI",
  "github-copilot": "GitHub Copilot",
  cursor: "Cursor",
  "notion-ai": "Notion AI",
  jasper: "Jasper",
  grammarly: "Grammarly",
  "copy-ai": "Copy.ai",
  "surfer-seo": "Surfer SEO",
  tidio: "Tidio",
  "julius-ai": "Julius AI",
  sora: "Sora",
  runway: "Runway",
  heygen: "HeyGen",
  elevenlabs: "ElevenLabs",
  perplexity: "Perplexity",
  "zapier-ai": "Zapier AI",
};

function loadPromptTemplate(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8");
  } catch {
    console.error(`[generate] Prompt template not found at ${PROMPT_PATH}`);
    return getDefaultPrompt();
  }
}

function getDefaultPrompt(): string {
  return `당신은 한국 소상공인을 위한 AI 뉴스레터 편집자입니다.
아래 AI 관련 뉴스를 바탕으로, 한국 소상공인이 이해하기 쉬운 주간 뉴스레터를 작성해주세요.

## 작성 규칙
- 한국어로 작성
- 친근하지만 전문적인 톤
- 각 뉴스를 한국 소상공인 관점에서 해석
- 실제 활용 팁 포함
- 2,000~3,000자 분량
- AI 도구 링크 형식: <a href="${AI_DIRECTORY_BASE}/tools/{slug}">{도구명}</a>
- 반드시 JSON 형식으로 출력: { "subject": "...", "html_content": "...", "plain_content": "..." }`;
}

interface CollectedNewsItem {
  title: string;
  url: string;
  source: string;
  summary: string | null;
  content_snippet: string | null;
  published_at: Date | null;
  relevance_score?: number;
}

interface GeneratedNewsletter {
  subject: string;
  html_content: string;
  plain_content: string;
  news_urls: string[];
}

/**
 * Score news relevance for Korean SMB audience.
 * Higher score = more relevant to our target readers.
 */
function scoreNewsRelevance(item: CollectedNewsItem): number {
  const text = `${item.title} ${item.summary || ""} ${item.content_snippet || ""}`.toLowerCase();
  let score = 0;

  // High relevance: business/practical keywords
  const highKeywords = [
    "small business", "smb", "소상공인", "startup", "entrepreneur",
    "free", "pricing", "cost", "cheap", "affordable",
    "marketing", "customer", "sales", "ecommerce", "shop",
    "tool", "app", "launch", "release", "update", "new feature",
    "automation", "automate", "workflow", "productivity",
    "korean", "korea", "한국",
  ];

  // Medium relevance: general AI topics
  const medKeywords = [
    "chatgpt", "claude", "openai", "anthropic", "google", "gemini",
    "image", "video", "voice", "text", "writing",
    "api", "plugin", "integration",
  ];

  // Low relevance: technical/research (less useful for SMB)
  const lowKeywords = [
    "research", "paper", "benchmark", "model", "training",
    "regulation", "policy", "safety", "alignment",
  ];

  for (const kw of highKeywords) {
    if (text.includes(kw)) score += 3;
  }
  for (const kw of medKeywords) {
    if (text.includes(kw)) score += 1;
  }
  for (const kw of lowKeywords) {
    if (text.includes(kw)) score -= 1;
  }

  // Recency bonus: newer items get a boost
  if (item.published_at) {
    const daysAgo = (Date.now() - new Date(item.published_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 2) score += 3;
    else if (daysAgo <= 5) score += 1;
  }

  return score;
}

/**
 * Select and rank news items for newsletter generation.
 * Prioritizes: business relevance > recency > variety of sources.
 */
function selectNewsForNewsletter(
  news: CollectedNewsItem[],
  maxItems: number = 8
): CollectedNewsItem[] {
  // Score all items
  const scored = news.map((item) => ({
    ...item,
    relevance_score: scoreNewsRelevance(item),
  }));

  // Sort by relevance score (descending)
  scored.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));

  // Ensure source diversity: max 3 items from same source
  const selected: CollectedNewsItem[] = [];
  const sourceCounts: Record<string, number> = {};

  for (const item of scored) {
    if (selected.length >= maxItems) break;
    const count = sourceCounts[item.source] || 0;
    if (count >= 3) continue;
    selected.push(item);
    sourceCounts[item.source] = count + 1;
  }

  return selected;
}

/**
 * Build the available AI tools context for the prompt.
 */
function buildToolContext(): string {
  const toolLines = Object.entries(POPULAR_TOOLS)
    .map(([slug, name]) => `- ${name}: ${AI_DIRECTORY_BASE}/tools/${slug}`)
    .join("\n");

  return `## 사용 가능한 AI 디렉토리 도구 링크

아래 도구들을 뉴스와 관련된 곳에 자연스럽게 삽입하세요:

${toolLines}

카테고리 페이지:
- 코딩 도구: ${AI_DIRECTORY_BASE}/category/coding
- 마케팅 도구: ${AI_DIRECTORY_BASE}/category/marketing
- 이미지 생성: ${AI_DIRECTORY_BASE}/category/image
- 영상 제작: ${AI_DIRECTORY_BASE}/category/video
- 글쓰기: ${AI_DIRECTORY_BASE}/category/writing
- 생산성: ${AI_DIRECTORY_BASE}/category/productivity
- 고객서비스: ${AI_DIRECTORY_BASE}/category/customer_service
- 데이터분석: ${AI_DIRECTORY_BASE}/category/data
- 교육: ${AI_DIRECTORY_BASE}/category/education
- 음성/오디오: ${AI_DIRECTORY_BASE}/category/audio`;
}

export async function generateNewsletter(): Promise<GeneratedNewsletter | null> {
  // 1. Get unused news
  const rawNews = await getUnusedNews(20);
  if (rawNews.length === 0) {
    console.log("[generate] No unused news found. Run collect first.");
    return null;
  }

  // 2. Select best news items by relevance
  const news = selectNewsForNewsletter(rawNews, 8);
  console.log(`[generate] Selected ${news.length}/${rawNews.length} news items by relevance`);

  // 3. Build prompt
  const promptTemplate = loadPromptTemplate();
  const toolContext = buildToolContext();

  const newsSection = news
    .map(
      (n, i) =>
        `### ${i + 1}. ${n.title}\n- 출처: ${n.source}\n- URL: ${n.url}\n- 요약: ${n.summary || "N/A"}\n- 관련성 점수: ${n.relevance_score ?? 0}`
    )
    .join("\n\n");

  const fullPrompt = `${promptTemplate}

---

${toolContext}

---

## 이번 주 수집된 뉴스 (관련성 순으로 정렬됨)

${newsSection}

---

위 뉴스를 바탕으로 뉴스레터를 작성해주세요. 반드시 아래 JSON 형식으로 출력하세요:

\`\`\`json
{
  "subject": "[AI AppPro] 뉴스레터 제목",
  "html_content": "<h2>...</h2><p>...</p> (인라인 스타일 포함 HTML)",
  "plain_content": "텍스트 버전"
}
\`\`\``;

  // 4. Call Claude API
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[generate] ANTHROPIC_API_KEY not set. Generating mock newsletter.");
    return generateMockNewsletter(news);
  }

  try {
    console.log("[generate] Calling Claude Sonnet API...");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: fullPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      console.error("[generate] Failed to parse JSON from Claude response");
      console.error("[generate] Raw response (first 500 chars):", responseText.slice(0, 500));
      return generateMockNewsletter(news);
    }

    const parsed = JSON.parse(jsonMatch[1]);
    const result: GeneratedNewsletter = {
      subject: parsed.subject,
      html_content: parsed.html_content,
      plain_content: parsed.plain_content || "",
      news_urls: news.map((n) => n.url),
    };

    console.log(`[generate] Newsletter generated: "${result.subject}"`);
    console.log(`[generate] HTML length: ${result.html_content.length} chars`);
    return result;
  } catch (err) {
    console.error("[generate] Claude API error:", err);
    return generateMockNewsletter(news);
  }
}

/**
 * Generate a high-quality mock newsletter that resembles real output.
 * CEO may see this during testing, so quality matters.
 */
function generateMockNewsletter(
  news: CollectedNewsItem[]
): GeneratedNewsletter {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const topNews = news.slice(0, 2);
  const restNews = news.slice(2, 7);

  // Build highlight section
  const highlightHtml = topNews
    .map(
      (n) => `
      <div style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:20px 24px;margin-bottom:16px;">
        <span style="display:inline-block;background-color:#eff6ff;color:#2563eb;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;">하이라이트</span>
        <h3 style="color:#111827;font-size:17px;font-weight:600;line-height:1.5;margin:10px 0 8px;">${n.title}</h3>
        <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 12px;">${n.summary?.slice(0, 200) || "AI 업계에서 주목할 만한 소식입니다."}</p>
        <p style="color:#2563eb;font-size:13px;font-weight:500;margin:0;">소상공인 관점: 이 변화를 활용해 비즈니스 효율을 높일 수 있습니다.</p>
      </div>`
    )
    .join("\n");

  // Build news summary list
  const newsSummaryHtml = restNews
    .map(
      (n) =>
        `<li style="color:#374151;font-size:14px;line-height:1.8;margin-bottom:8px;"><strong style="color:#111827;">${n.title}</strong> (${n.source}) — ${n.summary?.slice(0, 100) || "관련 소식입니다."}</li>`
    )
    .join("\n");

  // Build tool recommendation
  const toolEntries = Object.entries(POPULAR_TOOLS);
  const randomTool = toolEntries[Math.floor(Math.random() * toolEntries.length)];

  const html_content = `
<h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 12px;">안녕하세요, AI AppPro입니다.</h2>
<p style="color:#374151;font-size:15px;line-height:1.8;margin:0 0 20px;">
  ${today} 주간 AI 브리핑을 전해드립니다. 이번 주는 소상공인에게 실질적으로 도움이 될 AI 뉴스 ${news.length}건을 선별했습니다.
</p>

<h2 style="color:#111827;font-size:20px;font-weight:700;margin:24px 0 12px;">주간 AI 하이라이트</h2>
${highlightHtml}

<h2 style="color:#111827;font-size:20px;font-weight:700;margin:24px 0 12px;">이번 주 AI 뉴스 요약</h2>
<ul style="padding-left:20px;margin:0;">
${newsSummaryHtml}
</ul>

<h2 style="color:#111827;font-size:20px;font-weight:700;margin:24px 0 12px;">이번 주 실전 활용 팁</h2>
<div style="background-color:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:4px;margin:16px 0;">
  <p style="color:#374151;font-size:15px;line-height:1.8;margin:0;">
    <strong>팁:</strong> <a href="${AI_DIRECTORY_BASE}/tools/chatgpt" style="color:#2563eb;text-decoration:underline;">ChatGPT</a>에서 "내 업종에 맞는 이번 주 SNS 게시물 5개를 작성해줘"라고 입력해보세요. 업종과 타겟 고객을 구체적으로 알려줄수록 더 좋은 결과를 얻을 수 있습니다.
  </p>
</div>

<h2 style="color:#111827;font-size:20px;font-weight:700;margin:24px 0 12px;">추천 AI 도구</h2>
<div style="background-color:#faf5ff;border:1px solid #e9d5ff;padding:16px;border-radius:8px;margin:12px 0;">
  <h4 style="color:#7c3aed;font-size:15px;font-weight:600;margin:0;">${randomTool[1]}</h4>
  <p style="color:#4b5563;font-size:13px;line-height:1.6;margin:6px 0 0;">
    소상공인의 업무 효율을 높여주는 AI 도구입니다.
    <a href="${AI_DIRECTORY_BASE}/tools/${randomTool[0]}" style="color:#7c3aed;font-size:13px;font-weight:500;text-decoration:none;"> 자세히 보기 &rarr;</a>
  </p>
</div>

<p style="color:#374151;font-size:15px;line-height:1.8;margin:24px 0 8px;">
  더 많은 AI 도구가 궁금하시면 <a href="${AI_DIRECTORY_BASE}" style="color:#2563eb;text-decoration:underline;">AI AppPro 도구 디렉토리</a>를 방문해보세요. 이 뉴스레터가 도움이 되셨다면 주변 사장님에게 공유해주세요!
</p>

<p style="color:#9ca3af;font-size:12px;margin:16px 0 0;font-style:italic;">
  이 뉴스레터는 ANTHROPIC_API_KEY가 설정되면 AI가 자동으로 고품질 콘텐츠를 생성합니다. 현재는 미리보기 버전입니다.
</p>`;

  // Build plain text version
  const plainHighlights = topNews
    .map((n) => `[하이라이트] ${n.title}\n${n.summary?.slice(0, 200) || ""}\n`)
    .join("\n");

  const plainSummaries = restNews
    .map((n) => `- ${n.title} (${n.source})`)
    .join("\n");

  const plain_content = `주간 AI 브리핑 - ${today}

안녕하세요, AI AppPro입니다. 이번 주 주요 AI 뉴스를 정리했습니다.

${plainHighlights}

[이번 주 AI 뉴스 요약]
${plainSummaries}

[실전 활용 팁]
ChatGPT에서 "내 업종에 맞는 이번 주 SNS 게시물 5개를 작성해줘"라고 입력해보세요.

[추천 AI 도구]
${randomTool[1]} - ${AI_DIRECTORY_BASE}/tools/${randomTool[0]}

더 많은 AI 도구: ${AI_DIRECTORY_BASE}
---
AI AppPro - 소상공인을 위한 AI 활용 가이드`;

  return {
    subject: `[AI AppPro] ${today} 주간 AI 브리핑 — 소상공인을 위한 AI 뉴스`,
    html_content,
    plain_content,
    news_urls: news.map((n) => n.url),
  };
}

export async function saveNewsletter(
  newsletter: GeneratedNewsletter
): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    console.error("[generate] DATABASE_URL not set");
    return null;
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    INSERT INTO newsletters (subject, html_content, plain_content, status)
    VALUES (${newsletter.subject}, ${newsletter.html_content}, ${newsletter.plain_content}, 'draft')
    RETURNING id
  `;

  const id = rows[0]?.id as string;
  console.log(`[generate] Newsletter saved with id: ${id}`);

  // Mark news as used
  await markNewsAsUsed(newsletter.news_urls);

  return id;
}

// CLI entry point
if (process.argv[1]?.includes("generate")) {
  (async () => {
    const newsletter = await generateNewsletter();
    if (newsletter) {
      await saveNewsletter(newsletter);
      console.log("[generate] Done.");
    }
  })();
}
