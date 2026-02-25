// projects/content-pipeline/src/lib/pipeline-logger.ts
import { createClient } from '@libsql/client/web';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

export type PipelineName = 'collect' | 'generate' | 'approve' | 'publish' | 'self-healing';
export type PipelineStatus = 'started' | 'completed' | 'failed';
export type TriggerType = 'manual' | 'scheduled' | 'retry';

export interface PipelineLogEntry {
  id: string;
  pipelineName: PipelineName;
  status: PipelineStatus;
  triggerType: TriggerType;
  startedAt: number;
}

/**
 * 파이프라인 실행 시작 기록. 반환된 id로 완료/실패 시 업데이트한다.
 */
export async function logPipelineStart(
  pipelineName: PipelineName,
  triggerType: TriggerType = 'scheduled'
): Promise<PipelineLogEntry> {
  const db = getContentDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO pipeline_logs (id, pipeline_name, status, trigger_type, created_at)
          VALUES (?, ?, 'started', ?, ?)`,
    args: [id, pipelineName, triggerType, now],
  });

  return { id, pipelineName, status: 'started', triggerType, startedAt: now };
}

/**
 * 파이프라인 실행 완료 기록.
 */
export async function logPipelineComplete(
  logId: string,
  itemsProcessed: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = getContentDb();
  const now = Date.now();

  // startedAt 조회하여 duration 계산
  const existing = await db.execute({
    sql: 'SELECT created_at FROM pipeline_logs WHERE id = ?',
    args: [logId],
  });
  const startedAt = existing.rows[0]?.created_at as number || now;
  const durationMs = now - startedAt;

  await db.execute({
    sql: `UPDATE pipeline_logs
          SET status = 'completed', duration_ms = ?, items_processed = ?, metadata = ?
          WHERE id = ?`,
    args: [durationMs, itemsProcessed, metadata ? JSON.stringify(metadata) : null, logId],
  });
}

/**
 * 파이프라인 실행 실패 기록. error_logs에도 동시 기록.
 */
export async function logPipelineFailed(
  logId: string,
  errorMessage: string,
  errorLogId?: string
): Promise<void> {
  const db = getContentDb();
  const now = Date.now();

  const existing = await db.execute({
    sql: 'SELECT created_at FROM pipeline_logs WHERE id = ?',
    args: [logId],
  });
  const startedAt = existing.rows[0]?.created_at as number || now;
  const durationMs = now - startedAt;

  await db.execute({
    sql: `UPDATE pipeline_logs
          SET status = 'failed', duration_ms = ?, error_message = ?, error_log_id = ?
          WHERE id = ?`,
    args: [durationMs, errorMessage, errorLogId || null, logId],
  });
}

export type ErrorComponent = 'rss_collector' | 'ai_generator' | 'publisher' | 'qa_checker' | 'scheduler' | 'brevo' | 'sns_publisher';
export type ErrorType = 'timeout' | 'auth_fail' | 'quality_fail' | 'api_error' | 'build_fail' | 'rate_limit' | 'validation_fail';

/**
 * error_logs에 에러 기록. 반환된 id로 후속 업데이트 가능.
 */
export async function logError(
  component: ErrorComponent,
  errorType: ErrorType,
  errorMessage: string,
  options?: {
    contentId?: string;
    channelId?: string;
  }
): Promise<string> {
  const db = getContentDb();
  const id = crypto.randomUUID();

  await db.execute({
    sql: `INSERT INTO error_logs (id, component, error_type, error_message, content_id, channel_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, component, errorType, errorMessage, options?.contentId || null, options?.channelId || null],
  });

  return id;
}

/**
 * 자동 교정 시도 결과 기록.
 */
export async function logAutoFix(
  errorLogId: string,
  result: 'success' | 'failed' | 'skipped',
  action: string
): Promise<void> {
  const db = getContentDb();
  const resolvedAt = result === 'success' ? Date.now() : null;
  const resolutionType = result === 'success' ? 'auto_fixed' : null;

  await db.execute({
    sql: `UPDATE error_logs
          SET auto_fix_attempted = 1, auto_fix_result = ?, auto_fix_action = ?,
              resolved_at = ?, resolution_type = ?
          WHERE id = ?`,
    args: [result, action, resolvedAt, resolutionType, errorLogId],
  });
}
