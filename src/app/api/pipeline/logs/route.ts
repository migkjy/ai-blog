import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * GET /api/pipeline/logs?pipeline_name=&status=&days=7&page=1&limit=20
 *
 * 파이프라인 실행 로그 목록. 필터 + 페이지네이션 + 요약 통계.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getContentDb();
    const sp = req.nextUrl.searchParams;

    const pipelineName = sp.get('pipeline_name');
    const status = sp.get('status');
    const days = Number(sp.get('days')) || 7;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20));
    const offset = (page - 1) * limit;

    // 기간 필터
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

    // WHERE 조건 빌드
    const conditions: string[] = ['created_at >= ?'];
    const args: (string | number)[] = [sinceMs];

    if (pipelineName) {
      conditions.push('pipeline_name = ?');
      args.push(pipelineName);
    }
    if (status) {
      conditions.push('status = ?');
      args.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 전체 개수
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM pipeline_logs ${whereClause}`,
      args,
    });
    const total = Number((countRes.rows[0] as Record<string, unknown>).cnt) || 0;

    // 목록 조회
    const listRes = await db.execute({
      sql: `SELECT id, pipeline_name, status, duration_ms, items_processed, error_message, metadata, trigger_type, created_at
            FROM pipeline_logs ${whereClause}
            ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    // 요약 통계 (해당 기간 내)
    const statsRes = await db.execute({
      sql: `SELECT
              COUNT(*) as total_runs,
              ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / MAX(COUNT(*), 1)) as success_rate,
              ROUND(AVG(CASE WHEN status = 'completed' THEN duration_ms ELSE NULL END)) as avg_duration_ms
            FROM pipeline_logs WHERE created_at >= ?`,
      args: [sinceMs],
    });

    const statsRow = statsRes.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      items: listRes.rows,
      total,
      page,
      limit,
      stats: {
        total_runs: Number(statsRow.total_runs) || 0,
        success_rate: Number(statsRow.success_rate) || 0,
        avg_duration_ms: Number(statsRow.avg_duration_ms) || 0,
      },
    });
  } catch (err) {
    console.error('[logs] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
