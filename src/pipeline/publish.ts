import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@libsql/client";
import { sendNewsletter, getStibeeStatus } from "../lib/stibee";
import { publishToSns, getGetlateStatus } from "../lib/getlate";

const TEMPLATE_PATH = join(process.cwd(), "prompts", "newsletter-template.html");
const STIBEE_LIST_ID = Number(process.env.STIBEE_LIST_ID) || 0;

interface Newsletter {
  id: string;
  subject: string;
  html_content: string;
  plain_content: string | null;
  status: string;
}

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

function getBlogDb() {
  return createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_DB_TOKEN!,
  });
}

function loadTemplate(): string | null {
  try {
    return readFileSync(TEMPLATE_PATH, "utf-8");
  } catch {
    console.log("[publish] newsletter-template.html not found, using raw HTML");
    return null;
  }
}

function applyTemplate(
  template: string,
  newsletter: Newsletter
): string {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract title from subject (remove [AI AppPro] prefix)
  const title = (newsletter.subject || "")
    .replace(/\[.*?\]\s*/, "")
    .trim();

  // The template has structured placeholders for individual news items,
  // but our generated html_content is already formatted.
  // We'll use a simplified approach: inject the full html_content into the
  // template's content area, replacing the news item block + tool card block.

  let html = template;

  // Replace simple placeholders
  html = html.replace(/\{\{SUBJECT\}\}/g, newsletter.subject);
  html = html.replace(/\{\{TITLE\}\}/g, title || "주간 AI 브리핑");
  html = html.replace(/\{\{DATE\}\}/g, today);
  html = html.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, "<%UNSUB%>");

  // Replace the intro placeholder with a generic intro
  html = html.replace(/\{\{INTRO\}\}/g, "안녕하세요, AI AppPro입니다. 이번 주 주요 AI 뉴스를 정리했습니다.");

  // Replace the news items block (between <!-- News Items --> and <!-- /News Item -->)
  // with the generated html_content
  const newsBlockRegex =
    /<!-- News Items -->[\s\S]*?<!-- \/News Item -->/;
  if (newsBlockRegex.test(html)) {
    const contentBlock = `<!-- News Items -->
          <tr>
            <td style="padding:0 40px 24px;">
              ${newsletter.html_content}
            </td>
          </tr>
          <!-- /News Item -->`;
    html = html.replace(newsBlockRegex, contentBlock);
  }

  // Replace tool card block with AI directory promotion (already in CTA section)
  const toolBlockRegex =
    /<!-- Recommended AI Tools Section -->[\s\S]*?<!-- \/Tool Card -->/;
  if (toolBlockRegex.test(html)) {
    html = html.replace(toolBlockRegex, "");
  }

  // Clean up remaining unreplaced placeholders
  html = html.replace(/\{\{[A-Z_]+\}\}/g, "");

  return html;
}

export async function sendViaStibee(
  newsletterId: string
): Promise<boolean> {
  if (!process.env.CONTENT_OS_DB_URL) {
    console.error("[publish] CONTENT_OS_DB_URL not set");
    return false;
  }

  const db = getContentDb();

  // 1. Get newsletter from DB
  const result = await db.execute({
    sql: 'SELECT id, subject, html_content, plain_content, status FROM newsletters WHERE id = ?',
    args: [newsletterId],
  });

  const newsletter = result.rows[0] as unknown as Newsletter | undefined;
  if (!newsletter) {
    console.error(`[publish] Newsletter not found: ${newsletterId}`);
    return false;
  }

  if (newsletter.status === "sent") {
    console.log(`[publish] Newsletter already sent: ${newsletterId}`);
    return true;
  }

  // 2. Apply HTML template
  const template = loadTemplate();
  const finalHtml = template
    ? applyTemplate(template, newsletter)
    : newsletter.html_content;

  console.log(
    `[publish] HTML prepared (template: ${template ? "applied" : "raw"}, length: ${finalHtml.length})`
  );

  // 3. Send via Stibee client (handles mock mode internally)
  const stibeeStatus = getStibeeStatus();
  console.log(`[publish] Stibee mode: ${stibeeStatus.mode}`);

  const sendResult = await sendNewsletter({
    listId: STIBEE_LIST_ID,
    subject: newsletter.subject,
    htmlContent: finalHtml,
    plainContent: newsletter.plain_content || undefined,
  });

  if (sendResult.mock) {
    // Mock mode: mark as ready
    await db.execute({
      sql: "UPDATE newsletters SET status = 'ready', sent_at = datetime('now') WHERE id = ?",
      args: [newsletterId],
    });
    console.log("[publish] Mock mode. Newsletter marked as 'ready'.");
    console.log("[publish] Set STIBEE_API_KEY and STIBEE_LIST_ID to enable sending.");
    return false;
  }

  if (sendResult.success && sendResult.emailId) {
    // Real send: update status
    await db.execute({
      sql: "UPDATE newsletters SET status = 'sent', stibee_email_id = ?, sent_at = datetime('now') WHERE id = ?",
      args: [String(sendResult.emailId), newsletterId],
    });
    console.log(
      `[publish] Newsletter sent via Stibee. Email ID: ${sendResult.emailId}`
    );
    return true;
  }

  console.error(`[publish] Stibee send failed: ${sendResult.error}`);
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
      sql: "INSERT INTO blog_posts (title, slug, content, excerpt, category, tags, author, published, published_at, meta_description) VALUES (?, ?, ?, ?, '주간 AI 브리핑', ?, 'AI AppPro', 1, datetime('now'), ?) ON CONFLICT (slug) DO NOTHING",
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
      await sendViaStibee(latest.id as string);
      await publishToBlog(latest.id as string);
      console.log("[publish] Done.");
    })();
  } else {
    (async () => {
      await sendViaStibee(newsletterId);
      await publishToBlog(newsletterId);
      console.log("[publish] Done.");
    })();
  }
}
