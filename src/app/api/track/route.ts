import { createClient } from '@libsql/client/web';
import { NextRequest, NextResponse } from 'next/server';

const client = createClient({
  url: process.env.BLOG_DB_URL || process.env.TURSO_DB_URL!,
  authToken: process.env.BLOG_DB_TOKEN || process.env.TURSO_DB_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';

    if (/bot|crawler|spider|slurp|googlebot|bingbot/i.test(userAgent)) {
      return NextResponse.json({ ok: true });
    }

    await client.execute({
      sql: "INSERT INTO page_views (site, path, user_agent, referrer) VALUES ('blog', ?, ?, ?)",
      args: [path || '/', userAgent, referrer],
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
