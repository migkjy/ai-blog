import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

function getBlogDb() {
  return createClient({
    url: process.env.BLOG_DB_URL || process.env.TURSO_DB_URL!,
    authToken: process.env.BLOG_DB_TOKEN || process.env.TURSO_DB_TOKEN!,
  });
}

export async function GET(req: NextRequest) {
  // CRON_SECRET 인증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getBlogDb();

    // approved_at IS NOT NULL AND published = 0인 게시물 조회
    const result = await db.execute({
      sql: 'SELECT id, title, slug FROM blog_posts WHERE approved_at IS NOT NULL AND published = 0',
      args: [],
    });

    const pendingPosts = result.rows;

    if (pendingPosts.length === 0) {
      console.log('[cron/publish] 발행 대기 게시물 없음');
      return NextResponse.json({ published: 0, titles: [] });
    }

    const now = Date.now();
    const publishedTitles: string[] = [];

    for (const post of pendingPosts) {
      const id = post.id as string;
      const title = post.title as string;

      await db.execute({
        sql: 'UPDATE blog_posts SET published = 1, publishedAt = ?, updatedAt = ? WHERE id = ?',
        args: [now, now, id],
      });

      console.log(`[cron/publish] 발행 완료: "${title}" (id: ${id})`);
      publishedTitles.push(title);
    }

    console.log(`[cron/publish] 총 ${publishedTitles.length}건 발행`);

    return NextResponse.json({
      published: publishedTitles.length,
      titles: publishedTitles,
    });
  } catch (err) {
    console.error('[cron/publish] DB 오류:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
