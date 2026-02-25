import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * GET /api/pipeline/errors?resolved=unresolved&component=&error_type=&page=1&limit=20
 *
 * 에러 로그 목록. 에스컬레이션 에러를 별도 배열로 분리.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getContentDb();
    const sp = req.nextUrl.searchParams;

    const resolved = sp.get('resolved') || 'unresolved';
    const component = sp.get('component');
    const errorType = sp.get('error_type');
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(sp.get('limit')) || 20));
    const offset = (page - 1) * limit;

    // WHERE 조건
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (resolved === 'unresolved') {
      conditions.push('resolved_at IS NULL');
    } else if (resolved === 'resolved') {
      conditions.push('resolved_at IS NOT NULL');
    }
    // 'all'이면 resolved 조건 없음

    if (component) {
      conditions.push('component = ?');
      args.push(component);
    }
    if (errorType) {
      conditions.push('error_type = ?');
      args.push(errorType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 에스컬레이션 에러 (미해결만)
    const escalatedRes = await db.execute({
      sql: `SELECT id, occurred_at, component, error_type, error_message, content_id, channel_id,
                   auto_fix_attempted, auto_fix_result, auto_fix_action, escalated, resolved_at, resolution_type
            FROM error_logs WHERE escalated = 1 AND resolved_at IS NULL
            ORDER BY occurred_at DESC LIMIT 10`,
      args: [],
    });

    // 전체 개수 (에스컬레이션 제외 -- 일반 에러만)
    const nonEscConditions = [...conditions, 'escalated = 0'];
    const nonEscWhere = nonEscConditions.length > 0 ? `WHERE ${nonEscConditions.join(' AND ')}` : '';
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM error_logs ${nonEscWhere}`,
      args,
    });
    const total = Number((countRes.rows[0] as Record<string, unknown>).cnt) || 0;

    // 일반 에러 목록
    const listRes = await db.execute({
      sql: `SELECT id, occurred_at, component, error_type, error_message, content_id, channel_id,
                   auto_fix_attempted, auto_fix_result, auto_fix_action, escalated, resolved_at, resolution_type
            FROM error_logs ${nonEscWhere}
            ORDER BY occurred_at DESC LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    // 요약 통계
    const statsRes = await db.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM error_logs WHERE resolved_at IS NULL) as unresolved,
              (SELECT COUNT(*) FROM error_logs WHERE escalated = 1 AND resolved_at IS NULL) as escalated_count,
              ROUND(100.0 * SUM(CASE WHEN auto_fix_result = 'success' THEN 1 ELSE 0 END) / MAX(SUM(CASE WHEN auto_fix_attempted = 1 THEN 1 ELSE 0 END), 1)) as auto_fix_success_rate
            FROM error_logs WHERE occurred_at >= ?`,
      args: [Date.now() - 7 * 24 * 60 * 60 * 1000],
    });
    const statsRow = statsRes.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      escalated: escalatedRes.rows,
      items: listRes.rows,
      total,
      page,
      limit,
      stats: {
        unresolved: Number(statsRow.unresolved) || 0,
        escalated_count: Number(statsRow.escalated_count) || 0,
        auto_fix_success_rate: Number(statsRow.auto_fix_success_rate) || 0,
      },
    });
  } catch (err) {
    console.error('[errors] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
