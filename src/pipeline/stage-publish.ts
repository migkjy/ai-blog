// projects/content-pipeline/src/pipeline/stage-publish.ts
import { createClient } from '@libsql/client/web';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  logError,
  type TriggerType,
} from '../lib/pipeline-logger';
import { retryL1, escalateL5 } from '../lib/self-healing';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

function getBlogDb() {
  return createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_DB_TOKEN!,
  });
}

export interface PublishResult {
  success: boolean;
  contentId: string;
  blogPostId: string | null;
  distributionId: string | null;
  pipelineLogId: string;
}

/**
 * content_queue에서 approved 아이템 1건 가져오기
 */
async function getNextApproved(): Promise<{
  id: string;
  title: string;
  contentBody: string;
  pillar: string | null;
} | null> {
  const db = getContentDb();
  const result = await db.execute({
    sql: `SELECT id, title, content_body, pillar
          FROM content_queue
          WHERE status = 'approved'
          ORDER BY approved_at ASC
          LIMIT 1`,
    args: [],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    title: row.title as string,
    contentBody: row.content_body as string,
    pillar: row.pillar as string | null,
  };
}

/**
 * content_body JSON을 파싱하여 blog_posts INSERT
 */
async function publishToBlog(
  contentBody: string,
  title: string
): Promise<{ postId: string; slug: string } | null> {
  const blogDb = getBlogDb();

  let parsed: {
    content: string;
    slug: string;
    excerpt: string;
    meta_description: string;
    category: string;
    tags: string[];
  };

  try {
    parsed = JSON.parse(contentBody);
  } catch {
    console.error('[stage-publish] content_body JSON 파싱 실패');
    return null;
  }

  // slug 중복 체크
  const existing = await blogDb.execute({
    sql: 'SELECT id FROM blog_posts WHERE slug = ?',
    args: [parsed.slug],
  });

  let finalSlug = parsed.slug;
  if (existing.rows.length > 0) {
    // slug 중복 시 날짜 접미사 추가
    const dateSuffix = new Date().toISOString().split('T')[0];
    finalSlug = `${parsed.slug}-${dateSuffix}`;
    console.log(`[stage-publish] slug 중복, 변경: ${parsed.slug} → ${finalSlug}`);
  }

  const postId = crypto.randomUUID();
  const now = Date.now();

  await blogDb.execute({
    sql: `INSERT INTO blog_posts (
      id, title, slug, content, excerpt, category, tags,
      author, published, publishedAt, metaDescription, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AI AppPro', 1, ?, ?, ?, ?)`,
    args: [
      postId,
      title,
      finalSlug,
      parsed.content,
      parsed.excerpt,
      parsed.category,
      JSON.stringify(parsed.tags),
      now,
      parsed.meta_description,
      now,
      now,
    ],
  });

  return { postId, slug: finalSlug };
}

/**
 * content_distributions에 배포 레코드 INSERT
 */
async function createDistribution(
  contentId: string,
  channelId: string,
  platformId: string,
  platformUrl: string
): Promise<string> {
  const db = getContentDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO content_distributions
          (id, content_id, channel_id, platform_status, platform_id, platform_url, published_at, created_at, updated_at)
          VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
    args: [id, contentId, channelId, platformId, platformUrl, now, now, now],
  });

  return id;
}

/**
 * content_queue status 업데이트
 */
async function updateContentQueueStatus(contentId: string, status: string): Promise<void> {
  const db = getContentDb();
  await db.execute({
    sql: 'UPDATE content_queue SET status = ?, updated_at = ? WHERE id = ?',
    args: [status, Date.now(), contentId],
  });
}

/**
 * Stage 4: approved → 블로그 발행 + content_distributions 기록
 *
 * Phase 1에서는 블로그(apppro.kr)만 배포. Brevo/SNS는 Phase 2.
 */
