/**
 * SNS Multi-Platform Publishing via getlate.dev API
 *
 * getlate.dev (Late) API Reference:
 * - Base URL: https://getlate.dev/api/v1
 * - Auth: Bearer token (API key)
 * - Docs: https://docs.getlate.dev
 *
 * Supported platforms: X(Twitter), LinkedIn, Threads, Instagram,
 * Facebook, TikTok, YouTube, Reddit, Pinterest, Bluesky, etc.
 */

const LATE_API_BASE = "https://getlate.dev/api/v1";
const BLOG_BASE_URL = "https://content-pipeline-sage.vercel.app";

// Platform-specific character limits (conservative estimates)
const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  threads: 500,
  linkedin: 3000,
  facebook: 2000,
  bluesky: 300,
  instagram: 2200,
};

// Default platforms to post to (configurable via env)
const DEFAULT_PLATFORMS = ["twitter", "linkedin", "threads"];

interface LateAccount {
  _id: string;
  platform: string;
  name: string;
}

interface LatePlatformEntry {
  platform: string;
  accountId: string;
  customContent?: string;
}

interface LatePostResponse {
  post: {
    _id: string;
    status: string;
    platforms: Array<{
      platform: string;
      status: string;
      platformPostUrl?: string;
    }>;
  };
  message: string;
}

interface SnsContent {
  platform: string;
  text: string;
}

function getApiKey(): string | null {
  return process.env.GETLATE_API_KEY || null;
}

async function lateRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GETLATE_API_KEY not set");

  const res = await fetch(`${LATE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Late API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Fetch connected accounts from Late API.
 */
export async function getConnectedAccounts(): Promise<LateAccount[]> {
  const data = (await lateRequest("GET", "/accounts")) as {
    accounts: LateAccount[];
  };
  return data.accounts || [];
}

/**
 * Convert blog post content to platform-optimized SNS posts.
 */
export function convertToSnsContent(
  title: string,
  excerpt: string,
  slug: string,
  tags: string[],
  platforms: string[]
): SnsContent[] {
  const postUrl = `${BLOG_BASE_URL}/posts/${slug}`;
  const hashtags = tags
    .slice(0, 5)
    .map((t) => `#${t.replace(/\s+/g, "")}`)
    .join(" ");

  return platforms.map((platform) => {
    const limit = PLATFORM_LIMITS[platform] || 500;

    if (platform === "twitter" || platform === "bluesky") {
      // Short-form: title + link + hashtags (fit within limit)
      const base = `${title}\n\n${postUrl}`;
      const withTags = `${base}\n\n${hashtags}`;
      return {
        platform,
        text: withTags.length <= limit ? withTags : base,
      };
    }

    if (platform === "linkedin") {
      // Long-form: excerpt + link + hashtags
      return {
        platform,
        text: `${title}\n\n${excerpt}\n\n${postUrl}\n\n${hashtags}`,
      };
    }

    if (platform === "threads" || platform === "instagram") {
      // Medium-form: title + excerpt + hashtags
      const base = `${title}\n\n${excerpt}\n\n${postUrl}`;
      const withTags = `${base}\n\n${hashtags}`;
      return {
        platform,
        text: withTags.length <= limit ? withTags : base,
      };
    }

    // Default: title + excerpt + link
    return {
      platform,
      text: `${title}\n\n${excerpt}\n\n${postUrl}\n\n${hashtags}`,
    };
  });
}

/**
 * Publish content to multiple platforms via Late API.
 */
