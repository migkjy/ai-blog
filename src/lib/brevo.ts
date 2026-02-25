/**
 * Brevo (SendinBlue) API Client
 *
 * Brevo는 이메일 마케팅 플랫폼. SDK @getbrevo/brevo 사용.
 * BREVO_API_KEY 미설정 시 mock 모드로 동작 (에러 없이 console.log만 출력).
 *
 * Docs: https://developers.brevo.com/reference
 * SDK: @getbrevo/brevo (v3+ — BrevoClient 기반, 클래스 인스턴스 방식 아님)
 */

import { BrevoClient } from "@getbrevo/brevo";

function getApiKey(): string | null {
  return process.env.BREVO_API_KEY || null;
}

function isMockMode(): boolean {
  return !getApiKey();
}

function getClient(): BrevoClient {
  return new BrevoClient({ apiKey: getApiKey()! });
}

// ============================================================
// Contacts
// ============================================================

export interface AddContactResult {
  success: boolean;
  mock: boolean;
  id?: number;
  error?: string;
}

/**
 * 구독자 추가
 * @param email 이메일 주소
 * @param name 이름 (선택)
 * @param listIds 추가할 Brevo 리스트 ID 목록 (선택, 기본: BREVO_LIST_ID 환경변수)
 */
export async function addContact(
  email: string,
  name?: string,
  listIds?: number[]
): Promise<AddContactResult> {
  if (isMockMode()) {
    console.log(`[brevo:mock] addContact — API키 없음, mock 모드`);
    console.log(`  email: ${email}, name: ${name || "(없음)"}`);
    console.log("  BREVO_API_KEY를 설정하면 실제 Brevo에 추가됩니다.");
    return { success: false, mock: true };
  }

  const defaultListId = parseInt(process.env.BREVO_LIST_ID || "0", 10);
  const targetListIds = listIds ?? (defaultListId > 0 ? [defaultListId] : []);

  try {
    const client = getClient();
    const attributes: Record<string, string | number | boolean | string[]> = {};
    if (name) {
      attributes["FIRSTNAME"] = name;
    }

    const response = await client.contacts.createContact({
      email,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      listIds: targetListIds.length > 0 ? targetListIds : undefined,
      updateEnabled: true,
    });

    const id = (response as unknown as { id?: number }).id;
    console.log(`[brevo] 구독자 추가 완료: ${email} (id: ${id ?? "기존"})`);
    return { success: true, mock: false, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // 이미 존재하는 연락처(409)는 성공으로 처리
    if (message.includes("409") || message.toLowerCase().includes("already exist")) {
      console.log(`[brevo] 구독자 이미 존재: ${email}`);
      return { success: true, mock: false };
    }
    console.error(`[brevo] addContact 오류: ${message}`);
    return { success: false, mock: false, error: message };
  }
}

// ============================================================
// Lists
// ============================================================

export interface CreateListResult {
  success: boolean;
  mock: boolean;
  id?: number;
  error?: string;
}

/**
 * Brevo 리스트 생성
 * @param name 리스트 이름
 */
export async function createList(name: string): Promise<CreateListResult> {
  if (isMockMode()) {
    console.log(`[brevo:mock] createList("${name}") — mock 모드`);
    return { success: false, mock: true };
  }

  try {
    const client = getClient();
    const response = await client.contacts.createList({
      name,
      folderId: 1,
    });

    const id = (response as unknown as { id?: number }).id;
    console.log(`[brevo] 리스트 생성 완료: "${name}" (id: ${id})`);
    return { success: true, mock: false, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[brevo] createList 오류: ${message}`);
    return { success: false, mock: false, error: message };
  }
}

// ============================================================
// Campaigns
// ============================================================

export interface SendCampaignResult {
  success: boolean;
  mock: boolean;
  campaignId?: number;
  error?: string;
}

/**
 * 이메일 캠페인 생성 + 즉시 발송
 * @param listId 발송 대상 리스트 ID
 * @param subject 이메일 제목
 * @param htmlContent HTML 본문
 */
export async function sendCampaign(
  listId: number,
  subject: string,
  htmlContent: string
): Promise<SendCampaignResult> {
  if (isMockMode()) {
    console.log(`[brevo:mock] sendCampaign — mock 모드`);
    console.log(`  listId: ${listId}`);
    console.log(`  subject: ${subject}`);
    console.log(`  htmlContent: (${htmlContent.length}자)`);
    console.log("  BREVO_API_KEY를 설정하면 실제 캠페인을 발송합니다.");
    return { success: false, mock: true };
  }

  try {
    const client = getClient();
    const senderName = process.env.BREVO_SENDER_NAME || "AI AppPro";
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@apppro.kr";
    const campaignName = `[AI AppPro] ${subject} — ${new Date().toISOString().split("T")[0]}`;

    // 캠페인 생성
    const createResponse = await client.emailCampaigns.createEmailCampaign({
      name: campaignName,
      subject,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      recipients: { listIds: [listId] },
    });

    const campaignId = (createResponse as unknown as { id?: number }).id;
    if (!campaignId) {
      return { success: false, mock: false, error: "캠페인 ID 없음" };
    }
    console.log(`[brevo] 캠페인 생성 완료 (id: ${campaignId}). 발송 중...`);

    // 즉시 발송
    await client.emailCampaigns.sendEmailCampaignNow({ campaignId });
    console.log(`[brevo] 캠페인 발송 완료. Campaign ID: ${campaignId}`);
    return { success: true, mock: false, campaignId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[brevo] sendCampaign 오류: ${message}`);
    return { success: false, mock: false, error: message };
  }
}

// ============================================================
// Status
// ============================================================

export interface BrevoStatus {
  configured: boolean;
  mode: "live" | "mock";
  apiKeySet: boolean;
  listId: number;
}

/** Brevo 연동 상태 확인 */
export function getBrevoStatus(): BrevoStatus {
  const apiKeySet = !!getApiKey();
  const listId = parseInt(process.env.BREVO_LIST_ID || "0", 10);
  return {
    configured: apiKeySet,
    mode: apiKeySet ? "live" : "mock",
    apiKeySet,
    listId,
  };
}

// ============================================================
// Phase 1: 예약 발송 + 캠페인 상태 조회 (content-orchestration)
// ============================================================

export interface SendCampaignScheduledResult {
  success: boolean;
  mock: boolean;
  campaignId?: number;
  scheduledAt?: string;
  error?: string;
}

/**
 * 이메일 캠페인 생성 + 예약 발송 (scheduledAt 지원)
 *
 * 기존 sendCampaign()은 즉시 발송만 지원.
 * 이 함수는 scheduledAt이 있으면 예약, 없으면 즉시 발송.
 *
 * @param listId 발송 대상 리스트 ID
 * @param subject 이메일 제목
 * @param htmlContent HTML 본문
 * @param scheduledAt 예약 시각 (ISO 8601, 예: "2026-02-26T10:00:00+09:00"). null이면 즉시 발송.
 */
export async function sendCampaignScheduled(
  listId: number,
  subject: string,
  htmlContent: string,
  scheduledAt?: string | null,
): Promise<SendCampaignScheduledResult> {
  if (isMockMode()) {
    console.log(`[brevo:mock] sendCampaignScheduled — mock 모드`);
    console.log(`  listId: ${listId}, subject: ${subject}`);
    console.log(`  scheduledAt: ${scheduledAt ?? '즉시 발송'}`);
    return { success: false, mock: true };
  }

  try {
    const client = getClient();
    const senderName = process.env.BREVO_SENDER_NAME || "AI AppPro";
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@apppro.kr";
    const campaignName = `[AI AppPro] ${subject} — ${new Date().toISOString().split("T")[0]}`;

    // 캠페인 생성
    const createResponse = await client.emailCampaigns.createEmailCampaign({
      name: campaignName,
      subject,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      recipients: { listIds: [listId] },
      ...(scheduledAt ? { scheduledAt } : {}),
    });
    const campaignId = (createResponse as unknown as { id?: number }).id;

    if (!campaignId) {
      return { success: false, mock: false, error: "캠페인 ID 없음" };
    }

    console.log(`[brevo] 캠페인 생성 완료 (id: ${campaignId})`);

    // scheduledAt 없으면 즉시 발송
    if (!scheduledAt) {
      await client.emailCampaigns.sendEmailCampaignNow({ campaignId });
      console.log(`[brevo] 즉시 발송 완료. Campaign ID: ${campaignId}`);
    } else {
      console.log(`[brevo] 예약 발송 설정 완료: ${scheduledAt}. Campaign ID: ${campaignId}`);
    }

    return { success: true, mock: false, campaignId, scheduledAt: scheduledAt ?? undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[brevo] sendCampaignScheduled 오류: ${message}`);
    return { success: false, mock: false, error: message };
  }
}

export interface CampaignStatusResult {
  success: boolean;
  campaignId: number;
  status: string | null;
  delivered?: number;
  opens?: number;
  clicks?: number;
  bounces?: number;
  error?: string;
}

/**
 * 캠페인 상태 조회 (발송 결과 확인용).
 * Phase 1에서는 수동 확인용. Phase 2에서 자동 폴링 적용.
 */
export async function getCampaignStatus(campaignId: number): Promise<CampaignStatusResult> {
  if (isMockMode()) {
    return { success: false, campaignId, status: null, error: 'MOCK_MODE' };
  }

  try {
    const client = getClient();
    const response = await client.emailCampaigns.getEmailCampaign({ campaignId });
    const data = response as unknown as {
      status?: string;
      statistics?: {
        globalStats?: {
          delivered?: number;
          opens?: number;
          clicks?: number;
          bounces?: number;
        };
      };
    };

    return {
      success: true,
      campaignId,
      status: data.status ?? null,
      delivered: data.statistics?.globalStats?.delivered,
      opens: data.statistics?.globalStats?.opens,
      clicks: data.statistics?.globalStats?.clicks,
      bounces: data.statistics?.globalStats?.bounces,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, campaignId, status: null, error: message };
  }
}
