// projects/content-pipeline/src/lib/notifications.ts
import { getContentDb } from './content-db';

type NotificationType = 'draft_created' | 'qa_failed' | 'published' | 'error_escalation' | 'review_request';
type NotificationTarget = 'vp' | 'ceo';

/**
 * pipeline_notifications 테이블에 알림 레코드 INSERT.
 * Vercel 서버리스 환경에서의 역할은 여기까지.
 * 실제 텔레그램 발송은 macOS 로컬 스크립트(notification-sender.sh)가 폴링 처리.
 */
async function insertNotification(
  type: NotificationType,
  target: NotificationTarget,
  title: string,
  body: string,
  options?: {
    contentId?: string;
    pipelineLogId?: string;
    errorLogId?: string;
  },
): Promise<string> {
  const db = getContentDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO pipeline_notifications
          (id, type, target, title, body, content_id, pipeline_log_id, error_log_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    args: [
      id, type, target, title, body,
      options?.contentId || null,
      options?.pipelineLogId || null,
      options?.errorLogId || null,
      now, now,
    ],
  });

  console.log(`[notifications] 알림 생성: type=${type}, target=${target}, id=${id}`);
  return id;
}

/**
 * 콘텐츠 생성 완료 (draft) 알림 — VP 대상.
 * stage-generate.ts에서 성공 후 호출.
 */
export async function notifyDraftCreated(
  contentId: string,
  title: string,
  qaScore: number,
  previewUrl: string,
): Promise<void> {
  const body = [
    '콘텐츠 생성 완료',
    `제목: ${title}`,
    `QA: ${qaScore}/8`,
    `미리보기: ${previewUrl}`,
  ].join('\n');

  await insertNotification('draft_created', 'vp', `콘텐츠 생성: ${title}`, body, { contentId });
}

/**
 * QA 최종 실패 알림 — VP 대상.
 * stage-generate.ts에서 모든 재시도 후 최종 실패 시 호출.
 */
export async function notifyQaFailed(
  topic: string,
  score: number,
  attempts: number,
): Promise<void> {
  const body = [
    'QA 최종 실패',
    `토픽: ${topic}`,
    `점수: ${score}/8`,
    `시도: ${attempts}회`,
  ].join('\n');

  await insertNotification('qa_failed', 'vp', `QA 실패: ${topic}`, body);
}

/**
 * 배포 완료 알림 — VP 대상.
 * stage-publish.ts에서 성공 후 호출.
 */
export async function notifyPublished(
  contentId: string,
  title: string,
  channels: string[],
  blogUrl: string,
): Promise<void> {
  const body = [
    '콘텐츠 배포 완료',
    `제목: ${title}`,
    `채널: ${channels.join(', ')}`,
    `블로그: ${blogUrl}`,
  ].join('\n');

  await insertNotification('published', 'vp', `배포 완료: ${title}`, body, { contentId });
}

/**
 * 에러 에스컬레이션 알림 — VP 대상.
 * self-healing.ts의 escalateL5() 호출 후 호출.
 */
export async function notifyErrorEscalation(
  component: string,
  errorMessage: string,
  errorLogId: string,
): Promise<void> {
  const body = [
    '파이프라인 에러 에스컬레이션',
    `컴포넌트: ${component}`,
    `에러: ${errorMessage}`,
    `에러ID: ${errorLogId}`,
  ].join('\n');

  await insertNotification('error_escalation', 'vp', `에러: ${component}`, body, { errorLogId });
}

/**
 * CEO 검수 요청 알림 — CEO 대상.
 * 향후 approved → reviewing 전환 시 호출.
 */
export async function notifyReviewRequest(
  contentId: string,
  title: string,
  previewUrl: string,
): Promise<void> {
  const body = [
    '콘텐츠 검수 요청',
    `제목: ${title}`,
    `미리보기: ${previewUrl}`,
    '승인/거부 부탁드립니다',
  ].join('\n');

  await insertNotification('review_request', 'ceo', `검수 요청: ${title}`, body, { contentId });
}
