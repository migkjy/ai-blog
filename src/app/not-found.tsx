import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-6xl font-extrabold text-[var(--color-primary)]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-[var(--color-text)]">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-2 text-[var(--color-text-muted)]">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          &larr; 블로그 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
