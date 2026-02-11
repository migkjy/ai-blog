import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { getUnusedNews, markNewsAsUsed } from "./collect";

const PROMPT_PATH = join(process.cwd(), "prompts", "newsletter.md");

function loadPromptTemplate(): string {
  try {
    return readFileSync(PROMPT_PATH, "utf-8");
  } catch {
    console.error(`[generate] Prompt template not found at ${PROMPT_PATH}`);
    return getDefaultPrompt();
  }
}

function getDefaultPrompt(): string {
  return `당신은 한국 소상공인을 위한 AI 뉴스레터 편집자입니다.
아래 AI 관련 뉴스를 바탕으로, 한국 소상공인이 이해하기 쉬운 주간 뉴스레터를 작성해주세요.

## 작성 규칙
- 한국어로 작성
- 친근하지만 전문적인 톤
- 각 뉴스를 한국 소상공인 관점에서 해석
- 실제 활용 팁 포함
- HTML 형식으로 출력`;
}

interface GeneratedNewsletter {
  subject: string;
  html_content: string;
  plain_content: string;
  news_urls: string[];
}

export async function generateNewsletter(): Promise<GeneratedNewsletter | null> {
  // 1. Get unused news
  const news = await getUnusedNews(8);
  if (news.length === 0) {
    console.log("[generate] No unused news found. Run collect first.");
    return null;
  }

  console.log(`[generate] Using ${news.length} news items for newsletter`);

  // 2. Build prompt
  const promptTemplate = loadPromptTemplate();
  const newsSection = news
    .map(
      (n, i) =>
        `### ${i + 1}. ${n.title}\n- 출처: ${n.source}\n- URL: ${n.url}\n- 요약: ${n.summary || "N/A"}`
    )
    .join("\n\n");

  const fullPrompt = `${promptTemplate}\n\n---\n\n## 이번 주 뉴스\n\n${newsSection}\n\n---\n\n위 뉴스를 바탕으로 뉴스레터를 작성해주세요. 반드시 아래 JSON 형식으로 출력하세요:\n\n\`\`\`json\n{\n  "subject": "뉴스레터 제목",\n  "html_content": "<h1>...</h1><p>...</p>",\n  "plain_content": "텍스트 버전"\n}\n\`\`\``;

  // 3. Call Claude API
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[generate] ANTHROPIC_API_KEY not set. Generating mock newsletter.");
    return generateMockNewsletter(news);
  }

  try {
    console.log("[generate] Calling Claude Sonnet API...");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: fullPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      console.error("[generate] Failed to parse JSON from Claude response");
      return generateMockNewsletter(news);
    }

    const parsed = JSON.parse(jsonMatch[1]);
    const result: GeneratedNewsletter = {
      subject: parsed.subject,
      html_content: parsed.html_content,
      plain_content: parsed.plain_content || "",
      news_urls: news.map((n) => n.url),
    };

    console.log(`[generate] Newsletter generated: "${result.subject}"`);
    return result;
  } catch (err) {
    console.error("[generate] Claude API error:", err);
    return generateMockNewsletter(news);
  }
}

function generateMockNewsletter(
  news: Awaited<ReturnType<typeof getUnusedNews>>
): GeneratedNewsletter {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const newsListHtml = news
    .map(
      (n) =>
        `<li><strong>${n.title}</strong> (${n.source})<br/><small>${n.summary?.slice(0, 100) || ""}</small></li>`
    )
    .join("\n");

  return {
    subject: `[AI AppPro] ${today} 주간 AI 브리핑`,
    html_content: `<h1>주간 AI 브리핑 - ${today}</h1>
<p>안녕하세요, AI AppPro입니다. 이번 주 주요 AI 뉴스를 정리했습니다.</p>
<h2>이번 주 주요 뉴스</h2>
<ul>${newsListHtml}</ul>
<p><em>이 뉴스레터는 ANTHROPIC_API_KEY가 설정되면 AI가 자동으로 생성합니다.</em></p>
<hr/>
<p>AI AppPro - 소상공인을 위한 AI 도구 가이드</p>`,
    plain_content: `주간 AI 브리핑 - ${today}\n\n${news.map((n) => `- ${n.title} (${n.source})`).join("\n")}`,
    news_urls: news.map((n) => n.url),
  };
}

export async function saveNewsletter(
  newsletter: GeneratedNewsletter
): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    console.error("[generate] DATABASE_URL not set");
    return null;
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    INSERT INTO newsletters (subject, html_content, plain_content, status)
    VALUES (${newsletter.subject}, ${newsletter.html_content}, ${newsletter.plain_content}, 'draft')
    RETURNING id
  `;

  const id = rows[0]?.id as string;
  console.log(`[generate] Newsletter saved with id: ${id}`);

  // Mark news as used
  await markNewsAsUsed(newsletter.news_urls);

  return id;
}

// CLI entry point
if (process.argv[1]?.includes("generate")) {
  (async () => {
    const newsletter = await generateNewsletter();
    if (newsletter) {
      await saveNewsletter(newsletter);
      console.log("[generate] Done.");
    }
  })();
}
