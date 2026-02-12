import { neon } from "@neondatabase/serverless";
import type { GeneratedBlogPost } from "./generate-blog";

export async function publishBlogPost(
  post: GeneratedBlogPost
): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    console.error("[publish-blog] DATABASE_URL이 설정되지 않았습니다.");
    return null;
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Check for duplicate slug
    const existing = await sql`
      SELECT id FROM blog_posts WHERE slug = ${post.slug}
    `;
    if (existing.length > 0) {
      console.warn(
        `[publish-blog] 슬러그 중복: "${post.slug}" — 건너뜁니다.`
      );
      return null;
    }

    const rows = await sql`
      INSERT INTO blog_posts (
        title, slug, content, excerpt, category, tags,
        author, published, published_at, meta_description
      ) VALUES (
        ${post.title},
        ${post.slug},
        ${post.content},
        ${post.excerpt},
        ${post.category},
        ${post.tags},
        'AI AppPro',
        true,
        now(),
        ${post.meta_description}
      )
      RETURNING id
    `;

    const id = rows[0]?.id as string;
    console.log(`[publish-blog] 블로그 포스트 게시 완료: "${post.title}"`);
    console.log(`[publish-blog] ID: ${id}, 슬러그: ${post.slug}`);
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
      "사용법: npx tsx src/pipeline/publish-blog.ts '{\"title\":..., \"slug\":..., ...}'"
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
