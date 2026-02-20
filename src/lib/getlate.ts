/**
 * getlate.dev API Client
 *
 * Late는 13개 SNS 플랫폼(Twitter/X, Instagram, LinkedIn, Facebook, TikTok,
 * Threads, Reddit, Pinterest, Bluesky, Google Business, Telegram, Snapchat, YouTube)에
 * 단일 API로 콘텐츠를 배포하는 서비스.
 *
 * Base URL: https://getlate.dev/api/v1
 * Auth: Bearer {GETLATE_API_KEY}
 * Docs: https://docs.getlate.dev
 */

const BASE_URL = 'https://getlate.dev/api/v1';

function getApiKey(): string | null {
  return process.env.GETLATE_API_KEY || null;
}

function isMockMode(): boolean {
  return !getApiKey();
}

async function getlateRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[getlate:mock] ${method} ${path} — API키 없음, mock 모드`);
    return { ok: false, data: null, error: 'MOCK_MODE' };
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getlate] ${method} ${path} failed: ${response.status} ${errorText}`);
      return { ok: false, data: null, error: `${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[getlate] ${method} ${path} error:`, message);
    return { ok: false, data: null, error: message };
  }
}

// ============================================================
// Accounts (연결된 SNS 계정 조회)
// ============================================================

export interface GetlateAccount {
  accountId: string;
  platform: string;
  name: string;
  username?: string;
  profileImageUrl?: string;
}

/** 연결된 SNS 계정 목록 조회 */
export async function listAccounts(): Promise<GetlateAccount[]> {
  if (isMockMode()) {
    console.log('[getlate:mock] listAccounts — GETLATE_API_KEY 미설정, mock 모드');
    return [];
  }

  const result = await getlateRequest<{ data: GetlateAccount[] }>('GET', '/accounts');
  return result.data?.data ?? [];
}

// ============================================================
// Posts (콘텐츠 발행/예약)
// ============================================================

export interface GetlatePlatformTarget {
  platform: string;
  accountId: string;
  /** 플랫폼별 커스텀 콘텐츠 (없으면 content 사용) */
  customContent?: string;
}

export interface CreatePostParams {
  /** 발행할 콘텐츠 텍스트 */
  content: string;
  /** 대상 플랫폼 및 계정 목록 */
  platforms: GetlatePlatformTarget[];
  /** 즉시 발행 여부 (true면 scheduledFor 무시) */
  publishNow?: boolean;
  /** 예약 발행 시각 (ISO 8601, e.g. "2024-01-16T12:00:00") */
  scheduledFor?: string;
  /** 타임존 (e.g. "Asia/Seoul") */
  timezone?: string;
  /** 이미지/미디어 URL 목록 */
  mediaUrls?: string[];
}

export interface GetlatePost {
  id: string;
  content: string;
  status: string;
  scheduledFor?: string;
  platforms: GetlatePlatformTarget[];
  createdAt: string;
}

export interface CreatePostResult {
  success: boolean;
  postId: string | null;
  mock: boolean;
  error: string | null;
}

/** 콘텐츠 발행 (즉시 또는 예약) */
export async function createPost(params: CreatePostParams): Promise<CreatePostResult> {
  if (isMockMode()) {
    console.log('[getlate:mock] createPost — mock 모드');
    console.log(`  Content (앞 100자): ${params.content.slice(0, 100)}...`);
    console.log(`  Platforms: ${params.platforms.map((p) => p.platform).join(', ')}`);
    console.log(`  PublishNow: ${params.publishNow ?? false}`);
    console.log('  GETLATE_API_KEY를 설정하면 실제 발행이 가능합니다.');
    return { success: false, postId: null, mock: true, error: 'MOCK_MODE' };
  }

  const body: Record<string, unknown> = {
    content: params.content,
    platforms: params.platforms,
  };

  if (params.publishNow) {
    body.publishNow = true;
  } else if (params.scheduledFor) {
    body.scheduledFor = params.scheduledFor;
    body.timezone = params.timezone || 'Asia/Seoul';
  }

  if (params.mediaUrls && params.mediaUrls.length > 0) {
    body.mediaUrls = params.mediaUrls;
  }

  const result = await getlateRequest<{ data: GetlatePost }>('POST', '/posts', body);

  if (result.ok && result.data?.data?.id) {
    console.log(`[getlate] 포스트 생성 완료. ID: ${result.data.data.id}`);
    return { success: true, postId: result.data.data.id, mock: false, error: null };
  }

  return { success: false, postId: null, mock: false, error: result.error };
}