export async function runPublishStage(
  contentId?: string,
  triggerType: TriggerType = 'scheduled'
): Promise<PublishResult> {
  const pipelineLog = await logPipelineStart('publish', triggerType);

  try {
    // approved 아이템 가져오기
    let item: { id: string; title: string; contentBody: string; pillar: string | null } | null;

    if (contentId) {
      // 특정 contentId 지정
      const db = getContentDb();
      const result = await db.execute({
        sql: 'SELECT id, title, content_body, pillar FROM content_queue WHERE id = ? AND status = ?',
        args: [contentId, 'approved'],
      });
      if (result.rows.length === 0) {
        await logPipelineFailed(pipelineLog.id, `contentId ${contentId}가 approved 상태가 아닙니다`);
        return { success: false, contentId: contentId || '', blogPostId: null, distributionId: null, pipelineLogId: pipelineLog.id };
      }
      const row = result.rows[0];
      item = { id: row.id as string, title: row.title as string, contentBody: row.content_body as string, pillar: row.pillar as string | null };
    } else {
      item = await getNextApproved();
    }

    if (!item) {
      console.log('[stage-publish] 발행 대기 콘텐츠 없음');
      await logPipelineComplete(pipelineLog.id, 0, { message: 'no_approved_content' });
      return { success: true, contentId: '', blogPostId: null, distributionId: null, pipelineLogId: pipelineLog.id };
    }

    console.log(`[stage-publish] 발행 대상: ${item.id} "${item.title}"`);

    // 블로그 발행
    const blogResult = await publishToBlog(item.contentBody, item.title);

    if (!blogResult) {
      // L1 자체교정: 5초 대기 후 1회 재시도
      const retryResult = await retryL1(
        () => publishToBlog(item.contentBody, item.title),
        5000,
        'publisher',
        'api_error',
        `blog_posts INSERT 실패 (content_id: ${item.id})`
      );

      if (retryResult && retryResult.result) {
        const retryBlog = retryResult.result;
        const distId = await createDistribution(
          item.id, 'ch-apppro-blog', retryBlog.postId,
          `https://apppro.kr/blog/${retryBlog.slug}`
        );

        await updateContentQueueStatus(item.id, 'published');

        await logPipelineComplete(pipelineLog.id, 1, {
          channels_ok: 1,
          channels_fail: 0,
          channels: ['apppro-blog'],
          blog_post_id: retryBlog.postId,
          self_healing: 'L1_retry_success',
        });

        return { success: true, contentId: item.id, blogPostId: retryBlog.postId, distributionId: distId, pipelineLogId: pipelineLog.id };
      }

      // L1 재시도 실패 → 에러 기록
      const errId = await logError('publisher', 'api_error', `블로그 발행 최종 실패 (L1 재시도 포함, content_id: ${item.id})`, { contentId: item.id, channelId: 'ch-apppro-blog' });
      await logPipelineFailed(pipelineLog.id, '블로그 발행 최종 실패', errId);
      await updateContentQueueStatus(item.id, 'failed');
      return { success: false, contentId: item.id, blogPostId: null, distributionId: null, pipelineLogId: pipelineLog.id };
    }

    // 정상 발행
    console.log(`[stage-publish] 블로그 발행 완료: postId=${blogResult.postId}, slug=${blogResult.slug}`);

    // content_distributions 기록
    const distId = await createDistribution(
      item.id, 'ch-apppro-blog', blogResult.postId,
      `https://apppro.kr/blog/${blogResult.slug}`
    );

    // content_logs (불변 감사 로그)
    const contentDb = getContentDb();
    await contentDb.execute({
      sql: `INSERT INTO content_logs (id, content_type, content_id, title, platform, status, published_at)
            VALUES (?, 'blog', ?, ?, 'apppro.kr', 'published', ?)`,
      args: [crypto.randomUUID(), item.id, item.title, Date.now()],
    });

    // content_queue status → published
    await updateContentQueueStatus(item.id, 'published');

    await logPipelineComplete(pipelineLog.id, 1, {
      channels_ok: 1,
      channels_fail: 0,
      channels: ['apppro-blog'],
      blog_post_id: blogResult.postId,
    });

    console.log(`[stage-publish] 완료: ${item.id} → published`);

    return {
      success: true,
      contentId: item.id,
      blogPostId: blogResult.postId,
      distributionId: distId,
      pipelineLogId: pipelineLog.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // auth_fail 감지 → L5 에스컬레이션
    const isAuthFail = errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('401') || errMsg.toLowerCase().includes('403');
    if (isAuthFail) {
      const escId = await escalateL5('publisher', 'auth_fail', errMsg);
      await logPipelineFailed(pipelineLog.id, errMsg, escId);
    } else {
      const errorLogId = await logError('publisher', 'api_error', errMsg);
      await logPipelineFailed(pipelineLog.id, errMsg, errorLogId);
    }

    return { success: false, contentId: contentId || '', blogPostId: null, distributionId: null, pipelineLogId: pipelineLog.id };
  }
}
