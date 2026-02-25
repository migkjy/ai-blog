import { createClient } from '@libsql/client/web';
import { NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * GET /api/pipeline/stats
 *
 * 파이프라인 홈 대시보드용 요약 통계.
 * - collected_today: 오늘 수집된 뉴스 수 (collected_news)
 * - pending_review: 검수 대기 콘텐츠 수 (content_queue status IN draft/reviewing)
 * - published_today: 오늘 발행된 콘텐츠 수 (content_queue status=published)
 * - unresolved_errors: 미해결 에러 수 (error_logs resolved_at IS NULL)
 * - recent_logs: 최근 파이프라인 실행 5건
 */
export async function GET() {
  try {
    const db = getContentDb();

    // 오늘 00:00 KST (UTC+9) 타임스탬프 (ms)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    const todayStartMs = todayStart.getTime() - kstOffset;

    const [collectedRes, pendingRes, publishedRes, errorsRes, logsRes] = await Promise.all([
      db.execute({
        sql: 'SELECT COUNT(*) as cnt FROM collected_news WHERE created_at >= ?',
        args: [todayStartMs],
      }),
      db.execute({
        sql: "SELECT COUNT(*) as cnt FROM content_queue WHERE status IN ('draft', 'reviewing')",
        args: [],
      }),
      db.execute({
        sql: "SELECT COUNT(*) as cnt FROM content_queue WHERE status = 'published' AND updated_at >= ?",
        args: [todayStartMs],
      }),
      db.execute({
        sql: 'SELECT COUNT(*) as cnt FROM error_logs WHERE resolved_at IS NULL',
        args: [],
      }),
      db.execute({
        sql: 'SELECT id, pipeline_name, status, items_processed, duration_ms, created_at FROM pipeline_logs ORDER BY created_at DESC LIMIT 5',
        args: [],
      }),
    ]);

    return NextResponse.json({
      collected_today: Number((collectedRes.rows[0] as Record<string, unknown>).cnt) || 0,
      pending_review: Number((pendingRes.rows[0] as Record<string, unknown>).cnt) || 0,
      published_today: Number((publishedRes.rows[0] as Record<string, unknown>).cnt) || 0,
      unresolved_errors: Number((errorsRes.rows[0] as Record<string, unknown>).cnt) || 0,
      recent_logs: logsRes.rows,
    });
  } catch (err) {
    console.error('[stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
