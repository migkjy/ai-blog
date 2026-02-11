"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/actions/subscribe";

export default function NewsletterSignup() {
  const [state, formAction, isPending] = useActionState(subscribeAction, null);

  if (state?.success) {
    return (
      <section className="my-12 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-primary)] p-8 text-center">
        <p className="text-lg font-semibold text-[var(--color-primary)]">
          {state.message}
        </p>
      </section>
    );
  }

  return (
    <section className="my-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-8">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">
          AI AppPro 뉴스레터
        </h3>
        <p className="text-[var(--color-text-muted)] text-sm">
          매주 최신 AI 트렌드와 소상공인을 위한 실전 활용 팁을 받아보세요.
        </p>
      </div>
      <form action={formAction} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input
          type="email"
          name="email"
          placeholder="이메일 주소를 입력하세요"
          required
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "처리 중..." : "구독하기"}
        </button>
      </form>
      {state?.message && !state.success && (
        <p className="mt-3 text-center text-sm text-red-600">{state.message}</p>
      )}
      <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
        스팸 없이, 언제든 구독 취소 가능합니다.
      </p>
    </section>
  );
}
