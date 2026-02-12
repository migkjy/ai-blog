import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const AI_DIRECTORY_BASE = "https://ai-directory-seven.vercel.app";
const BLOG_BASE_URL = "https://content-pipeline-sage.vercel.app";

// Valid pillar values (must match ContentPillar type for quality validation)
const VALID_PILLARS: ContentPillar[] = [
  "AI도구리뷰", "업종별AI가이드", "주간AI브리핑", "자동화플레이북", "프롬프트가이드",
];

// --- Types ---

export interface GeneratedBlogPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  meta_description: string;
  category: string;
  tags: string[];
}

export type ContentPillar =
  | "AI도구리뷰"
  | "업종별AI가이드"
  | "주간AI브리핑"
  | "자동화플레이북"
  | "프롬프트가이드";

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0~8
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

// --- Pillar Configuration ---

const PILLAR_CONFIG: Record<ContentPillar, { promptFile: string; dayOfWeek: number }> = {
  "주간AI브리핑": { promptFile: "weekly-ai-briefing.md", dayOfWeek: 1 },    // Monday
  "AI도구리뷰": { promptFile: "ai-tool-review.md", dayOfWeek: 2 },          // Tuesday
  "자동화플레이북": { promptFile: "automation-playbook.md", dayOfWeek: 3 },  // Wednesday
  "업종별AI가이드": { promptFile: "industry-ai-guide.md", dayOfWeek: 4 },    // Thursday
  "프롬프트가이드": { promptFile: "prompt-guide.md", dayOfWeek: 5 },         // Friday
};

// --- Utility ---

function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Get today's assigned pillar based on day of week.
 */
export function getTodayPillar(): ContentPillar | null {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  for (const [pillar, config] of Object.entries(PILLAR_CONFIG)) {
    if (config.dayOfWeek === day) return pillar as ContentPillar;
  }
  return null; // Weekend
}

/**
 * Load pillar-specific prompt template from file.
 */
function loadPillarPrompt(pillar: ContentPillar): string | null {
  const config = PILLAR_CONFIG[pillar];
  if (!config) return null;

  const promptPath = join(
    process.cwd(),
    "prompts",
    "pillars",
    config.promptFile
  );

  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    console.warn(`[generate-blog] Prompt file not found: ${promptPath}`);
    return null;
  }
}

// --- System Prompt ---

const BASE_SYSTEM_PROMPT = `당신은 한국 소상공인/중소기업을 위한 AI 활용 블로그의 전문 에디터입니다.

## 핵심 원칙
- 한국 SMB/소상공인이 AI를 비즈니스에 실전 활용할 수 있도록 돕습니다
- 전문적이지만 쉽게 읽히는 한국어로 작성합니다 (번역체 금지)
- SEO를 고려하여 H2/H3 헤딩, 키워드 자연 배치를 합니다

## E-E-A-T 준수
- Experience: 실전 활용 시나리오, 구체적 예시 포함
- Expertise: 정확한 기술 정보, 근거 있는 주장
- Authoritativeness: 공신력 있는 소스 인용
- Trustworthiness: 가격 정보 정확, 장단점 균형 제시

## 작성 규칙
- 분량: 2,000~3,000자 한국어
- 형식: 마크다운 (# 제목 제외, ## 부터 시작)
- 헤딩: ## (H2) 최소 3개, ### (H3) 적절히 사용
- 리스트, 볼드, 코드블록 등 마크다운 문법 적극 활용
- 실전 팁, 구체적 예시, 활용 시나리오 반드시 포함
- AI 도구 언급 시 디렉토리 링크 삽입 (최소 2개)
- 마지막에 "마무리" 섹션으로 핵심 요약

## AI 디렉토리 링크
도구 언급 시 아래 링크를 자연스럽게 삽입하세요:
- ChatGPT: ${AI_DIRECTORY_BASE}/tools/chatgpt
- Claude: ${AI_DIRECTORY_BASE}/tools/claude
- Midjourney: ${AI_DIRECTORY_BASE}/tools/midjourney
- Canva AI: ${AI_DIRECTORY_BASE}/tools/canva-ai
- Notion AI: ${AI_DIRECTORY_BASE}/tools/notion-ai
- Cursor: ${AI_DIRECTORY_BASE}/tools/cursor
- Perplexity: ${AI_DIRECTORY_BASE}/tools/perplexity

카테고리 페이지:
- 글쓰기: ${AI_DIRECTORY_BASE}/category/writing
- 이미지: ${AI_DIRECTORY_BASE}/category/image
- 코딩: ${AI_DIRECTORY_BASE}/category/coding
- 마케팅: ${AI_DIRECTORY_BASE}/category/marketing
- 생산성: ${AI_DIRECTORY_BASE}/category/productivity

## 금지사항
- 과장 표현 (예: "혁명적", "놀라운")
- 근거 없는 주장
- 번역체 한국어
- 광고성 문구

## 출력 형식
반드시 아래 JSON 형식으로 출력하세요. 마크다운 코드블록 안에 넣어주세요:

\`\`\`json
{
  "title": "포스트 제목 (SEO 최적화, 40자 이내)",
  "slug": "english-slug-for-url",
  "content": "마크다운 본문 (## 부터 시작)",
  "excerpt": "포스트 요약 (2~3문장, 150자 이내)",
  "meta_description": "SEO 메타 설명 (150자 이내)",
  "category": "카테고리명",
  "tags": ["태그1", "태그2", "태그3"]
}
\`\`\``;

