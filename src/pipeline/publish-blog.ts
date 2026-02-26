import { createClient } from "@libsql/client/web";
import type { GeneratedBlogPost } from "./generate-blog";

function getTursoClient() {
  const url = process.env.BLOG_DB_URL || process.env.TURSO_DB_URL;
  const authToken = process.env.BLOG_DB_TOKEN || process.env.TURSO_DB_TOKEN;
  if (!url || !authToken) {
    throw new Error("BLOG_DB_URL (또는 TURSO_DB_URL)과 BLOG_DB_TOKEN (또는 TURSO_DB_TOKEN)이 필요합니다.");
  }
  return createClient({ url, authToken });
}

function getKanbanClient() {
  const url = process.env.KANBAN_DB_URL;
  const authToken = process.env.KANBAN_DB_TOKEN;
  if (!url || !authToken) return null;
  return createClient({ url, authToken });
}

// Auto-increment OKR KR3-1 (Content Published) after successful publish
async function updateOkrContentPublished(): Promise<void> {
  const kanban = getKanbanClient();
  if (!kanban) return; // KANBAN_DB vars not set — skip silently

  try {
    const result = await kanban.execute(
      "SELECT current_value FROM okr_key_results WHERE id = 'KR3-1'"
    );
    const current = Number(result.rows[0]?.current_value ?? 0);
    await kanban.execute({
      sql: "UPDATE okr_key_results SET current_value = ?, updated_at = ? WHERE id = 'KR3-1'",
      args: [current + 1, Date.now()],
    });
    console.log(`[publish-blog] OKR KR3-1 Content Published: ${current} → ${current + 1}`);
  } catch {
    // OKR update failure must not block publishing
  }
}

export async function publishBlogPost(
  post: GeneratedBlogPost
): Promise<string | null> {
  try {
    const client = getTursoClient();

    // Check for duplicate slug
    const existing = await client.execute({
      sql: "SELECT id FROM blog_posts WHERE slug = ?",
      args: [post.slug],
    });
    if (existing.rows.length > 0) {
      console.warn(
        `[publish-blog] 슬러그 중복: "${post.slug}" — 건너뜁니다.`
      );
      return null;
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await client.execute({
      sql: `INSERT INTO blog_posts (
        id, title, slug, content, excerpt, category, tags,
        author, published, publishedAt, metaDescription, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      args: [
        id,
        post.title,
        post.slug,
        post.content,
        post.excerpt,
        post.category,
        JSON.stringify(post.tags),
        "AI AppPro",
        now,
        post.meta_description,
        now,
        now,
      ],
    });

    console.log(`[publish-blog] 블로그 포스트 게시 완료: "${post.title}"`);
    console.log(`[publish-blog] ID: ${id}, 슬러그: ${post.slug}`);

    // Auto-update OKR (fire-and-forget)
    updateOkrContentPublished().catch(() => {});

    return id;
  } catch (err) {
    console.error("[publish-blog] DB 저장 오류:", err);
    return null;
  }
}

// CLI entry point
if (process.argv[1]?.includes("publish-blog")) {
  const jsonArg = process.argv[2];
  if (!jsonArg) {
    console.error(
      '사용법: npx tsx src/pipeline/publish-blog.ts \'{"title":..., "slug":..., ...}\''
    );
    console.error(
      "일반적으로 run-blog-pipeline.ts를 통해 실행합니다."
    );
    process.exit(1);
  }

  try {
    const post: GeneratedBlogPost = JSON.parse(jsonArg);
    publishBlogPost(post).then((id) => {
      if (id) {
        console.log(`\n게시 완료. ID: ${id}`);
      } else {
        console.error("블로그 포스트 게시에 실패했습니다.");
        process.exit(1);
      }
    });
  } catch {
    console.error("JSON 파싱 오류. 올바른 JSON 형식으로 입력하세요.");
    process.exit(1);
  }
}