// ============================================================
// SNS 뉴스레터 배포 통합 함수
// ============================================================

export interface PublishToSnsParams {
  /** 발행할 콘텐츠 (뉴스레터 요약본 또는 블로그 발행 알림) */
  content: string;
  /** 블로그 링크 (SNS에 첨부할 URL) */
  blogUrl?: string;
  /** 대상 계정 목록 (없으면 연결된 모든 계정) */
  targetAccountIds?: string[];
  /** 즉시 발행 여부 */
  publishNow?: boolean;
  /** 예약 시각 (ISO 8601) */
  scheduledFor?: string;
}

export interface PublishToSnsResult {
  success: boolean;
  postId: string | null;
  mock: boolean;
  accountCount: number;
  error: string | null;
}

/**
 * SNS 멀티플랫폼 배포 통합 함수
 *
 * 뉴스레터 발행 후 SNS 채널에 자동으로 알림/홍보 포스팅.
 * 연결된 계정을 자동으로 조회하여 모든 플랫폼에 배포.
 */
export async function publishToSns(params: PublishToSnsParams): Promise<PublishToSnsResult> {
  if (isMockMode()) {
    console.log('[getlate:mock] publishToSns — mock 모드');
    return { success: false, postId: null, mock: true, accountCount: 0, error: 'MOCK_MODE' };
  }

  // 1. 연결된 계정 조회
  const accounts = await listAccounts();
  if (accounts.length === 0) {
    console.warn('[getlate] 연결된 SNS 계정이 없습니다. getlate.dev에서 계정을 연결하세요.');
    return { success: false, postId: null, mock: false, accountCount: 0, error: 'NO_ACCOUNTS' };
  }

  // 2. 대상 계정 필터링
  const targetAccounts = params.targetAccountIds
    ? accounts.filter((a) => params.targetAccountIds!.includes(a.accountId))
    : accounts;

  if (targetAccounts.length === 0) {
    return { success: false, postId: null, mock: false, accountCount: 0, error: 'NO_TARGET_ACCOUNTS' };
  }

  // 3. 콘텐츠 구성 (블로그 URL 첨부)
  const content = params.blogUrl
    ? `${params.content}\n\n${params.blogUrl}`
    : params.content;

  // 4. 플랫폼 타겟 구성
  const platforms: GetlatePlatformTarget[] = targetAccounts.map((account) => ({
    platform: account.platform,
    accountId: account.accountId,
  }));

  console.log(`[getlate] ${platforms.length}개 계정에 배포 시도: ${platforms.map((p) => p.platform).join(', ')}`);

  // 5. 포스트 생성
  const result = await createPost({
    content,
    platforms,
    publishNow: params.publishNow ?? true,
    scheduledFor: params.scheduledFor,
  });

  return {
    ...result,
    accountCount: platforms.length,
  };
}

// ============================================================
// Status helpers
// ============================================================

/** getlate 연동 상태 요약 */
export function getGetlateStatus(): {
  configured: boolean;
  mode: 'live' | 'mock';
  apiKeySet: boolean;
} {
  const apiKeySet = !!getApiKey();
  return {
    configured: apiKeySet,
    mode: apiKeySet ? 'live' : 'mock',
    apiKeySet,
  };
}