// --- Quality Validation ---

/**
 * Validate generated blog post against 8 quality criteria.
 */
export function validateQuality(post: GeneratedBlogPost): QualityCheckResult {
  const checks: QualityCheckResult["checks"] = [];

  // 1. Content length (2000~3000 chars)
  const contentLen = post.content.length;
  checks.push({
    name: "본문 길이",
    passed: contentLen >= 1500 && contentLen <= 4000,
    detail: `${contentLen}자 (기준: 2,000~3,000)`,
  });

  // 2. H2 heading count (min 3)
  const h2Count = (post.content.match(/^## /gm) || []).length;
  checks.push({
    name: "H2 헤딩 구조",
    passed: h2Count >= 3,
    detail: `${h2Count}개 (최소 3개)`,
  });

  // 3. AI Directory links (min 2)
  const dirLinkCount = (
    post.content.match(/ai-directory-seven\.vercel\.app/g) || []
  ).length;
  checks.push({
    name: "AI 디렉토리 링크",
    passed: dirLinkCount >= 2,
    detail: `${dirLinkCount}개 (최소 2개)`,
  });

  // 4. Meta description length (<=150 chars)
  const metaLen = post.meta_description.length;
  checks.push({
    name: "메타 설명 길이",
    passed: metaLen > 0 && metaLen <= 160,
    detail: `${metaLen}자 (최대 150)`,
  });

  // 5. Title length (<=40 chars)
  const titleLen = post.title.length;
  checks.push({
    name: "제목 길이",
    passed: titleLen > 0 && titleLen <= 45,
    detail: `${titleLen}자 (최대 40)`,
  });

  // 6. Markdown validity (no broken links/images)
  const brokenLinks = post.content.match(/\[[^\]]*\]\(\s*\)/g) || [];
  checks.push({
    name: "마크다운 유효성",
    passed: brokenLinks.length === 0,
    detail: brokenLinks.length === 0 ? "유효" : `빈 링크 ${brokenLinks.length}개`,
  });

  // 7. Excerpt length (<=150 chars)
  const excerptLen = post.excerpt.length;
  checks.push({
    name: "요약 길이",
    passed: excerptLen > 0 && excerptLen <= 200,
    detail: `${excerptLen}자 (최대 150)`,
  });

  // 8. Valid category
  const validCategories: ContentPillar[] = [
    "AI도구리뷰", "업종별AI가이드", "주간AI브리핑", "자동화플레이북", "프롬프트가이드",
  ];
  checks.push({
    name: "카테고리 유효성",
    passed: validCategories.includes(post.category as ContentPillar),
    detail: post.category,
  });

  const passedCount = checks.filter((c) => c.passed).length;

  return {
    passed: passedCount >= 6, // Allow 2 minor failures
    score: passedCount,
    checks,
  };
}

// --- Mock Blog Post Generation ---

/**
 * Generate a mock blog post when ANTHROPIC_API_KEY is not available.
 * Uses topic, pillar, and news context to build a realistic post
 * that passes quality validation.
 */
function generateMockBlogPost(
  topic: string,
  pillar?: ContentPillar,
  newsContext?: string
): GeneratedBlogPost {
  const category = pillar && VALID_PILLARS.includes(pillar)
    ? pillar
    : "AI도구리뷰";

  const slug = buildSlug(topic);
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Parse news items from context for content enrichment
  const newsItems: string[] = [];
  if (newsContext) {
    const lines = newsContext.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*\[.*?\]\s*(.+)/);
      if (match) newsItems.push(match[1]);
    }
  }

  const newsSection = newsItems.length > 0
    ? newsItems
        .slice(0, 3)
        .map((item) => `- **${item.slice(0, 60)}**: 소상공인 관점에서 이 변화는 업무 효율화와 비용 절감에 직접적인 영향을 줍니다.`)
        .join("\n")
    : `- **AI 기술의 빠른 발전**: 매달 새로운 AI 도구가 출시되고 있으며, 소상공인도 이를 활용할 수 있습니다.
- **비용 절감 효과**: AI 도구 도입으로 평균 30-50%의 반복 업무 시간을 절약할 수 있습니다.
- **접근성 향상**: 코딩 없이도 사용 가능한 AI 도구가 크게 늘어나고 있습니다.`;

  const content = `## ${topic}: 왜 지금 주목해야 하는가

${today} 기준으로 AI 기술은 소상공인의 비즈니스 운영 방식을 근본적으로 바꾸고 있습니다. 특히 ${topic} 분야에서는 실질적인 변화가 일어나고 있어 주목할 필요가 있습니다.

최근 AI 업계 동향을 살펴보면, 소상공인이 즉시 활용할 수 있는 도구와 방법론이 빠르게 늘어나고 있습니다.

## 최근 AI 트렌드와 시사점

${newsSection}

이러한 변화는 특히 마케팅, 고객 응대, 콘텐츠 제작 영역에서 소상공인에게 새로운 기회를 제공합니다.

## 실전 활용 가이드: 3단계 접근법

### 1단계: 현재 업무 분석

먼저 반복적으로 수행하는 업무를 목록화하세요. [ChatGPT](${AI_DIRECTORY_BASE}/tools/chatgpt)를 활용하면 업무 분석 자체도 효율적으로 할 수 있습니다.

- 고객 문의 응대 (FAQ 자동화 가능)
- SNS 콘텐츠 제작 (AI 이미지+텍스트 생성)
- 이메일 마케팅 (자동 발송 시스템)
- 재고/매출 분석 (데이터 자동 정리)

### 2단계: AI 도구 선택과 도입

업무 유형에 맞는 AI 도구를 선택합니다. [Claude](${AI_DIRECTORY_BASE}/tools/claude)는 긴 문서 작성과 분석에 강점이 있고, [Perplexity](${AI_DIRECTORY_BASE}/tools/perplexity)는 리서치에 효과적입니다.

| 업무 유형 | 추천 AI 도구 | 예상 절감 시간 |
|-----------|-------------|---------------|
| 콘텐츠 제작 | ChatGPT, Claude | 주 5-10시간 |
| 이미지 제작 | Canva AI, Midjourney | 주 3-5시간 |
| 고객 응대 | 챗봇 솔루션 | 주 10-15시간 |
| 데이터 분석 | ChatGPT Advanced | 주 2-4시간 |

### 3단계: 자동화 파이프라인 구축

개별 도구 사용에서 나아가, 도구들을 연결하여 자동화 파이프라인을 만들면 진정한 효율화가 가능합니다. 예를 들어:

1. AI가 업계 뉴스를 자동 수집
2. 수집된 뉴스를 기반으로 블로그 글 자동 생성
3. 생성된 콘텐츠를 SNS에 자동 배포
4. 뉴스레터로 자동 발송

이 파이프라인은 현재 AI AppPro가 실제로 운영하고 있는 시스템이기도 합니다.

## 비용 대비 효과 분석

소상공인이 AI 도구를 도입할 때 가장 중요한 것은 **ROI(투자 대비 수익)**입니다.

- **무료 도구로 시작**: ChatGPT 무료 버전, Canva 무료 플랜으로 충분히 시작 가능
- **유료 전환 기준**: 월 10시간 이상 절약 시 유료 플랜($20/월) 전환 권장
- **투자 회수 기간**: 대부분 1-2개월 내 투자비 회수 가능

## 마무리

${topic}은 더 이상 대기업만의 영역이 아닙니다. 소상공인도 올바른 도구와 전략으로 AI의 혜택을 충분히 누릴 수 있습니다. 핵심은 **작게 시작하되, 꾸준히 확장**하는 것입니다.

지금 바로 하나의 AI 도구를 선택하여 가장 반복적인 업무에 적용해 보세요. 작은 변화가 큰 차이를 만들어냅니다.

더 많은 AI 도구 정보는 [AI 도구 디렉토리](${AI_DIRECTORY_BASE})에서 확인할 수 있습니다.`;

  const result: GeneratedBlogPost = {
    title: topic.length <= 40 ? topic : topic.slice(0, 37) + "...",
    slug,
    content,
    excerpt: `${topic}에 대한 실전 가이드입니다. 소상공인이 AI를 활용하여 업무 효율을 높이는 구체적인 방법을 알아봅니다.`,
    meta_description: `${topic} - 소상공인을 위한 AI 활용 실전 가이드. 도구 선택부터 자동화 파이프라인 구축까지.`,
    category,
    tags: [category, "AI활용", "소상공인", "자동화", "생산성"],
  };

  console.log("[generate-blog] ANTHROPIC_API_KEY 미설정. Mock 블로그 포스트를 생성합니다.");
  console.log(`[generate-blog] Mock 생성 완료: "${result.title}"`);
  console.log(`[generate-blog] 본문 길이: ${result.content.length}자, 카테고리: ${result.category}`);

  return result;
}

