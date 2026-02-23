"use server";

import { createClient } from "@libsql/client";

interface SubscribeResult {
  success: boolean;
  message: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeAction(
  _prevState: SubscribeResult | null,
  formData: FormData
): Promise<SubscribeResult> {
  const email = formData.get("email")?.toString().trim().toLowerCase();

  if (!email) {
    return { success: false, message: "이메일을 입력해주세요." };
  }

  if (!isValidEmail(email)) {
    return { success: false, message: "올바른 이메일 형식을 입력해주세요." };
  }

  try {
    const client = createClient({
      url: process.env.TURSO_DB_URL!,
      authToken: process.env.TURSO_DB_TOKEN!,
    });
    await client.execute({
      sql: "INSERT INTO subscribers (email, source) VALUES (?, 'blog') ON CONFLICT (email) DO NOTHING",
      args: [email],
    });
    return { success: true, message: "구독 완료! 매주 AI 트렌드를 보내드릴게요." };
  } catch {
    return { success: false, message: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
}
