/**
 * Stibee API Client
 *
 * Stibee v2 API 기반 뉴스레터 발송 + 구독자 관리 클라이언트.
 * STIBEE_API_KEY 미설정 시 mock 모드로 동작한다.
 *
 * Base URL: https://api.stibee.com/v2
 * Auth: AccessToken 헤더
 * Docs: https://stibeev2.apidocumentation.com/
 */

const BASE_URL = 'https://api.stibee.com/v2';

function getApiKey(): string | null {
  return process.env.STIBEE_API_KEY || null;
}

function isMockMode(): boolean {
  return !getApiKey();
}

async function stibeeRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(`[stibee:mock] ${method} ${path} — API키 없음, mock 모드`);
    return { ok: false, data: null, error: 'MOCK_MODE' };
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        AccessToken: apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[stibee] ${method} ${path} failed: ${response.status} ${errorText}`);
      return { ok: false, data: null, error: `${response.status}: ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stibee] ${method} ${path} error:`, message);
    return { ok: false, data: null, error: message };
  }
}

// ============================================================
// Auth
// ============================================================

/** API키 유효성 검증 */
export async function checkAuth(): Promise<boolean> {
  if (isMockMode()) {
    console.log('[stibee:mock] checkAuth — mock 모드, 스킵');
    return false;
  }
  const result = await stibeeRequest('GET', '/auth-check');
  if (result.ok) {
    console.log('[stibee] API 인증 성공');
  }
  return result.ok;
}

// ============================================================
// Email (뉴스레터) — Pro/Enterprise 플랜 필요
// ============================================================

interface CreateEmailParams {
  listId: number;
  subject: string;
  senderName?: string;
  senderEmail?: string;
}

interface EmailContentParams {
  htmlContent: string;
  plainContent?: string;
}

interface StibeeEmail {
  id: number;
  subject: string;
  status: string;
}

/** 이메일(뉴스레터) 생성 */
export async function createEmail(params: CreateEmailParams): Promise<StibeeEmail | null> {
  if (isMockMode()) {
    console.log(`[stibee:mock] createEmail — subject: "${params.subject}"`);
    return { id: 99999, subject: params.subject, status: 'mock' };
  }

  const result = await stibeeRequest<{ data: StibeeEmail }>('POST', '/emails', {
    listId: params.listId,
    subject: params.subject,
    senderName: params.senderName || 'AI AppPro',
    senderEmail: params.senderEmail,
  });

  return result.data?.data ?? null;
}

/** 이메일 콘텐츠 설정 */
export async function setEmailContent(
  emailId: number,
  content: EmailContentParams,
): Promise<boolean> {
  if (isMockMode()) {
    console.log(`[stibee:mock] setEmailContent — emailId: ${emailId}, html length: ${content.htmlContent.length}`);
    return true;
  }

  const result = await stibeeRequest('POST', `/emails/${emailId}/content`, {
    html: content.htmlContent,
    plainText: content.plainContent || '',
  });

  return result.ok;
}

/** 이메일 목록 조회 */
export async function listEmails(): Promise<StibeeEmail[]> {
  if (isMockMode()) {
    console.log('[stibee:mock] listEmails — 빈 배열 반환');
    return [];
  }

  const result = await stibeeRequest<{ data: StibeeEmail[] }>('GET', '/emails');
  return result.data?.data ?? [];
}

/** 이메일 상세 조회 */
export async function getEmail(emailId: number): Promise<StibeeEmail | null> {
  if (isMockMode()) {
    return null;
  }

  const result = await stibeeRequest<{ data: StibeeEmail }>('GET', `/emails/${emailId}`);
  return result.data?.data ?? null;
}

/** 이메일 삭제 */
export async function deleteEmail(emailId: number): Promise<boolean> {
  if (isMockMode()) {
    console.log(`[stibee:mock] deleteEmail — emailId: ${emailId}`);
    return true;
  }

  const result = await stibeeRequest('DELETE', `/emails/${emailId}`);
  return result.ok;
}

// ============================================================
// Subscriber (구독자) 관리
// ============================================================

interface AddSubscriberParams {
  listId: number;
  subscribers: Array<{
    email: string;
    name?: string;
    [key: string]: unknown;
  }>;
  groupIds?: number[];
}

interface SubscriberResult {
  success: string[];
  fail: Array<{ email: string; reason: string }>;
  update: string[];
}

/** 구독자 추가 (batch) */
export async function addSubscribers(params: AddSubscriberParams): Promise<SubscriberResult> {
  const defaultResult: SubscriberResult = { success: [], fail: [], update: [] };

  if (isMockMode()) {
    const emails = params.subscribers.map((s) => s.email);
    console.log(`[stibee:mock] addSubscribers — ${emails.length}명 추가 요청 (mock)`);
    return { ...defaultResult, success: emails };
  }

  const result = await stibeeRequest<{ data: SubscriberResult }>(
    'POST',
    `/lists/${params.listId}/subscribers`,
    {
      eventOccurredBy: 'MANUAL',
      confirmEmailYN: 'N',
      subscribers: params.subscribers,
      groupIds: params.groupIds || [],
    },
  );

  return result.data?.data ?? defaultResult;
}

/** 구독자 삭제 */
export async function deleteSubscribers(
  listId: number,
  emails: string[],
): Promise<boolean> {
  if (isMockMode()) {
    console.log(`[stibee:mock] deleteSubscribers — ${emails.length}명 삭제 요청 (mock)`);
    return true;
  }

  const result = await stibeeRequest('DELETE', `/lists/${listId}/subscribers`, emails);
  return result.ok;
}

// ============================================================
// 뉴스레터 발송 통합 함수
// ============================================================

interface SendNewsletterParams {
  listId: number;
  subject: string;
  htmlContent: string;
  plainContent?: string;
  senderName?: string;
  senderEmail?: string;
}

interface SendNewsletterResult {
  success: boolean;
  emailId: number | null;
  mock: boolean;
  error: string | null;
}

/**
 * 뉴스레터 발송 통합 함수
 *
 * 1. 이메일 생성 (POST /emails)
 * 2. 콘텐츠 설정 (POST /emails/{id}/content)
 * 3. 결과 반환 (발송은 Stibee 대시보드에서 수동 또는 자동 이메일 트리거)
 *
 * Note: Stibee v2 API에서 이메일 즉시 발송은 자동 이메일 API를 통해 처리.
 * 일반 이메일은 생성+콘텐츠 설정 후 Stibee 대시보드에서 발송하거나,
 * 자동 이메일로 설정하여 API 트리거 가능.
 */
export async function sendNewsletter(params: SendNewsletterParams): Promise<SendNewsletterResult> {
  if (isMockMode()) {
    console.log('[stibee:mock] sendNewsletter — mock 모드');
    console.log(`  Subject: ${params.subject}`);
    console.log(`  HTML length: ${params.htmlContent.length}`);
    console.log('  API키를 설정하면 실제 발송이 가능합니다.');
    return { success: false, emailId: null, mock: true, error: 'MOCK_MODE' };
  }

  // Step 1: Create email
  const email = await createEmail({
    listId: params.listId,
    subject: params.subject,
    senderName: params.senderName,
    senderEmail: params.senderEmail,
  });

  if (!email) {
    return { success: false, emailId: null, mock: false, error: 'Failed to create email' };
  }

  // Step 2: Set content
  const contentSet = await setEmailContent(email.id, {
    htmlContent: params.htmlContent,
    plainContent: params.plainContent,
  });

  if (!contentSet) {
    return { success: false, emailId: email.id, mock: false, error: 'Failed to set email content' };
  }

  console.log(`[stibee] 이메일 생성 완료. ID: ${email.id}, Subject: "${params.subject}"`);
  console.log('[stibee] Stibee 대시보드에서 발송하거나 자동 이메일 트리거를 설정하세요.');

  return { success: true, emailId: email.id, mock: false, error: null };
}

// ============================================================
// 자동 이메일 트리거 (Automation)
// ============================================================

interface TriggerAutomationParams {
  automationEmailId: number;
  subscriber: {
    email: string;
    name?: string;
    [key: string]: unknown;
  };
}

/**
 * 자동 이메일 트리거
 *
 * 자동 이메일이 Stibee에서 미리 설정되어 있어야 함.
 * API로 구독자 정보를 전달하면 해당 구독자에게 자동 발송.
 * Rate limit: 1초당 3회, 1회당 256KB
 */
export async function triggerAutomationEmail(params: TriggerAutomationParams): Promise<boolean> {
  if (isMockMode()) {
    console.log(`[stibee:mock] triggerAutomationEmail — emailId: ${params.automationEmailId}, to: ${params.subscriber.email}`);
    return false;
  }

  const result = await stibeeRequest(
    'POST',
    `/auto-emails/${params.automationEmailId}/triggering`,
    {
      subscriber: params.subscriber,
    },
  );

  return result.ok;
}

// ============================================================
// Status helpers
// ============================================================

/** Stibee 연동 상태 요약 */
export function getStibeeStatus(): {
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