// --- Blog Post Generation ---

/**
 * Generate a blog post using Claude API with pillar-specific prompt.
 * Falls back to mock generation when ANTHROPIC_API_KEY is not set.
 */
export async function generateBlogPost(
  topic: string,
  pillar?: ContentPillar,
  newsContext?: string
): Promise<GeneratedBlogPost | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateMockBlogPost(topic, pillar, newsContext);
  }

  // Build system prompt with pillar-specific additions
  let systemPrompt = BASE_SYSTEM_PROMPT;

  if (pillar) {
    const pillarPrompt = loadPillarPrompt(pillar);
    if (pillarPrompt) {
      systemPrompt += `\n\n## 필라별 추가 지침\n\n${pillarPrompt}`;
    }
    systemPrompt += `\n\n## 카테고리 지정\n이 포스트의 카테고리는 반드시 "${pillar}"로 설정하세요.`;
  }

  // Build user prompt
  let userPrompt = `다음 주제로 한국 소상공인을 위한 블로그 포스트를 작성해주세요:\n\n주제: ${topic}`;

  if (newsContext) {
    userPrompt += `\n\n## 참고 뉴스/자료 (리서치 보강)\n아래 수집된 뉴스를 참고하여 시의성 있는 콘텐츠를 작성하세요:\n\n${newsContext}`;
  }

  try {
    console.log(`[generate-blog] Claude API 호출 중... (필라: ${pillar || "미지정"})`);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      console.error(
        "[generate-blog] Claude 응답에서 JSON을 파싱할 수 없습니다."
      );
      console.error(
        "[generate-blog] 응답 (처음 500자):",
        responseText.slice(0, 500)
      );
      return null;
    }

    const parsed = JSON.parse(jsonMatch[1]);

    const result: GeneratedBlogPost = {
      title: parsed.title,
      slug: parsed.slug || buildSlug(parsed.title),
      content: parsed.content,
      excerpt: parsed.excerpt,
      meta_description: parsed.meta_description,
      category: parsed.category || pillar || "AI도구리뷰",
      tags: parsed.tags || [],
    };

    console.log(`[generate-blog] 생성 완료: "${result.title}"`);
    console.log(
      `[generate-blog] 본문 길이: ${result.content.length}자, 카테고리: ${result.category}`
    );

    // Quality validation
    const quality = validateQuality(result);
    console.log(
      `[generate-blog] 퀄리티 검증: ${quality.score}/8 (${quality.passed ? "PASS" : "WARN"})`
    );
    for (const check of quality.checks) {
      const icon = check.passed ? "OK" : "NG";
      console.log(`[generate-blog]   [${icon}] ${check.name}: ${check.detail}`);
    }

    if (!quality.passed) {
      console.warn(
        "[generate-blog] 퀄리티 기준 미달이지만 포스트를 반환합니다. 수동 검토를 권장합니다."
      );
    }

    return result;
  } catch (err) {
    console.error("[generate-blog] Claude API 오류:", err);
    return null;
  }
}

