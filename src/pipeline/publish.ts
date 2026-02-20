import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
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
  if (!process.env.DATABASE_URL) {
    console.error("[publish] DATABASE_URL not set");
    return false;
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Get newsletter from DB
  const rows = await sql`
    SELECT id, subject, html_content, plain_content, status
    FROM newsletters WHERE id = ${newsletterId}
  `;

  const newsletter = rows[0] as Newsletter | undefined;
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

  const result = await sendNewsletter({
    listId: STIBEE_LIST_ID,
    subject: newsletter.subject,
    htmlContent: finalHtml,
    plainContent: newsletter.plain_content || undefined,
  });

  if (result.mock) {
    // Mock mode: mark as ready
    await sql`
      UPDATE newsletters SET status = 'ready', sent_at = now()
      WHERE id = ${newsletterId}
    `;
    console.log("[publish] Mock mode. Newsletter marked as 'ready'.");
    console.log("[publish] Set STIBEE_API_KEY and STIBEE_LIST_ID to enable sending.");
    return false;
  }

  if (result.success && result.emailId) {
    // Real send: update status
    await sql`
      UPDATE newsletters SET status = 'sent', stibee_email_id = ${String(result.emailId)}, sent_at = now()
      WHERE id = ${newsletterId}
    `;
    console.log(
      `[publish] Newsletter sent via Stibee. Email ID: ${result.emailId}`
    );
    return true;
  }

  console.error(`[publish] Stibee send failed: ${result.error}`);
  return false;
}

export async function publishToBlog(
  newsletterId: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    console.error("[publish] DATABASE_URL not set");
    return false;
  }

  const sql = neon(process.env.DATABASE_URL);

  // Get newsletter
  const rows = await sql`
    SELECT subject, html_content, plain_content FROM newsletters WHERE id = ${newsletterId}
  `;
  const newsletter = rows[0];
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
    await sql`
      INSERT INTO blog_posts (title, slug, content, excerpt, category, tags, author, published, published_at, meta_description)
      VALUES (
        ${newsletter.subject},
        ${finalSlug},
        ${newsletter.plain_content || newsletter.html_content},
        ${(newsletter.plain_content as string)?.slice(0, 200) || "주간 AI 브리핑"},
        '주간 AI 브리핑',
        ${["뉴스레터", "AI트렌드", "주간브리핑"]},
        'AI AppPro',
        true,
        now(),
        ${`${newsletter.subject} - AI AppPro 주간 뉴스레터`}
      )
      ON CONFLICT (slug) DO NOTHING
    `;
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
  if (!process.env.DATABASE_URL) {
    console.error("[publish] DATABASE_URL not set");
    return false;
  }

  const getlateStatus = getGetlateStatus();
  console.log(`[publish] getlate mode: ${getlateStatus.mode}`);

  if (!getlateStatus.configured) {
    console.log("[publish] GETLATE_API_KEY not set. SNS 배포 스킵.");
    return false;
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT subject, plain_content FROM newsletters WHERE id = ${newsletterId}
  `;
  const newsletter = rows[0];
  if (!newsletter) return false;

  // SNS용 짧은 요약 콘텐츠 생성 (plain_content 앞 200자)
  const summary = (newsletter.plain_content as string)?.slice(0, 200) || newsletter.subject;
  const snsContent = `[AI AppPro 주간 브리핑]\n${newsletter.subject}\n\n${summary}`;

  const result = await publishToSns({
    content: snsContent,
    blogUrl,
    publishNow: true,
  });

  if (result.mock) {
    console.log("[publish] getlate mock 모드 — SNS 배포 스킵.");
    return false;
  }

  if (result.success) {
    console.log(`[publish] SNS 배포 완료. Post ID: ${result.postId}, 계정 수: ${result.accountCount}`);
    return true;
  }

  if (result.error === 'NO_ACCOUNTS') {
    console.log("[publish] getlate에 연결된 SNS 계정 없음. getlate.dev에서 계정 연결 필요.");
  } else {
    console.error(`[publish] SNS 배포 실패: ${result.error}`);
  }
  return false;
}

// CLI entry point
if (process.argv[1]?.includes("publish")) {
  const newsletterId = process.argv[2];
  if (!newsletterId) {
    // If no ID provided, get the latest draft
    (async () => {
      if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not set");
        process.exit(1);
      }
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        SELECT id, subject, status FROM newsletters
        ORDER BY created_at DESC LIMIT 1
      `;
      if (rows.length === 0) {
        console.error("No newsletters found. Run generate first.");
        process.exit(1);
      }
      const latest = rows[0];
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
