// projects/content-pipeline/src/lib/self-healing.ts
import { createClient } from '@libsql/client/web';
import {
  logError,
  logAutoFix,
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  type ErrorComponent,
  type ErrorType,
} from './pipeline-logger';

// --- 타입 정의 ---

export type HealingLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface FixResult {
  success: boolean;
  action: string;
  nextLevel?: HealingLevel;
}

export interface HealingReport {
  total: number;
  fixed: number;
  escalated: number;
  skipped: number;
}

interface ErrorLogRow {
  id: string;
  occurred_at: number;
  component: string;
  error_type: string;
  error_message: string;
  content_id: string | null;
  channel_id: string | null;
  auto_fix_attempted: number;
  auto_fix_result: string | null;
  auto_fix_action: string | null;
  escalated: number;
  resolved_at: number | null;
  resolution_type: string | null;
}

/** component + error_type → 교정 등급 매핑 (L1 설계서 섹션 3-3) */
interface ErrorClassification {
  level: HealingLevel;
  maxRetries: number;
  baseDelayMs: number;
  autoFixAction: string;
}

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * component + error_type 조합으로 교정 등급을 결정한다.
 * L1 설계서 섹션 3-3 매핑 테이블 기반.
 */
const ERROR_CLASSIFICATION_MAP: Record<string, ErrorClassification> = {
  // rss_collector
  'rss_collector:timeout':        { level: 'L1', maxRetries: 1, baseDelayMs: 5000,  autoFixAction: '타임아웃 확장 후 재시도' },
  'rss_collector:api_error':      { level: 'L1', maxRetries: 1, baseDelayMs: 5000,  autoFixAction: '5초 후 재시도' },
  'rss_collector:validation_fail':{ level: 'L1', maxRetries: 0, baseDelayMs: 0,     autoFixAction: '해당 피드 skip' },
  // ai_generator
  'ai_generator:timeout':         { level: 'L2', maxRetries: 2, baseDelayMs: 30000, autoFixAction: '30초 대기 후 재시도' },
  'ai_generator:api_error':       { level: 'L2', maxRetries: 2, baseDelayMs: 10000, autoFixAction: '지수 백오프 재시도' },
  'ai_generator:auth_fail':       { level: 'L5', maxRetries: 0, baseDelayMs: 0,     autoFixAction: '즉시 에스컬레이션 (API 키 갱신 필요)' },
  // qa_checker
  'qa_checker:quality_fail':      { level: 'L2', maxRetries: 2, baseDelayMs: 0,     autoFixAction: '재생성 (온도 조정)' },
  // publisher
  'publisher:timeout':            { level: 'L1', maxRetries: 1, baseDelayMs: 5000,  autoFixAction: '5초 후 재시도' },
  'publisher:api_error':          { level: 'L1', maxRetries: 1, baseDelayMs: 5000,  autoFixAction: '5초 후 재시도' },
  'publisher:validation_fail':    { level: 'L1', maxRetries: 1, baseDelayMs: 0,     autoFixAction: 'slug 변경 후 재시도' },
  'publisher:auth_fail':          { level: 'L5', maxRetries: 0, baseDelayMs: 0,     autoFixAction: '즉시 에스컬레이션 (DB 인증 확인)' },
  // brevo
  'brevo:rate_limit':             { level: 'L2', maxRetries: 3, baseDelayMs: 60000, autoFixAction: '60초 대기 → 다음 날 재예약' },
  'brevo:auth_fail':              { level: 'L5', maxRetries: 0, baseDelayMs: 0,     autoFixAction: '즉시 에스컬레이션 (Brevo API 키 확인)' },
  'brevo:api_error':              { level: 'L2', maxRetries: 2, baseDelayMs: 5000,  autoFixAction: '재시도 → 파라미터 검증' },
  'brevo:validation_fail':        { level: 'L2', maxRetries: 1, baseDelayMs: 0,     autoFixAction: '요청 파라미터 검증 후 재시도' },
  // sns_publisher
  'sns_publisher:auth_fail':      { level: 'L3', maxRetries: 0, baseDelayMs: 0,     autoFixAction: '해당 플랫폼 skip (Phase 2)' },
  'sns_publisher:api_error':      { level: 'L1', maxRetries: 1, baseDelayMs: 30000, autoFixAction: '30초 후 재시도' },
  'sns_publisher:timeout':        { level: 'L1', maxRetries: 1, baseDelayMs: 5000,  autoFixAction: '재시도 → 해당 플랫폼 skip' },
  // scheduler
  'scheduler:api_error':          { level: 'L2', maxRetries: 1, baseDelayMs: 0,     autoFixAction: 'Cron 다음 실행 시 재시도' },
};

