import { getContentDb } from '../../../../lib/content-db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/pipeline/notifications?status=&type=&target=&page=1&limit=50
 */
export async function GET(req: NextRequest) {
  try {
    const db = getContentDb();
    const sp = req.nextUrl.searchParams;

    const status = sp.get('status') || 'all';
    const type = sp.get('type');
    const target = sp.get('target');
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      args.push(status);
    }
    if (type) {
      conditions.push('type = ?');
      args.push(type);
    }
    if (target) {
      conditions.push('target = ?');
      args.push(target);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM pipeline_notifications ${whereClause}`,
      args,
    });
    const total = Number((countRes.rows[0] as Record<string, unknown>).cnt) || 0;

    const listRes = await db.execute({
      sql: `SELECT id, type, target, title, body, content_id, status, sent_at, created_at, updated_at
            FROM pipeline_notifications ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    return NextResponse.json({
      notifications: listRes.rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[notifications] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
