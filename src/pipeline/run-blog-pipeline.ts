import { neon } from "@neondatabase/serverless";
import { collectNews, saveCollectedNews, getUnusedNews } from "./collect";
import {
  generateBlogPost,
  getTodayPillar,
  validateQuality,
  type ContentPillar,
} from "./generate-blog";
import { publishBlogPost } from "./publish-blog";

const DAILY_LIMIT = Number(process.env.BLOG_DAILY_LIMIT) || 1;
const MAX_RETRIES = 2;

// --- Helpers ---

async function getTodayPostCount(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT count(*)::int as cnt
    FROM blog_posts
    WHERE published_at >= CURRENT_DATE
      AND published_at < CURRENT_DATE + INTERVAL '1 day'
      AND author = 'AI AppPro'
  `;
  return (rows[0]?.cnt as number) || 0;
}

/**
 * Build news context string from recent collected news.
 */
function buildNewsContext(
  news: Array<{ title: string; source: string; summary: string | null }>
): string {
  if (news.length === 0) return "";

  return news
    .slice(0, 5)
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title}\n   ${n.summary || "(요약 없음)"}`)
    .join("\n\n");
}

// --- Pipeline ---

async function runBlogPipeline() {
  console.log("=== Blog Auto-Generation Pipeline v2 ===");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Daily limit: ${DAILY_LIMIT} post(s)\n`);

  // --- Step 0: Daily Limit Check ---
  console.log("--- Step 0: Daily Limit Check ---");
  const todayCount = await getTodayPostCount();
  console.log(`[pipeline] 오늘 게시된 포스트: ${todayCount}건`);

  if (todayCount >= DAILY_LIMIT) {
    console.log(
      `[pipeline] 일일 제한(${DAILY_LIMIT}건) 도달. 파이프라인을 종료합니다.`
    );
    return;
  }
  console.log(`[pipeline] 남은 생성 가능 수: ${DAILY_LIMIT - todayCount}건\n`);

  // --- Step 1: Collect News (소스 수집) ---
  console.log("--- Step 1: Collect News ---");
  try {
    const items = await collectNews();
    const saved = await saveCollectedNews(items);
    console.log(`[pipeline] 수집: ${items.length}건, 신규 저장: ${saved}건\n`);
  } catch (err) {
    console.warn("[pipeline] 뉴스 수집 실패 (계속 진행):", err);
  }

  // --- Step 2: Topic & Pillar Selection (필터링/주제 선정) ---
  console.log("--- Step 2: Topic & Pillar Selection ---");

  // Determine pillar
  const cliPillar = process.argv[3] as ContentPillar | undefined;
  const todayPillar = getTodayPillar();
  const pillar = cliPillar || todayPillar;

  if (pillar) {
    console.log(`[pipeline] 필라: ${pillar}${cliPillar ? " (CLI 지정)" : " (요일 자동 배정)"}`);
  } else {
    console.log("[pipeline] 주말: 필라 미배정. CLI 지정 필라 또는 기본 필라로 진행.");
  }

  // Determine topic
  const cliTopic = process.argv[2];
  if (!cliTopic) {
    console.error(
      '사용법: npx tsx src/pipeline/run-blog-pipeline.ts "주제" [필라]'
    );
    console.error(
      '예시: npx tsx src/pipeline/run-blog-pipeline.ts "소상공인을 위한 ChatGPT 활용법" AI도구리뷰'
    );
    console.error(
      "\n필라 옵션: AI도구리뷰, 업종별AI가이드, 주간AI브리핑, 자동화플레이북, 프롬프트가이드"
    );
    process.exit(1);
  }
  console.log(`[pipeline] 주제: "${cliTopic}"\n`);

  // --- Step 3: Research Context (리서치 보강) ---
  console.log("--- Step 3: Research Context ---");
  let newsContext = "";
  try {
    const recentNews = await getUnusedNews(5);
    newsContext = buildNewsContext(recentNews);
    if (newsContext) {
      console.log(`[pipeline] 최근 뉴스 ${recentNews.length}건을 컨텍스트로 제공`);
    } else {
      console.log("[pipeline] 최근 수집된 뉴스 없음 (컨텍스트 없이 진행)");
    }
  } catch {
    console.warn("[pipeline] 뉴스 컨텍스트 로딩 실패 (컨텍스트 없이 진행)");
  }
  console.log();

  // --- Step 4: Generate Blog Post (AI 초안 생성) ---
  console.log("--- Step 4: Generate Blog Post ---");
  let post = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      console.log(`[pipeline] 재시도 ${attempt}/${MAX_RETRIES}...`);
    }

    post = await generateBlogPost(cliTopic, pillar || undefined, newsContext || undefined);

    if (post) {
      // Validate quality
      const quality = validateQuality(post);
      if (quality.passed) {
        console.log(`[pipeline] 퀄리티 검증 통과 (${quality.score}/8)\n`);
        break;
      } else if (attempt < MAX_RETRIES) {
        console.warn(
          `[pipeline] 퀄리티 미달 (${quality.score}/8), 재생성 시도...`
        );
        post = null;
      } else {
        console.warn(
          `[pipeline] 퀄리티 미달이지만 최종 시도이므로 진행 (${quality.score}/8)\n`
        );
      }
    } else if (attempt < MAX_RETRIES) {
      console.warn("[pipeline] 생성 실패, 재시도...");
    }
  }

  if (!post) {
    console.error(
      "[pipeline] 블로그 포스트 생성 최종 실패. 파이프라인을 종료합니다."
    );
    process.exit(1);
  }

  console.log(`[pipeline] 생성 완료: "${post.title}"`);
  console.log(
    `[pipeline] 본문: ${post.content.length}자, 카테고리: ${post.category}\n`
  );

  // --- Step 5: Publish to Blog (게시) ---
  console.log("--- Step 5: Publish to Blog ---");
  const postId = await publishBlogPost(post);
  if (!postId) {
    console.error("[pipeline] 블로그 게시 실패. 파이프라인을 종료합니다.");
    process.exit(1);
  }

  // --- Summary ---
  console.log("\n=== Pipeline Complete ===");
  console.log(`Finished at: ${new Date().toISOString()}`);
  console.log(`Post ID:     ${postId}`);
  console.log(`Title:       ${post.title}`);
  console.log(`Slug:        ${post.slug}`);
  console.log(`Category:    ${post.category}`);
  console.log(`Pillar:      ${pillar || "미지정"}`);
  console.log(`Tags:        ${post.tags.join(", ")}`);
  console.log(`Content:     ${post.content.length} chars`);
}

runBlogPipeline().catch((err) => {
  console.error("[pipeline] 파이프라인 오류:", err);
  process.exit(1);
});
