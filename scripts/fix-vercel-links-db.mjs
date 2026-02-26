/**
 * DB에서 vercel.app 링크 제거 스크립트
 * - apppro-kr DB: blog_posts 테이블
 * - content-os DB: newsletters 테이블
 */

import { createClient } from "@libsql/client/web";

const APPPRO_DB = {
  url: "libsql://apppro-kr-migkjy.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2OTk5MDgsImlkIjoiMmRiNWUwMDktYzVhNS00ZTcxLWFlMDQtMTYyNmU2NjEwMTg5IiwicmlkIjoiMDkwMmJiMTEtODZjNy00MDBkLTg4MzEtMjdiNzA2YmQ5ZGZhIn0.iyA0v2sLm9Z8cyMvTuXMiXDsMNLmZ5dzAxhb8O50dVasBmya6ZBsGOYOUSJc120gRwFIIOE4-kNyXi1WNsZuAg",
};

const CONTENT_OS_DB = {
  url: "libsql://content-os-migkjy.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzE4MzEzNjcsImlkIjoiM2NkMTE2YjUtOWMwZS00YWZkLWI1OGYtYWZlZDZmZTgwMzRmIiwicmlkIjoiNGU2NmY0YWMtN2M2Ni00YTFiLThmNzEtYTEzNWU1YTUzNWQ2In0.6rSElslfeBOerqeipE0aDZFRUl-2_YpV1wac2cMljWLFadHL8XHw7PYZY6T2p57GJkIuItGlpxkSUnZb8xKzAA",
};

/**
 * Replace all vercel.app links in a string.
 * - content-pipeline-sage.vercel.app → apppro.kr/blog
 * - ai-directory-seven.vercel.app → remove href, keep inner text
 */
function fixVercelLinks(text) {
  if (!text) return text;
  let result = text;

  // 1. content-pipeline-sage.vercel.app → apppro.kr/blog
  result = result.replace(
    /https?:\/\/content-pipeline-sage\.vercel\.app(\/[^\s"'<>]*)?/g,
    (_, path) => `https://apppro.kr/blog${path || ""}`
  );

  // 2. ai-directory-seven.vercel.app — remove <a> href, keep inner text
  result = result.replace(
    /<a\s[^>]*href=["']https?:\/\/ai-directory-seven\.vercel\.app[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, innerText) => innerText.trim()
  );

  // 3. Any remaining bare ai-directory-seven.vercel.app URLs
  result = result.replace(
    /https?:\/\/ai-directory-seven\.vercel\.app(\/[^\s"'<>]*)?/g,
    ""
  );

  return result;
}

async function inspectSchema(client, tableName) {
  try {
    const result = await client.execute(`PRAGMA table_info(${tableName})`);
    return result.rows.map((r) => r.name);
  } catch (e) {
    return [];
  }
}

async function processTable(dbConfig, dbName, tableName) {
  const client = createClient(dbConfig);

  console.log(`\n=== ${dbName} / ${tableName} ===`);

  // 1. Get actual column names
  const cols = await inspectSchema(client, tableName);
  if (cols.length === 0) {
    console.log(`Table ${tableName} not found.`);
    return;
  }
  console.log(`Columns: ${cols.join(", ")}`);

  // 2. Determine text columns to check (only those that exist)
  const candidateCols = ["content", "html_content", "plain_content", "subject", "excerpt", "meta_description", "body"];
  const textCols = candidateCols.filter((c) => cols.includes(c));
  const idCol = cols.includes("id") ? "id" : cols[0];
  const slugCol = cols.includes("slug") ? "slug" : (cols.includes("subject") ? "subject" : idCol);

  if (textCols.length === 0) {
    console.log(`No text columns found to check.`);
    return;
  }

  // 3. Find rows with vercel.app
  const conditions = textCols.map((col) => `${col} LIKE '%vercel.app%'`).join(" OR ");
  const findSql = `SELECT ${idCol}, ${slugCol !== idCol ? slugCol + ", " : ""}${textCols.join(", ")} FROM ${tableName} WHERE ${conditions}`;

  let rows;
  try {
    const result = await client.execute(findSql);
    rows = result.rows;
  } catch (e) {
    console.log(`Query error: ${e.message}`);
    return;
  }

  if (rows.length === 0) {
    console.log(`No vercel.app links found in ${tableName}.`);
    return;
  }

  console.log(`Found ${rows.length} row(s) with vercel.app links:`);

  for (const row of rows) {
    const id = row[idCol];
    const slug = slugCol !== idCol ? row[slugCol] : id;
    console.log(`\n  ID: ${id} | ${slugCol}: ${String(slug).slice(0, 80)}`);

    for (const col of textCols) {
      const original = row[col];
      if (!original || !String(original).includes("vercel.app")) continue;

      const fixed = fixVercelLinks(String(original));
      if (fixed === original) continue;

      const matches = String(original).match(/https?:\/\/[a-zA-Z0-9-]+\.vercel\.app[^\s"'<>]*/g);
      if (matches) {
        console.log(`  [${col}] URLs: ${[...new Set(matches)].join(", ")}`);
      }

      // Determine update timestamp column
      const hasUpdatedAt = cols.includes("updated_at");
      const updateSql = hasUpdatedAt
        ? `UPDATE ${tableName} SET ${col} = ?, updated_at = datetime('now') WHERE ${idCol} = ?`
        : `UPDATE ${tableName} SET ${col} = ? WHERE ${idCol} = ?`;

      await client.execute({ sql: updateSql, args: [fixed, id] });
      console.log(`  [${col}] Updated.`);
    }
  }
}

async function main() {
  console.log("=== Turso DB vercel.app 링크 제거 시작 ===");

  // apppro-kr DB: blog_posts
  await processTable(APPPRO_DB, "apppro-kr", "blog_posts");

  // content-os DB: newsletters
  await processTable(CONTENT_OS_DB, "content-os", "newsletters");

  console.log("\n=== 완료 ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
