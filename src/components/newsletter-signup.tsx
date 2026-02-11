"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/actions/subscribe";

export default function NewsletterSignup() {
  const [state, formAction, isPending] = useActionState(subscribeAction, null);

  if (state?.success) {
    return (
      <section className="my-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center shadow-lg">
        <div className="text-3xl mb-3">&#9993;</div>
        <p className="text-lg font-semibold text-white">
          {state.message}
        </p>
        <p className="mt-2 text-sm text-blue-100">
          매주 월요일 아침, 최신 AI 소식을 받아보세요.
        </p>
      </section>
    );
  }

  return (
    <section className="my-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 shadow-lg">
      <div className="text-center mb-6">
        <p className="text-sm font-medium text-blue-200 uppercase tracking-wider mb-2">
          무료 뉴스레터
        </p>
        <h3 className="text-2xl font-extrabold text-white mb-3">
          AI 트렌드를 놓치지 마세요
        </h3>
        <p className="text-blue-100 text-sm max-w-md mx-auto leading-relaxed">
          매주 엄선된 AI 뉴스와 소상공인을 위한 실전 활용 팁을 이메일로 받아보세요.
          이미 <span className="font-semibold text-white">10,000+</span>명이 구독 중입니다.
        </p>
      </div>
      <form action={formAction} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
        <input
          type="email"
          name="email"
          placeholder="이메일 주소를 입력하세요"
          required
          className="flex-1 rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-blue-200 focus:border-white focus:bg-white/15 focus:outline-none backdrop-blur-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors shadow-md"
        >
          {isPending ? "처리 중..." : "무료 구독하기"}
        </button>
      </form>
      {state?.message && !state.success && (
        <p className="mt-3 text-center text-sm text-red-200">{state.message}</p>
      )}
      <p className="mt-4 text-center text-xs text-blue-200">
        스팸 없이, 언제든 구독 취소 가능합니다.
      </p>
    </section>
  );
}
