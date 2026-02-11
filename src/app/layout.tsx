import type { Metadata } from 'next';
import '@/styles/global.css';
import PageTracker from '@/components/page-tracker';

export const metadata: Metadata = {
  title: {
    default: 'AI AppPro - AI로 비즈니스를 혁신하세요',
    template: '%s | AI AppPro',
  },
  description:
    '소상공인과 중소기업을 위한 실전 AI 활용 가이드. AI 도구 리뷰, 업종별 자동화 플레이북, 최신 AI 트렌드를 한국어로 쉽게 전달합니다.',
  keywords: ['AI', '인공지능', '자동화', '소상공인', '중소기업', 'AI 도구', 'AI 활용법'],
  authors: [{ name: 'AI AppPro' }],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'AI AppPro',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-white">
        <PageTracker />
        <header className="border-b border-[var(--color-border)]">
          <nav className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-[var(--color-primary)]">
              AI AppPro
            </a>
            <div className="flex gap-6 text-sm text-[var(--color-text-muted)]">
              <a href="/" className="hover:text-[var(--color-text)] transition-colors">
                블로그
              </a>
              <a
                href="https://apppro.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-text)] transition-colors"
              >
                홈페이지
              </a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t border-[var(--color-border)] mt-16">
          <div className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
            <p>&copy; {new Date().getFullYear()} AI AppPro. All rights reserved.</p>
            <p className="mt-1">AI로 비즈니스를 혁신하세요.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
