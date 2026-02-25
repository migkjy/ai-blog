// projects/content-pipeline/src/app/api/pipeline/reject/route.ts
import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * POST /api/pipeline/reject
 * Body: { contentId: string, reason: string }
 *
 * content_queue.status를 reviewing → draft로 되돌리고 rejected_reason을 기록한다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contentId, reason } = body;

    if (!contentId || !reason) {
      return NextResponse.json({ error: 'contentId와 reason은 필수입니다' }, { status: 400 });
    }

    const db = getContentDb();
    const now = Date.now();

    // 콘텐츠 존재 확인
    const existing = await db.execute({
      sql: 'SELECT id, status FROM content_queue WHERE id = ?',
      args: [contentId],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다' }, { status: 404 });
    }

    const currentStatus = existing.rows[0].status as string;
    if (!['draft', 'reviewing'].includes(currentStatus)) {
      return NextResponse.json(
        { error: `현재 상태(${currentStatus})에서 거부할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 거부: status → draft, rejected_reason 기록
    await db.execute({
      sql: `UPDATE content_queue
            SET status = 'draft', rejected_reason = ?, updated_at = ?
            WHERE id = ?`,
      args: [reason, now, contentId],
    });

    // pipeline_logs 기록
    const logId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO pipeline_logs (id, pipeline_name, status, items_processed, metadata, trigger_type, created_at)
            VALUES (?, 'approve', 'completed', 1, ?, 'manual', ?)`,
      args: [logId, JSON.stringify({ action: 'rejected', content_id: contentId, reason }), now],
    });

    console.log(`[reject] 거부: ${contentId}, 사유: ${reason}`);

    return NextResponse.json({ success: true, contentId, status: 'draft', reason });
  } catch (err) {
    console.error('[reject] 오류:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
