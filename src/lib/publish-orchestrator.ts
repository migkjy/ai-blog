import { createClient } from '@libsql/client/web';
import { getActiveChannels, parseChannelConfig, getChannelCredential, type Channel } from './channels';
import { sendCampaignScheduled } from './brevo';
import { publishToSnsMock } from './sns-mock';
import { logError } from './pipeline-logger';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

function getBlogDb() {
  return createClient({
    url: process.env.BLOG_DB_URL || process.env.TURSO_DB_URL!,
    authToken: process.env.BLOG_DB_TOKEN || process.env.TURSO_DB_TOKEN!,
  });
}

export interface ChannelPublishResult {
  channelId: string;
  channelName: string;
  type: string;
  success: boolean;
  mock: boolean;
  platformId: string | null;
  platformUrl: string | null;
  distributionId: string | null;
  error: string | null;
}

export interface OrchestratorResult {
  contentId: string;
  totalChannels: number;
  successCount: number;
  failCount: number;
  channels: ChannelPublishResult[];
}

/**
 * content_distributions에 배포 레코드 INSERT.
 */
async function insertDistribution(
  contentId: string,
  channelId: string,
  platformStatus: string,
  platformId: string | null,
  platformUrl: string | null,
  errorMessage: string | null,
  scheduledAt: number | null,
  publishedAt: number | null,
): Promise<string> {
  const db = getContentDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO content_distributions
          (id, content_id, channel_id, platform_status, platform_id, platform_url,
           scheduled_at, published_at, error_message, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, contentId, channelId, platformStatus, platformId, platformUrl,
           scheduledAt, publishedAt, errorMessage, now, now],
  });

  return id;
}

/**
 * 블로그(apppro.kr) 채널 배포.
 * 기존 stage-publish.ts의 publishToBlog 로직을 활용.
 */
async function publishToBlogChannel(
  channel: Channel,
  contentId: string,
  title: string,
  contentBody: string,
): Promise<ChannelPublishResult> {
  const credential = getChannelCredential(channel);
  if (!credential) {
    const distId = await insertDistribution(
      contentId, channel.id, 'failed', null, null,
      `MOCK_MODE: ${channel.credentials_ref} not set`, null, null,
    );
    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: false, mock: true, platformId: null, platformUrl: null,
      distributionId: distId, error: `MOCK_MODE: ${channel.credentials_ref} not set`,
    };
  }

  try {
    // content_body를 JSON으로 파싱 (generate 단계에서 JSON 형식으로 저장)
    let parsed: {
      content: string; slug: string; excerpt: string;
      meta_description: string; category: string; tags: string[];
    };

    try {
      parsed = JSON.parse(contentBody);
    } catch {
      throw new Error('content_body JSON 파싱 실패');
    }

    const blogDb = getBlogDb();

    // slug 중복 체크
    const existing = await blogDb.execute({
      sql: 'SELECT id FROM blog_posts WHERE slug = ?',
      args: [parsed.slug],
    });

    let finalSlug = parsed.slug;
    if (existing.rows.length > 0) {
      const dateSuffix = new Date().toISOString().split('T')[0];
      finalSlug = `${parsed.slug}-${dateSuffix}`;
      console.log(`[orchestrator] slug 중복, 변경: ${parsed.slug} -> ${finalSlug}`);
    }

    const postId = crypto.randomUUID();
    const now = Date.now();

    await blogDb.execute({
      sql: `INSERT INTO blog_posts (
        id, title, slug, content, excerpt, category, tags,
        author, published, publishedAt, metaDescription, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AI AppPro', 1, ?, ?, ?, ?)`,
      args: [
        postId, title, finalSlug, parsed.content, parsed.excerpt,
        parsed.category, JSON.stringify(parsed.tags), now,
        parsed.meta_description, now, now,
      ],
    });

    const platformUrl = `https://apppro.kr/blog/posts/${finalSlug}`;
    console.log(`[orchestrator] 블로그 발행 완료: ${platformUrl}`);

    // content_distributions 기록
    const distId = await insertDistribution(
      contentId, channel.id, 'published', postId, platformUrl, null, null, now,
    );

    // content_logs (불변 감사 로그)
    const contentDb = getContentDb();
    await contentDb.execute({
      sql: `INSERT INTO content_logs (id, content_type, content_id, title, platform, status, published_at)
            VALUES (?, 'blog', ?, ?, 'apppro.kr', 'published', ?)`,
      args: [crypto.randomUUID(), contentId, title, now],
    });

    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: true, mock: false, platformId: postId, platformUrl,
      distributionId: distId, error: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errLogId = await logError('publisher', 'api_error', errMsg, {
      contentId, channelId: channel.id,
    });

    const distId = await insertDistribution(
      contentId, channel.id, 'failed', null, null, errMsg, null, null,
    );

    console.error(`[orchestrator] 블로그 발행 실패: ${errMsg} (errorLogId: ${errLogId})`);

    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: false, mock: false, platformId: null, platformUrl: null,
      distributionId: distId, error: errMsg,
    };
  }
}

/**
 * Brevo 뉴스레터 채널 배포.
 */
