import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const BASE_URL = "https://content-pipeline-sage.vercel.app";

export async function GET() {
  const rows = await sql`
    SELECT title, slug, excerpt, meta_description, category, published_at, created_at
    FROM blog_posts
    WHERE published = true
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT 20
  `;

  const items = rows
    .map(
      (post) => `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/posts/${post.slug}</link>
      <description><![CDATA[${post.excerpt || post.meta_description || ""}]]></description>
      ${post.category ? `<category>${post.category}</category>` : ""}
      <pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate>
      <guid>${BASE_URL}/posts/${post.slug}</guid>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI AppPro 블로그</title>
    <link>${BASE_URL}</link>
    <description>소상공인과 중소기업을 위한 실전 AI 활용 가이드. AI 도구 리뷰, 업종별 자동화 플레이북, 최신 AI 트렌드.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
