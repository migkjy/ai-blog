import { createClient } from "@libsql/client/web";
import { NextRequest, NextResponse } from "next/server";
import { addContact } from "@/lib/brevo";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getDb() {
  return createClient({
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_DB_TOKEN!,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const name = (body.name as string | undefined)?.trim() || undefined;
    const source = (body.source as string | undefined)?.trim() || "api";

    if (!email) {
      return NextResponse.json(
        { success: false, message: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "올바른 이메일 형식을 입력해주세요." },
        { status: 400 }
      );
    }

    // DB 중복 방지: 이미 구독 중이면 얼리 리턴
    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT email FROM subscribers WHERE email = ? LIMIT 1",
      args: [email],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: "이미 구독 중입니다.",
        alreadySubscribed: true,
      });
    }

    // DB 저장
    await db.execute({
      sql: "INSERT INTO subscribers (email, source) VALUES (?, ?) ON CONFLICT (email) DO NOTHING",
      args: [email, source],
    });

    // Brevo에 구독자 추가 (실패해도 DB 저장은 성공으로 처리)
    const brevoResult = await addContact(email, name);
    if (!brevoResult.success && !brevoResult.mock) {
      console.warn(`[subscribe] Brevo 추가 실패 (DB는 저장됨): ${brevoResult.error}`);
    }

    return NextResponse.json({
      success: true,
      message: "구독 완료! 매주 AI 트렌드를 보내드릴게요.",
    });
  } catch (err) {
    console.error("[subscribe] 오류:", err);
    return NextResponse.json(
      { success: false, message: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
