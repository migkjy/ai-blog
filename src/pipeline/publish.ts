import { createClient } from "@libsql/client/web";
import { publishToSns, getGetlateStatus } from "../lib/getlate";
import { sendCampaign, getBrevoStatus } from "../lib/brevo";

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

function getBlogDb() {
  return createClient({
    url: process.env.BLOG_DB_URL || process.env.TURSO_DB_URL!,
    authToken: process.env.BLOG_DB_TOKEN || process.env.TURSO_DB_TOKEN!,
  });
}

/**
 * Brevo를 통해 뉴스레터 캠페인 발송
 * @param newsletterId 발송할 뉴스레터 ID
 */
export async function sendViaBrevo(newsletterId: string): Promise<boolean> {
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[publish] CONTENT_OS_DB_URL not set");
    return false;
  }

  const brevoStatus = getBrevoStatus();
  console.log(`[publish] brevo mode: ${brevoStatus.mode}, listId: ${brevoStatus.listId}`);

  if (!brevoStatus.configured) {
    console.log("[publish] BREVO_API_KEY not set. 이메일 캠페인 발송 스킵.");
    return false;
  }

  if (brevoStatus.listId === 0) {
    console.log("[publish] BREVO_LIST_ID not set or 0. 이메일 캠페인 발송 스킵.");
    return false;
  }

  const db = getContentDb();
  const result = await db.execute({
    sql: "SELECT subject, html_content FROM newsletters WHERE id = ?",
    args: [newsletterId],
  });
  const newsletter = result.rows[0];
  if (!newsletter) return false;

  const campaignResult = await sendCampaign(
    brevoStatus.listId,
    newsletter.subject as string,
    newsletter.html_content as string
  );

  if (campaignResult.mock) {
    console.log("[publish] Brevo mock 모드 — 이메일 캠페인 발송 스킵.");
    return false;
  }

  if (campaignResult.success) {
    console.log(`[publish] Brevo 캠페인 발송 완료. Campaign ID: ${campaignResult.campaignId}`);
    return true;
  }

  console.error(`[publish] Brevo 캠페인 발송 실패: ${campaignResult.error}`);
  return false;
}

export async function publishToBlog(
  newsletterId: string
): Promise<boolean> {
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[publish] CONTENT_OS_DB_URL not set");
    return false;
  }

  const contentDb = getContentDb();
  const blogDb = getBlogDb();

  // Get newsletter
  const result = await contentDb.execute({
    sql: 'SELECT subject, html_content, plain_content FROM newsletters WHERE id = ?',
    args: [newsletterId],
  });
  const newsletter = result.rows[0];
  if (!newsletter) return false;

  // Generate slug from subject
  const slug = (newsletter.subject as string)
    .replace(/\[.*?\]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^가-힣a-zA-Z0-9-]/g, "")
    .slice(0, 80)
    .toLowerCase();

  const today = new Date().toISOString().split("T")[0];
  const finalSlug = `newsletter-${today}-${slug || "weekly"}`;

  try {
    const content = (newsletter.plain_content as string) || (newsletter.html_content as string);
    const excerpt = (newsletter.plain_content as string)?.slice(0, 200) || "주간 AI 브리핑";
    const tags = JSON.stringify(["뉴스레터", "AI트렌드", "주간브리핑"]);
    const metaDesc = `${newsletter.subject} - AI AppPro 주간 뉴스레터`;

    await blogDb.execute({
      sql: "INSERT INTO blog_posts (title, slug, content, excerpt, category, tags, author, published, publishedAt, metaDescription) VALUES (?, ?, ?, ?, '주간 AI 브리핑', ?, 'AI AppPro', 1, unixepoch() * 1000, ?) ON CONFLICT (slug) DO NOTHING",
      args: [newsletter.subject as string, finalSlug, content, excerpt, tags, metaDesc],
    });
    console.log(`[publish] Blog post created: ${finalSlug}`);
    return true;
  } catch (err) {
    console.error("[publish] Error publishing to blog:", err);
    return false;
  }
}

export async function publishToSnsViaGetlate(
  newsletterId: string,
  blogUrl?: string
): Promise<boolean> {
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[publish] CONTENT_OS_DB_URL not set");
    return false;
  }

  const getlateStatus = getGetlateStatus();
  console.log(`[publish] getlate mode: ${getlateStatus.mode}`);

  if (!getlateStatus.configured) {
    console.log("[publish] GETLATE_API_KEY not set. SNS 배포 스킵.");
    return false;
  }

  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT subject, plain_content FROM newsletters WHERE id = ?',
    args: [newsletterId],
  });
  const newsletter = result.rows[0];
  if (!newsletter) return false;

  // SNS용 짧은 요약 콘텐츠 생성 (plain_content 앞 200자)
  const summary = (newsletter.plain_content as string)?.slice(0, 200) || (newsletter.subject as string);
  const snsContent = `[AI AppPro 주간 브리핑]\n${newsletter.subject}\n\n${summary}`;

  const snsResult = await publishToSns({
    content: snsContent,
    blogUrl,
    publishNow: true,
  });

  if (snsResult.mock) {
    console.log("[publish] getlate mock 모드 — SNS 배포 스킵.");
    return false;
  }

  if (snsResult.success) {
    console.log(`[publish] SNS 배포 완료. Post ID: ${snsResult.postId}, 계정 수: ${snsResult.accountCount}`);
    return true;
  }

  if (snsResult.error === 'NO_ACCOUNTS') {
    console.log("[publish] getlate에 연결된 SNS 계정 없음. getlate.dev에서 계정 연결 필요.");
  } else {
    console.error(`[publish] SNS 배포 실패: ${snsResult.error}`);
  }
  return false;
}

// CLI entry point
if (process.argv[1]?.includes("publish")) {
  const newsletterId = process.argv[2];
  if (!newsletterId) {
    // If no ID provided, get the latest draft
    (async () => {
      if (!process.env.CONTENT_OS_DB_URL) {
        console.error("CONTENT_OS_DB_URL not set");
        process.exit(1);
      }
      const db = getContentDb();
      const result = await db.execute({
        sql: 'SELECT id, subject, status FROM newsletters ORDER BY created_at DESC LIMIT 1',
        args: [],
      });
      if (result.rows.length === 0) {
        console.error("No newsletters found. Run generate first.");
        process.exit(1);
      }
      const latest = result.rows[0];
      console.log(
        `[publish] Using latest newsletter: ${latest.id} ("${latest.subject}", status: ${latest.status})`
      );
      await publishToBlog(latest.id as string);
      console.log("[publish] Done.");
    })();
  } else {
    (async () => {
      await publishToBlog(newsletterId);
      console.log("[publish] Done.");
    })();
  }
}
