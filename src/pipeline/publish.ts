import { neon } from "@neondatabase/serverless";

interface StibeeEmailPayload {
  subscriber_list_id: number;
  subject: string;
  html_content: string;
  plain_content?: string;
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

  const newsletter = rows[0];
  if (!newsletter) {
    console.error(`[publish] Newsletter not found: ${newsletterId}`);
    return false;
  }

  if (newsletter.status === "sent") {
    console.log(`[publish] Newsletter already sent: ${newsletterId}`);
    return true;
  }

  // 2. Check Stibee API key
  if (!process.env.STIBEE_API_KEY) {
    console.log("[publish] STIBEE_API_KEY not set. Skipping actual send.");
    console.log("[publish] Newsletter ready for manual send:");
    console.log(`  Subject: ${newsletter.subject}`);
    console.log(`  Status: ${newsletter.status}`);
    console.log("[publish] Set STIBEE_API_KEY to enable automatic sending.");

    // Mark as ready
    await sql`
      UPDATE newsletters SET status = 'ready', sent_at = now()
      WHERE id = ${newsletterId}
    `;
    return false;
  }

  // 3. Send via Stibee API
  try {
    console.log(`[publish] Sending newsletter via Stibee: "${newsletter.subject}"`);

    const response = await fetch("https://api.stibee.com/v1/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        AccessToken: process.env.STIBEE_API_KEY,
      },
      body: JSON.stringify({
        subject: newsletter.subject,
        html_content: newsletter.html_content,
        plain_content: newsletter.plain_content || "",
      } satisfies Omit<StibeeEmailPayload, "subscriber_list_id">),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[publish] Stibee API error: ${response.status} ${errorText}`);
      return false;
    }

    const result = await response.json();
    const emailId = result?.data?.id || result?.id || "unknown";

    // 4. Update newsletter status
    await sql`
      UPDATE newsletters SET status = 'sent', stibee_email_id = ${String(emailId)}, sent_at = now()
      WHERE id = ${newsletterId}
    `;

    console.log(`[publish] Newsletter sent successfully. Stibee ID: ${emailId}`);
    return true;
  } catch (err) {
    console.error("[publish] Error sending via Stibee:", err);
    return false;
  }
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

// CLI entry point
if (process.argv[1]?.includes("publish")) {
  const newsletterId = process.argv[2];
  if (!newsletterId) {
    console.error("Usage: tsx src/pipeline/publish.ts <newsletter-id>");
    process.exit(1);
  }
  (async () => {
    await sendViaStibee(newsletterId);
    await publishToBlog(newsletterId);
    console.log("[publish] Done.");
  })();
}
