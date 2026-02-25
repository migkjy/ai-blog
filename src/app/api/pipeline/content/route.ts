// projects/content-pipeline/src/app/api/pipeline/content/route.ts
import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * GET /api/pipeline/content?status=draft
 *
 * content_queue 조회. status 파라미터로 필터링 가능.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getContentDb();
    const status = req.nextUrl.searchParams.get('status');

    let sql = 'SELECT id, type, pillar, topic, status, title, approved_by, approved_at, rejected_reason, created_at, updated_at FROM content_queue';
    const args: (string | number)[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      args.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await db.execute({ sql, args });

    return NextResponse.json({ items: result.rows });
  } catch (err) {
    console.error('[content] 오류:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
