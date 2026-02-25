// projects/content-pipeline/src/app/api/pipeline/approve/route.ts
import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * POST /api/pipeline/approve
 * Body: { contentId: string, approvedBy?: string }
 *
 * content_queue.status를 draft/reviewing → approved로 전환한다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contentId, approvedBy = 'ceo' } = body;

    if (!contentId) {
      return NextResponse.json({ error: 'contentId는 필수입니다' }, { status: 400 });
    }

    const db = getContentDb();
    const now = Date.now();

    // 콘텐츠 존재 및 상태 확인
    const existing = await db.execute({
      sql: 'SELECT id, status, title FROM content_queue WHERE id = ?',
      args: [contentId],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다' }, { status: 404 });
    }

    const current = existing.rows[0];
    const currentStatus = current.status as string;

    if (!['draft', 'reviewing'].includes(currentStatus)) {
      return NextResponse.json(
        { error: `현재 상태(${currentStatus})에서 승인할 수 없습니다. draft 또는 reviewing만 가능합니다.` },
        { status: 400 }
      );
    }

    // 승인 업데이트
    await db.execute({
      sql: `UPDATE content_queue
            SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [approvedBy, now, now, contentId],
    });

    // pipeline_logs 기록
    const logId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO pipeline_logs (id, pipeline_name, status, items_processed, metadata, trigger_type, created_at)
            VALUES (?, 'approve', 'completed', 1, ?, 'manual', ?)`,
      args: [logId, JSON.stringify({ approved_by: approvedBy, content_id: contentId }), now],
    });

    console.log(`[approve] 승인 완료: ${contentId} (by ${approvedBy})`);

    // 승인 완료 → Stage 4 자동 발행 트리거
    try {
      const { runPublishStage } = await import('../../../../pipeline/stage-publish');
      const publishResult = await runPublishStage(contentId, 'scheduled');
      console.log(`[approve] 자동 발행: ${publishResult.success ? '성공' : '실패'}`);

      return NextResponse.json({
        success: true,
        contentId,
        status: 'approved',
        approvedBy,
        approvedAt: now,
        autoPublish: {
          triggered: true,
          success: publishResult.success,
          blogPostId: publishResult.blogPostId,
        },
      });
    } catch (publishErr) {
      console.warn('[approve] 자동 발행 실패 (승인은 완료됨):', publishErr);
      return NextResponse.json({
        success: true,
        contentId,
        status: 'approved',
        approvedBy,
        approvedAt: now,
        autoPublish: { triggered: true, success: false, error: String(publishErr) },
      });
    }
  } catch (err) {
    console.error('[approve] 오류:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