/**
 * [1] detectErrors — error_logs에서 미해결 에러를 조회한다.
 * 조건: resolved_at IS NULL AND escalated = 0
 * 정렬: occurred_at ASC (오래된 에러부터)
 * 최대 20건
 */
export async function detectErrors(): Promise<ErrorLogRow[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: `SELECT * FROM error_logs
          WHERE resolved_at IS NULL
            AND (auto_fix_attempted = 0 OR auto_fix_result = 'failed')
            AND escalated = 0
          ORDER BY occurred_at ASC
          LIMIT 20`,
    args: [],
  });
  return result.rows as unknown as ErrorLogRow[];
}

/**
 * [2] classifyError — 에러의 component와 error_type 조합으로 교정 등급을 판단한다.
 * auth_fail은 항상 L5.
 */
export function classifyError(error: ErrorLogRow): ErrorClassification {
  // auth_fail은 항상 L5
  if (error.error_type === 'auth_fail') {
    return {
      level: 'L5',
      maxRetries: 0,
      baseDelayMs: 0,
      autoFixAction: `즉시 에스컬레이션 (${error.component} 인증 실패)`,
    };
  }

  const key = `${error.component}:${error.error_type}`;
  const classification = ERROR_CLASSIFICATION_MAP[key];

  if (!classification) {
    // 매핑에 없는 에러는 L2 기본 재시도로 처리
    return {
      level: 'L2',
      maxRetries: 1,
      baseDelayMs: 5000,
      autoFixAction: `알 수 없는 에러 유형 (${key}), 기본 재시도`,
    };
  }

  return classification;
}

/**
 * [3] attemptAutoFix — 등급에 따라 자동 교정을 실행한다.
 *
 * Phase 1: L1(즉시 재시도), L2(백오프 재시도)만 실제 동작.
 * L3/L4는 Phase 2 placeholder. L5는 에스컬레이션만.
 *
 * 주의: runSelfHealingCycle에서 호출하는 경우, "이전 실행에서 남은 에러"를 재시도하는 것이므로
 * 실제 재시도 로직(원래 함수 재호출)은 없고, 에러 상태만 업데이트한다.
 * 인라인 자체교정(각 Stage에서 직접 호출)에서는 실제 재시도를 수행한다.
 */
export async function attemptAutoFix(
  error: ErrorLogRow,
  classification: ErrorClassification
): Promise<FixResult> {
  const { level } = classification;

  switch (level) {
    case 'L1': {
      // L1: 즉시 재시도 — runSelfHealingCycle에서는 "재시도 가능" 표시만
      // 실제 재시도는 다음 파이프라인 실행에서 자연스럽게 처리됨
      return {
        success: false,
        action: `L1 ${classification.autoFixAction} — 다음 파이프라인 실행에서 재시도 예정`,
        nextLevel: 'L2',
      };
    }

    case 'L2': {
      // L2: 백오프 재시도 — 동일하게 다음 실행 위임
      // 3회 이상 실패한 에러는 L5로 에스컬레이션
      return {
        success: false,
        action: `L2 ${classification.autoFixAction} — 다음 파이프라인 실행에서 백오프 재시도 예정`,
        nextLevel: 'L5',
      };
    }

    case 'L3': {
      // Phase 2 placeholder
      return {
        success: false,
        action: 'L3 대체 전략 — Phase 2에서 구현 예정',
        nextLevel: 'L5',
      };
    }

    case 'L4': {
      // Phase 2 placeholder
      return {
        success: false,
        action: 'L4 품질 강등 — Phase 2에서 구현 예정',
        nextLevel: 'L5',
      };
    }

    case 'L5': {
      return {
        success: false,
        action: `L5 에스컬레이션: ${classification.autoFixAction}`,
      };
    }

    default:
      return { success: false, action: `알 수 없는 등급: ${level}` };
  }
}

/**
 * [4] escalateIfNeeded — 에스컬레이션 필요 여부를 판단하고, 필요 시 escalated=1 설정.
 *
 * 에스컬레이션 조건:
 * 1. error_type === 'auth_fail' → 즉시
 * 2. 동일 component 24시간 내 3회 교정 실패 → 에스컬레이션
 */