async function publishToBrevoChannel(
  channel: Channel,
  contentId: string,
  title: string,
  contentBody: string,
): Promise<ChannelPublishResult> {
  const credential = getChannelCredential(channel);
  if (!credential) {
    const distId = await insertDistribution(
      contentId, channel.id, 'failed', null, null,
      `MOCK_MODE: ${channel.credentials_ref} not set`, null, null,
    );
    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: false, mock: true, platformId: null, platformUrl: null,
      distributionId: distId, error: `MOCK_MODE: ${channel.credentials_ref} not set`,
    };
  }

  try {
    const config = parseChannelConfig(channel);
    const listId = (config.list_id as number) || parseInt(process.env.BREVO_LIST_ID || '0', 10);

    if (!listId) {
      throw new Error('Brevo list_id 미설정 (channels.config.list_id 또는 BREVO_LIST_ID)');
    }

    // content_body에서 HTML 생성 (간단 마크다운 → HTML 변환)
    let htmlContent: string;
    try {
      const parsed = JSON.parse(contentBody);
      // content 필드가 마크다운이면 간단 HTML 래핑
      htmlContent = `<html><body>
        <h1>${title}</h1>
        <div>${(parsed.content as string || contentBody).replace(/\n/g, '<br/>')}</div>
        <hr/>
        <p><a href="https://apppro.kr/blog">AI AppPro 블로그에서 더 보기</a></p>
      </body></html>`;
    } catch {
      htmlContent = `<html><body>
        <h1>${title}</h1>
        <div>${contentBody.replace(/\n/g, '<br/>')}</div>
      </body></html>`;
    }

    const result = await sendCampaignScheduled(listId, title, htmlContent, null);

    if (!result.success) {
      if (result.mock) {
        const distId = await insertDistribution(
          contentId, channel.id, 'failed', null, null, 'MOCK_MODE', null, null,
        );
        return {
          channelId: channel.id, channelName: channel.name, type: channel.type,
          success: false, mock: true, platformId: null, platformUrl: null,
          distributionId: distId, error: 'MOCK_MODE',
        };
      }
      throw new Error(result.error || 'Brevo 캠페인 생성 실패');
    }

    const campaignId = result.campaignId!;
    const now = Date.now();

    // content_distributions — 발송 완료
    const distId = await insertDistribution(
      contentId, channel.id, 'published',
      String(campaignId), null, null, null, now,
    );

    console.log(`[orchestrator] Brevo 캠페인 발송 완료: campaignId=${campaignId}`);

    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: true, mock: false, platformId: String(campaignId), platformUrl: null,
      distributionId: distId, error: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // 인증 실패면 에스컬레이션
    const isAuthFail = errMsg.includes('401') || errMsg.toLowerCase().includes('unauthorized');
    const errorType = isAuthFail ? 'auth_fail' as const : 'api_error' as const;

    const errLogId = await logError('brevo', errorType, errMsg, {
      contentId, channelId: channel.id,
    });

    // 인증 실패 시 에스컬레이션
    if (isAuthFail) {
      const contentDb = getContentDb();
      await contentDb.execute({
        sql: 'UPDATE error_logs SET escalated = 1 WHERE id = ?',
        args: [errLogId],
      });
    }

    const distId = await insertDistribution(
      contentId, channel.id, 'failed', null, null, errMsg, null, null,
    );

    console.error(`[orchestrator] Brevo 발송 실패: ${errMsg} (errorLogId: ${errLogId})`);

    return {
      channelId: channel.id, channelName: channel.name, type: channel.type,
      success: false, mock: false, platformId: null, platformUrl: null,
      distributionId: distId, error: errMsg,
    };
  }
}

/**
 * SNS 채널 배포 (Phase 1 mock).
 */
async function publishToSnsChannel(
  channel: Channel,
  contentId: string,
  title: string,
  contentBody: string,
): Promise<ChannelPublishResult> {
  const result = await publishToSnsMock(channel.id, contentId, title, contentBody);

  const distId = await insertDistribution(
    contentId, channel.id, 'failed', null, null,
    result.error, null, null,
  );

  return {
    channelId: channel.id, channelName: channel.name, type: channel.type,
    success: false, mock: true, platformId: null, platformUrl: null,
    distributionId: distId, error: result.error,
  };
}

/**
 * 통합 배포 오케스트레이터.
 *
 * channels 테이블에서 활성 채널 목록을 조회하고,
 * 채널 type별로 적절한 배포 함수를 호출한다.
 * 모든 결과를 content_distributions에 기록한다.
 *
 * @param contentId content_queue.id
 * @param title 콘텐츠 제목
 * @param contentBody 콘텐츠 본문 (JSON 형식)
 */
export async function publishToAllChannels(
  contentId: string,
  title: string,
  contentBody: string,
): Promise<OrchestratorResult> {
  const channels = await getActiveChannels();
  console.log(`[orchestrator] 활성 채널 ${channels.length}개: ${channels.map(c => `${c.name}(${c.type})`).join(', ')}`);

  const results: ChannelPublishResult[] = [];

  for (const channel of channels) {
    let result: ChannelPublishResult;

    switch (channel.type) {
      case 'blog':
        result = await publishToBlogChannel(channel, contentId, title, contentBody);
        break;
      case 'newsletter':
        result = await publishToBrevoChannel(channel, contentId, title, contentBody);
        break;
      case 'sns':
        result = await publishToSnsChannel(channel, contentId, title, contentBody);
        break;
      default:
        console.warn(`[orchestrator] 알 수 없는 채널 type: ${channel.type}`);
        result = {
          channelId: channel.id, channelName: channel.name, type: channel.type,
          success: false, mock: false, platformId: null, platformUrl: null,
          distributionId: null, error: `Unknown channel type: ${channel.type}`,
        };
    }

    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success && !r.mock).length;

  return {
    contentId,
    totalChannels: channels.length,
    successCount,
    failCount,
    channels: results,
  };
}
