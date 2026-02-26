/**
 * id=null인 blog_posts 레코드를 slug로 찾아 content의 vercel.app 링크 제거
 */
import { createClient } from "@libsql/client/web";

const client = createClient({
  url: "libsql://apppro-kr-migkjy.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2OTk5MDgsImlkIjoiMmRiNWUwMDktYzVhNS00ZTcxLWFlMDQtMTYyNmU2NjEwMTg5IiwicmlkIjoiMDkwMmJiMTEtODZjNy00MDBkLTg4MzEtMjdiNzA2YmQ5ZGZhIn0.iyA0v2sLm9Z8cyMvTuXMiXDsMNLmZ5dzAxhb8O50dVasBmya6ZBsGOYOUSJc120gRwFIIOE4-kNyXi1WNsZuAg",
});

function fixVercelLinks(text) {
  if (!text) return text;
  let result = text;
  result = result.replace(
    /https?:\/\/content-pipeline-sage\.vercel\.app(\/[^\s"'<>]*)?/g,
    (_, path) => `https://apppro.kr/blog${path || ""}`
  );
  result = result.replace(
    /<a\s[^>]*href=["']https?:\/\/ai-directory-seven\.vercel\.app[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, innerText) => innerText.trim()
  );
  result = result.replace(
    /https?:\/\/ai-directory-seven\.vercel\.app(\/[^\s"'<>]*)?/g,
    ""
  );
  return result;
}

const slug = "newsletter-2026-02-24-weekly-ai-briefing";

// Fetch the row
const r = await client.execute({
  sql: "SELECT content FROM blog_posts WHERE slug = ?",
  args: [slug],
});

if (r.rows.length === 0) {
  console.log("Row not found by slug.");
  process.exit(1);
}

const original = String(r.rows[0].content);
const matches = original.match(/https?:\/\/[a-zA-Z0-9-]+\.vercel\.app[^\s"'<>]*/g);
console.log("vercel.app URLs found:", matches ? [...new Set(matches)] : "none");

const fixed = fixVercelLinks(original);
if (fixed === original) {
  console.log("No changes needed.");
  process.exit(0);
}

await client.execute({
  sql: "UPDATE blog_posts SET content = ?, updatedAt = datetime('now') WHERE slug = ?",
  args: [fixed, slug],
});

console.log("Updated successfully.");

// Verify
const check = await client.execute({
  sql: "SELECT content FROM blog_posts WHERE slug = ? AND content LIKE '%vercel.app%'",
  args: [slug],
});
console.log("Remaining vercel.app in this row:", check.rows.length > 0 ? "YES — problem" : "0 — clean");