export async function escalateIfNeeded(error: ErrorLogRow): Promise<boolean> {
  // 조건 1: auth_fail 즉시 에스컬레이션
  if (error.error_type === 'auth_fail') {
    await markEscalated(error.id);
    return true;
  }

  // 조건 2: 동일 component 24시간 내 3회 자동 교정 실패
  const db = getContentDb();
  const result = await db.execute({
    sql: `SELECT COUNT(*) as fail_count
          FROM error_logs
          WHERE component = ?
            AND auto_fix_result = 'failed'
            AND occurred_at > (? - 86400000)
            AND resolved_at IS NULL`,
    args: [error.component, Date.now()],
  });

  const failCount = Number((result.rows[0] as unknown as { fail_count: number }).fail_count) || 0;

  if (failCount >= 3) {
    await markEscalated(error.id);
    return true;
  }

  return false;
}

/** error_logs.escalated = 1 설정 + auto_fix_result = 'skipped' */
async function markEscalated(errorId: string): Promise<void> {
  const db = getContentDb();
  await db.execute({
    sql: `UPDATE error_logs
          SET escalated = 1, auto_fix_result = 'skipped',
              auto_fix_attempted = 1
          WHERE id = ?`,
    args: [errorId],
  });
}

/**
 * [5] logFixAttempt — 교정 시도/결과를 error_logs에 업데이트한다.
 * pipeline-logger.ts의 logAutoFix를 래핑.
 */
export async function logFixAttempt(
  errorId: string,
  result: FixResult
): Promise<void> {
  const fixResult = result.success ? 'success' : 'failed';
  await logAutoFix(errorId, fixResult, result.action);
}

/**
 * [6] runSelfHealingCycle — 전체 자체교정 사이클 실행.
 * Cron 또는 파이프라인 시작 전에 호출한다.
 *
 * 플로우:
 * 1. detectErrors() → 미해결 에러 목록
 * 2. 각 에러: classifyError() → attemptAutoFix() → logFixAttempt()
 * 3. 교정 실패 시 escalateIfNeeded()
 * 4. 결과 리포트 반환 + pipeline_logs 기록
 */
