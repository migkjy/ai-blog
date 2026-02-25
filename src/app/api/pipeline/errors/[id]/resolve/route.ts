import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

/**
 * POST /api/pipeline/errors/[id]/resolve
 * Body: { resolution_type?: string }
 *
 * 에러를 수동 해결 처리한다.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const resolutionType = body.resolution_type || 'manual_fixed';
    const now = Date.now();

    const db = getContentDb();

    // 존재 확인
    const existing = await db.execute({
      sql: 'SELECT id, resolved_at FROM error_logs WHERE id = ?',
      args: [id],
    });

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Error not found' }, { status: 404 });
    }

    if ((existing.rows[0] as Record<string, unknown>).resolved_at) {
      return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
    }

    await db.execute({
      sql: 'UPDATE error_logs SET resolved_at = ?, resolution_type = ? WHERE id = ?',
      args: [now, resolutionType, id],
    });

    return NextResponse.json({ success: true, id, resolved_at: now, resolution_type: resolutionType });
  } catch (err) {
    console.error('[errors/resolve] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