export async function publishToSns(opts: {
  title: string;
  excerpt: string;
  slug: string;
  tags: string[];
  platforms?: string[];
  publishNow?: boolean;
  scheduledFor?: string; // ISO 8601
}): Promise<LatePostResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("[publish-sns] GETLATE_API_KEY가 설정되지 않았습니다.");
    console.error(
      "[publish-sns] .env.local에 GETLATE_API_KEY=... 형태로 추가하세요."
    );
    console.error(
      "[publish-sns] API 키 발급: https://getlate.dev 대시보드 > API Keys"
    );
    return null;
  }

  const targetPlatforms = opts.platforms || DEFAULT_PLATFORMS;

  // 1. Fetch connected accounts
  console.log("[publish-sns] 연결된 계정 조회 중...");
  let accounts: LateAccount[];
  try {
    accounts = await getConnectedAccounts();
  } catch (err) {
    console.error("[publish-sns] 계정 조회 실패:", err);
    return null;
  }

  if (accounts.length === 0) {
    console.error(
      "[publish-sns] 연결된 SNS 계정이 없습니다. getlate.dev 대시보드에서 계정을 연결하세요."
    );
    return null;
  }

  console.log(
    `[publish-sns] 연결된 계정: ${accounts.map((a) => `${a.platform}(${a.name})`).join(", ")}`
  );

  // 2. Match target platforms to connected accounts
  const platformEntries: LatePlatformEntry[] = [];
  const snsContents = convertToSnsContent(
    opts.title,
    opts.excerpt,
    opts.slug,
    opts.tags,
    targetPlatforms
  );

  for (const content of snsContents) {
    const account = accounts.find((a) => a.platform === content.platform);
    if (!account) {
      console.warn(
        `[publish-sns] ${content.platform} 계정이 연결되어 있지 않습니다. 건너뜁니다.`
      );
      continue;
    }
    platformEntries.push({
      platform: content.platform,
      accountId: account._id,
      customContent: content.text,
    });
  }

  if (platformEntries.length === 0) {
    console.error(
      "[publish-sns] 게시 가능한 플랫폼이 없습니다."
    );
    return null;
  }

  // 3. Create post via Late API
  const postBody: Record<string, unknown> = {
    content: snsContents[0]?.text || opts.title,
    platforms: platformEntries,
    tags: opts.tags,
    hashtags: opts.tags.slice(0, 5).map((t) => t.replace(/\s+/g, "")),
  };

  if (opts.publishNow) {
    postBody.publishNow = true;
  } else if (opts.scheduledFor) {
    postBody.scheduledFor = opts.scheduledFor;
  } else {
    // Default: publish immediately
    postBody.publishNow = true;
  }

  console.log(
    `[publish-sns] ${platformEntries.length}개 플랫폼에 게시 중: ${platformEntries.map((p) => p.platform).join(", ")}`
  );

  try {
    const response = (await lateRequest(
      "POST",
      "/posts",
      postBody
    )) as LatePostResponse;

    console.log(`[publish-sns] 게시 완료: ${response.message}`);
    console.log(`[publish-sns] Post ID: ${response.post._id}`);

    for (const p of response.post.platforms) {
      const url = p.platformPostUrl || "(pending)";
      console.log(`[publish-sns]   ${p.platform}: ${p.status} — ${url}`);
    }

    return response;
  } catch (err) {
    console.error("[publish-sns] Late API 게시 오류:", err);
    return null;
  }
}

// CLI entry point
if (process.argv[1]?.includes("publish-sns")) {
  const jsonArg = process.argv[2];
  if (!jsonArg) {
    console.error(
      'Usage: npx tsx src/pipeline/publish-sns.ts \'{"title":"...", "excerpt":"...", "slug":"...", "tags":[...]}\''
    );
    console.error(
      "일반적으로 run-blog-pipeline.ts를 통해 자동 실행됩니다."
    );
    process.exit(1);
  }

  try {
    const opts = JSON.parse(jsonArg);
    publishToSns(opts).then((res) => {
      if (res) {
        console.log("\nSNS 게시 완료.");
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.error("SNS 게시 실패.");
        process.exit(1);
      }
    });
  } catch {
    console.error("JSON 파싱 오류. 올바른 JSON 형식으로 입력하세요.");
    process.exit(1);
  }
}
