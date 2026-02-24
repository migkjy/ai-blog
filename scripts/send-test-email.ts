/**
 * PLF 이메일 테스트 발송 스크립트
 *
 * 사용법:
 *   BREVO_API_KEY=... BREVO_LIST_ID_TEST=... tsx scripts/send-test-email.ts [email-id]
 *
 * email-id:
 *   01  →  plf-email-01-value.html   (W1 화요일 — 가치 제공)
 *   02  →  plf-email-02-problem.html (W2 월요일 — 문제 인식)
 *   03  →  plf-email-03-solution.html (W2 금요일 — 해결책 + 예고)
 *
 * 주의:
 *   - BREVO_LIST_ID_TEST (테스트 그룹) 대상으로만 발송
 *   - BREVO_LIST_ID (전체 구독자) 사용 절대 금지
 *   - CEO 승인 전 실제 전체 리스트 발송 금지
 */

import fs from "fs";
import path from "path";
import { BrevoClient } from "@getbrevo/brevo";

// ── 설정 ────────────────────────────────────────────────────────────────────

const EMAIL_MAP: Record<string, { file: string; subject: string }> = {
  "01": {
    file: "plf-email-01-value.html",
    subject: "다음 주, AI로 달라지는 마케팅을 먼저 보여드립니다",
  },
  "02": {
    file: "plf-email-02-problem.html",
    subject: "런칭이 실패하는 이유를 아시나요?",
  },
  "03": {
    file: "plf-email-03-solution.html",
    subject: "첫 주 100만원 만든 방법 + 곧 오픈합니다",
  },
};

const EMAILS_DIR = path.join(
  "/Users/nbs22/(Claude)/(claude).projects/business-builder/projects/content-pipeline/emails"
);

// ── 환경 변수 검사 ────────────────────────────────────────────────────────────

function checkEnv(): { apiKey: string; listId: number } {
  const apiKey = process.env.BREVO_API_KEY;
  const listIdRaw = process.env.BREVO_LIST_ID_TEST;

  if (!apiKey) {
    console.error("[test-send] BREVO_API_KEY 환경 변수가 필요합니다.");
    process.exit(1);
  }
  if (!listIdRaw || parseInt(listIdRaw, 10) <= 0) {
    console.error(
      "[test-send] BREVO_LIST_ID_TEST 환경 변수가 필요합니다 (테스트 그룹 ID)."
    );
    console.error(
      "            Brevo 대시보드 > Contacts > Lists 에서 테스트 리스트 ID를 확인하세요."
    );
    process.exit(1);
  }

  // 전체 리스트와 동일한 ID 사용 방지
  const testListId = parseInt(listIdRaw, 10);
  const fullListId = parseInt(process.env.BREVO_LIST_ID || "0", 10);
  if (fullListId > 0 && testListId === fullListId) {
    console.error(
      "[test-send] BREVO_LIST_ID_TEST 가 BREVO_LIST_ID (전체 구독자 리스트)와 동일합니다."
    );
    console.error(
      "            전체 리스트로 테스트 발송은 허용되지 않습니다. 별도 테스트 리스트 ID를 사용하세요."
    );
    process.exit(1);
  }

  return { apiKey, listId: testListId };
}

// ── 이메일 발송 ───────────────────────────────────────────────────────────────

async function sendTestEmail(emailId: string): Promise<void> {
  const target = EMAIL_MAP[emailId];
  if (!target) {
    console.error(
      `[test-send] 알 수 없는 이메일 ID: "${emailId}". 사용 가능: ${Object.keys(EMAIL_MAP).join(", ")}`
    );
    process.exit(1);
  }

  const { apiKey, listId } = checkEnv();

  const htmlPath = path.join(EMAILS_DIR, target.file);
  if (!fs.existsSync(htmlPath)) {
    console.error(`[test-send] HTML 파일을 찾을 수 없습니다: ${htmlPath}`);
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(htmlPath, "utf-8");

  const senderName = process.env.BREVO_SENDER_NAME || "AI AppPro";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@apppro.kr";
  const campaignName = `[TEST] PLF ${emailId} — ${new Date().toISOString().split("T")[0]}`;

  console.log(`[test-send] 이메일 ID: ${emailId}`);
  console.log(`[test-send] 제목: ${target.subject}`);
  console.log(`[test-send] 파일: ${target.file}`);
  console.log(`[test-send] 테스트 리스트 ID: ${listId}`);
  console.log(`[test-send] 발신자: ${senderName} <${senderEmail}>`);
  console.log("");

  const client = new BrevoClient({ apiKey });

  try {
    // 캠페인 생성
    const createResponse = await client.emailCampaigns.createEmailCampaign({
      name: campaignName,
      subject: `[TEST] ${target.subject}`,
      htmlContent,
      sender: { name: senderName, email: senderEmail },
      recipients: { listIds: [listId] },
    });

    const campaignId = (createResponse as unknown as { id?: number }).id;
    if (!campaignId) {
      console.error("[test-send] 캠페인 생성 실패: ID 없음");
      process.exit(1);
    }

    console.log(`[test-send] 캠페인 생성 완료 (ID: ${campaignId}). 발송 중...`);

    // 즉시 발송
    await client.emailCampaigns.sendEmailCampaignNow({ campaignId });

    console.log(`[test-send] 발송 완료. Campaign ID: ${campaignId}`);
    console.log(`[test-send] Brevo 대시보드에서 발송 결과를 확인하세요.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[test-send] 오류: ${message}`);
    process.exit(1);
  }
}

// ── 진입점 ───────────────────────────────────────────────────────────────────

const emailId = process.argv[2];
if (!emailId) {
  console.log("사용법: tsx scripts/send-test-email.ts [email-id]");
  console.log("");
  console.log("이메일 목록:");
  for (const [id, info] of Object.entries(EMAIL_MAP)) {
    console.log(`  ${id}  →  ${info.file}`);
    console.log(`       제목: ${info.subject}`);
  }
  console.log("");
  console.log("필수 환경 변수:");
  console.log("  BREVO_API_KEY        Brevo API 키");
  console.log("  BREVO_LIST_ID_TEST   테스트 리스트 ID (전체 구독자 리스트와 다른 ID)");
  process.exit(0);
}

sendTestEmail(emailId);
