import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * GET /api/pipeline/content/[id]
 *
 * 개별 콘텐츠 상세 조회 (content_body 포함).
 * 기존 GET /api/pipeline/content는 목록 조회이므로 content_body를 포함하지 않는다.
 * 이 API는 승인 화면에서 콘텐츠 본문 미리보기를 위해 content_body를 함께 반환한다.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getContentDb();

    const result = await db.execute({
      sql: `SELECT id, type, pillar, topic, status, title, content_body,
                   approved_by, approved_at, rejected_reason, created_at, updated_at
            FROM content_queue WHERE id = ? LIMIT 1`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json({ item: result.rows[0] });
  } catch (err) {
    console.error('[content/id] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
