// projects/content-pipeline/src/pipeline/stage-generate.ts
import { createClient } from '@libsql/client/web';
import {
  generateBlogPost,
  getTodayPillar,
  validateQuality,
  type ContentPillar,
  type GeneratedBlogPost,
} from './generate-blog';
import { getUnusedNews } from './collect';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  logError,
  logAutoFix,
  type TriggerType,
} from '../lib/pipeline-logger';

const MAX_RETRIES = 2;

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

export interface GenerateResult {
  success: boolean;
  contentQueueId: string | null;
  title: string | null;
  qaScore: number;
  pipelineLogId: string;
}

/**
 * 뉴스 컨텍스트 문자열 빌드 (기존 run-blog-pipeline.ts에서 추출)
 */
function buildNewsContext(
  news: Array<{ title: string; source: string; summary: string | null }>
): string {
  if (news.length === 0) return '';
  return news
    .slice(0, 5)
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title}\n   ${n.summary || '(요약 없음)'}`)
    .join('\n\n');
}

/**
 * content_queue에 draft INSERT
 */
async function saveToContentQueue(
  post: GeneratedBlogPost,
  pillar: ContentPillar | null,
  qaScore: number
): Promise<string> {
  const db = getContentDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO content_queue
          (id, type, pillar, topic, status, priority, title, content_body, project, created_at, updated_at)
          VALUES (?, 'blog', ?, ?, 'draft', 0, ?, ?, 'apppro', ?, ?)`,
    args: [
      id,
      pillar || post.category,
      post.title,
      post.title,
      JSON.stringify({
        content: post.content,
        slug: post.slug,
        excerpt: post.excerpt,
        meta_description: post.meta_description,
        category: post.category,
        tags: post.tags,
        qa_score: qaScore,
      }),
      now,
      now,
    ],
  });

  return id;
}

/**
 * Stage 2: AI 콘텐츠 생성 → content_queue(draft) 저장
 *
 * 1. 필라 결정 (CLI/요일 기반)
 * 2. 뉴스 컨텍스트 수집
 * 3. AI 생성 (Gemini Flash) + QA 검증 (재시도 최대 2회)
 * 4. content_queue에 draft INSERT
 * 5. 사용된 뉴스 마킹
 */
export async function runGenerateStage(
  topic?: string,
  pillarOverride?: ContentPillar,
  triggerType: TriggerType = 'scheduled'
): Promise<GenerateResult> {
  const pipelineLog = await logPipelineStart('generate', triggerType);

  try {
    // 1. 필라 결정
    const pillar = pillarOverride || getTodayPillar();
    console.log(`[stage-generate] 필라: ${pillar || '미지정'}`);

    // 2. 뉴스 컨텍스트
    let newsContext = '';
    try {
      const recentNews = await getUnusedNews(5);
      newsContext = buildNewsContext(recentNews as Array<{ title: string; source: string; summary: string | null }>);
      if (newsContext) {
        console.log(`[stage-generate] 뉴스 컨텍스트: ${(recentNews).length}건`);
      }
    } catch {
      console.warn('[stage-generate] 뉴스 컨텍스트 로딩 실패 (계속 진행)');
    }

    // 3. 토픽 결정
    const finalTopic = topic || `${pillar || 'AI 활용'} 최신 트렌드 분석`;

    // 4. AI 생성 + QA (재시도 포함)
    let post: GeneratedBlogPost | null = null;
    let qaScore = 0;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      if (attempt > 1) {
        console.log(`[stage-generate] 재생성 시도 ${attempt}/${MAX_RETRIES + 1}...`);
      }

      post = await generateBlogPost(finalTopic, pillar || undefined, newsContext || undefined);

      if (post) {
        const quality = validateQuality(post);
        qaScore = quality.score;

        if (quality.passed) {
          console.log(`[stage-generate] QA 통과 (${qaScore}/8)`);
          break;
        } else if (attempt <= MAX_RETRIES) {
          // 재시도 — error_logs에 quality_fail 기록
          const errId = await logError('qa_checker', 'quality_fail',
            `QA 미달 ${qaScore}/8 (시도 ${attempt})`,
            { contentId: undefined }
          );
          await logAutoFix(errId, 'failed', `재생성 시도 ${attempt + 1}/${MAX_RETRIES + 1}`);
          post = null;
        } else {
          console.warn(`[stage-generate] QA 미달이지만 최종 시도 (${qaScore}/8), 진행`);
        }
      } else if (attempt <= MAX_RETRIES) {
        const errId = await logError('ai_generator', 'api_error', `생성 실패 (시도 ${attempt})`);
        await logAutoFix(errId, 'failed', `재생성 시도 ${attempt + 1}/${MAX_RETRIES + 1}`);
      }
    }

    if (!post) {
      const errId = await logError('ai_generator', 'api_error', `${MAX_RETRIES + 1}회 시도 후 최종 실패`);
      await logPipelineFailed(pipelineLog.id, '콘텐츠 생성 최종 실패', errId);
      return { success: false, contentQueueId: null, title: null, qaScore: 0, pipelineLogId: pipelineLog.id };
    }

    // 5. content_queue에 draft 저장
    const cqId = await saveToContentQueue(post, pillar, qaScore);
    console.log(`[stage-generate] content_queue 저장 완료: id=${cqId}, title="${post.title}"`);

    // 6. pipeline_logs 완료
    await logPipelineComplete(pipelineLog.id, 1, {
      pillar: pillar || 'none',
      qa_score: qaScore,
      content_type: 'blog',
      content_queue_id: cqId,
      model: process.env.GOOGLE_API_KEY ? 'gemini-2.0-flash' : 'mock',
    });

    return {
      success: true,
      contentQueueId: cqId,
      title: post.title,
      qaScore,
      pipelineLogId: pipelineLog.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errorLogId = await logError('ai_generator', 'api_error', errMsg);
    await logPipelineFailed(pipelineLog.id, errMsg, errorLogId);
    return { success: false, contentQueueId: null, title: null, qaScore: 0, pipelineLogId: pipelineLog.id };
  }
}
