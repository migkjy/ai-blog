// projects/content-pipeline/src/pipeline/stage-publish.ts
import { createClient } from '@libsql/client/web';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  logError,
  type TriggerType,
} from '../lib/pipeline-logger';
import { publishToAllChannels } from '../lib/publish-orchestrator';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
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
 * Stage 4: approved -> 다채널 배포 (channels 테이블 기반)
 *
 * Phase 1: 블로그(apppro.kr) + Brevo 뉴스레터. SNS는 mock.
 * content_distributions에 채널별 배포 결과 기록.
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

    // 다채널 배포 오케스트레이터 호출
    const orchResult = await publishToAllChannels(item.id, item.title, item.contentBody);

    // 블로그 채널 결과 추출 (approve API 호환용)
    const blogChannel = orchResult.channels.find(c => c.type === 'blog' && c.success);
    const blogPostId = blogChannel?.platformId ?? null;
    const blogDistId = blogChannel?.distributionId ?? null;

    // 성공 여부 판단: 블로그 채널이 성공이면 전체 성공
    const hasSuccess = orchResult.successCount > 0;

    if (hasSuccess) {
      // content_queue status -> published
      await updateContentQueueStatus(item.id, 'published');

      await logPipelineComplete(pipelineLog.id, orchResult.successCount, {
        channels_ok: orchResult.successCount,
        channels_fail: orchResult.failCount,
        channels: orchResult.channels.map(c => ({
          name: c.channelName,
          type: c.type,
          success: c.success,
          mock: c.mock,
          platformId: c.platformId,
        })),
        blog_post_id: blogPostId,
      });

      console.log(`[stage-publish] 완료: ${item.id} -> published (${orchResult.successCount}/${orchResult.totalChannels} channels)`);
    } else {
      // 모든 채널 실패 시
      // mock만 실패인 경우(채널이 모두 mock)는 에러가 아님
      const allMock = orchResult.channels.every(c => c.mock);

      if (allMock) {
        // 모두 mock 모드 — 블로그 DB 자격 증명 미설정 등
        await updateContentQueueStatus(item.id, 'failed');
        await logPipelineComplete(pipelineLog.id, 0, {
          channels_ok: 0,
          channels_fail: 0,
          channels_mock: orchResult.totalChannels,
          message: 'all_channels_mock_mode',
        });
      } else {
        // 실제 실패
        await updateContentQueueStatus(item.id, 'failed');

        const firstError = orchResult.channels.find(c => !c.success && !c.mock);
        const errId = await logError('publisher', 'api_error',
          `다채널 배포 전부 실패: ${firstError?.error || 'unknown'}`,
          { contentId: item.id },
        );

        await logPipelineFailed(pipelineLog.id,
          `모든 채널 배포 실패 (${orchResult.failCount}/${orchResult.totalChannels})`, errId,
        );
      }
    }

    return {
      success: hasSuccess,
      contentId: item.id,
      blogPostId,
      distributionId: blogDistId,
      pipelineLogId: pipelineLog.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errorLogId = await logError('publisher', 'api_error', errMsg);
    await logPipelineFailed(pipelineLog.id, errMsg, errorLogId);
    return { success: false, contentId: contentId || '', blogPostId: null, distributionId: null, pipelineLogId: pipelineLog.id };
  }
}