export async function runSelfHealingCycle(): Promise<HealingReport> {
  const report: HealingReport = { total: 0, fixed: 0, escalated: 0, skipped: 0 };

  const pipelineLog = await logPipelineStart('self-healing', 'scheduled');

  try {
    // 1. 미해결 에러 스캔
    const errors = await detectErrors();
    report.total = errors.length;

    if (errors.length === 0) {
      console.log('[self-healing] 미해결 에러 없음');
      await logPipelineComplete(pipelineLog.id, 0, { message: 'no_unresolved_errors' });
      return report;
    }

    console.log(`[self-healing] 미해결 에러 ${errors.length}건 발견`);

    const details: Array<{ error_id: string; component: string; result: string; level: string }> = [];

    // 2. 각 에러 처리
    for (const error of errors) {
      const classification = classifyError(error);

      // L5는 바로 에스컬레이션
      if (classification.level === 'L5') {
        await escalateIfNeeded(error);
        report.escalated++;
        details.push({ error_id: error.id, component: error.component, result: 'escalated', level: 'L5' });
        console.log(`[self-healing] ${error.id} (${error.component}:${error.error_type}) → L5 에스컬레이션`);
        continue;
      }

      // L3/L4는 Phase 2 → skip
      if (classification.level === 'L3' || classification.level === 'L4') {
        report.skipped++;
        details.push({ error_id: error.id, component: error.component, result: 'skipped', level: classification.level });
        console.log(`[self-healing] ${error.id} (${error.component}:${error.error_type}) → ${classification.level} Phase 2 대기`);
        continue;
      }

      // L1/L2 처리
      const fixResult = await attemptAutoFix(error, classification);
      await logFixAttempt(error.id, fixResult);

      if (fixResult.success) {
        report.fixed++;
        details.push({ error_id: error.id, component: error.component, result: 'success', level: classification.level });
      } else {
        // 에스컬레이션 필요 여부 확인
        const escalated = await escalateIfNeeded(error);
        if (escalated) {
          report.escalated++;
          details.push({ error_id: error.id, component: error.component, result: 'escalated', level: classification.level });
        } else {
          report.skipped++;
          details.push({ error_id: error.id, component: error.component, result: 'pending_retry', level: classification.level });
        }
      }
    }

    // 3. pipeline_logs 기록
    await logPipelineComplete(pipelineLog.id, report.total, {
      total_errors: report.total,
      fixed: report.fixed,
      escalated: report.escalated,
      skipped: report.skipped,
      details,
    });

    console.log(`[self-healing] 완료: ${report.total}건 스캔, ${report.fixed}건 교정, ${report.escalated}건 에스컬레이션, ${report.skipped}건 스킵`);

    return report;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[self-healing] 사이클 오류: ${errMsg}`);
    await logPipelineFailed(pipelineLog.id, errMsg);
    return report;
  }
}

// --- 인라인 자체교정 헬퍼 (Stage에서 직접 호출) ---

/**
 * L1 즉시 재시도: 동일 함수를 1회 재실행한다.
 * @param fn 재시도할 비동기 함수
 * @param delayMs 재시도 전 대기 시간 (기본 5초)
 * @param component 에러 컴포넌트 (error_logs 기록용)
 * @param errorType 에러 타입 (error_logs 기록용)
 * @param errorMessage 원래 에러 메시지
 * @returns fn() 결과 또는 null (재시도 실패 시)
 */
export async function retryL1<T>(
  fn: () => Promise<T>,
  delayMs: number = 5000,
  component: ErrorComponent,
  errorType: ErrorType,
  errorMessage: string
): Promise<{ result: T; errorLogId: string } | null> {
  const errorLogId = await logError(component, errorType, errorMessage);

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  try {
    const result = await fn();
    await logAutoFix(errorLogId, 'success', 'L1 즉시 재시도 성공');
    console.log(`[self-healing:L1] ${component}:${errorType} 재시도 성공`);
    return { result, errorLogId };
  } catch (retryErr) {
    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
    await logAutoFix(errorLogId, 'failed', `L1 재시도 실패: ${retryMsg}`);
    console.warn(`[self-healing:L1] ${component}:${errorType} 재시도 실패: ${retryMsg}`);
    return null;
  }
}

/**
 * L2 백오프 재시도: 지수 백오프로 최대 maxRetries회 재시도한다.
 * @param fn 재시도할 비동기 함수
 * @param maxRetries 최대 재시도 횟수 (기본 3)
 * @param baseDelayMs 기본 대기 시간 (기본 5초, 각 시도마다 2배)
 * @param component 에러 컴포넌트
 * @param errorType 에러 타입
 * @param errorMessage 원래 에러 메시지
 * @returns fn() 결과 또는 null (모든 재시도 실패 시)
 */
export async function retryL2<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 5000,
  component: ErrorComponent,
  errorType: ErrorType,
  errorMessage: string
): Promise<{ result: T; errorLogId: string } | null> {
  const errorLogId = await logError(component, errorType, errorMessage);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    console.log(`[self-healing:L2] ${component}:${errorType} 재시도 ${attempt}/${maxRetries} (${delay}ms 대기)`);

    await sleep(delay);

    try {
      const result = await fn();
      await logAutoFix(errorLogId, 'success', `L2 백오프 재시도 성공 (${attempt}/${maxRetries})`);
      console.log(`[self-healing:L2] ${component}:${errorType} 재시도 ${attempt} 성공`);
      return { result, errorLogId };
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (attempt === maxRetries) {
        await logAutoFix(errorLogId, 'failed', `L2 ${maxRetries}회 백오프 재시도 모두 실패: ${retryMsg}`);
        console.warn(`[self-healing:L2] ${component}:${errorType} 최종 실패`);
      }
    }
  }

  return null;
}

/**
 * L5 에스컬레이션: error_logs에 에스컬레이션 기록.
 * Phase 1에서는 DB 기록만. Phase 2에서 Telegram 알림 추가.
 */
export async function escalateL5(
  component: ErrorComponent,
  errorType: ErrorType,
  errorMessage: string,
  options?: { contentId?: string; channelId?: string }
): Promise<string> {
  const errorLogId = await logError(component, errorType, errorMessage, options);
  await markEscalated(errorLogId);
  console.error(`[self-healing:L5] 에스컬레이션: ${component}:${errorType} — ${errorMessage}`);
  return errorLogId;
}