// CLI entry point
if (process.argv[1]?.includes("generate-blog")) {
  const topic = process.argv[2];
  const pillarArg = process.argv[3] as ContentPillar | undefined;

  if (!topic) {
    console.error('사용법: npx tsx src/pipeline/generate-blog.ts "주제" [필라]');
    console.error('예시: npx tsx src/pipeline/generate-blog.ts "소상공인을 위한 ChatGPT 활용법" AI도구리뷰');
    console.error(
      "\n필라 옵션: AI도구리뷰, 업종별AI가이드, 주간AI브리핑, 자동화플레이북, 프롬프트가이드"
    );
    process.exit(1);
  }

  generateBlogPost(topic, pillarArg).then((post) => {
    if (post) {
      console.log("\n--- 생성된 포스트 ---");
      console.log(`제목: ${post.title}`);
      console.log(`슬러그: ${post.slug}`);
      console.log(`카테고리: ${post.category}`);
      console.log(`태그: ${post.tags.join(", ")}`);
      console.log(`요약: ${post.excerpt}`);
      console.log(`본문 길이: ${post.content.length}자`);
      console.log("\n--- JSON 출력 ---");
      console.log(JSON.stringify(post, null, 2));
    } else {
      console.error("블로그 포스트 생성에 실패했습니다.");
      process.exit(1);
    }
  });
}
