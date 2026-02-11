import type { Metadata } from 'next';
import '@/styles/global.css';
import PageTracker from '@/components/page-tracker';
import MobileNav from '@/components/mobile-nav';

const BASE_URL = 'https://content-pipeline-sage.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'AI AppPro - AI로 비즈니스를 혁신하세요',
    template: '%s | AI AppPro',
  },
  description:
    '소상공인과 중소기업을 위한 실전 AI 활용 가이드. AI 도구 리뷰, 업종별 자동화 플레이북, 최신 AI 트렌드를 한국어로 쉽게 전달합니다.',
  keywords: ['AI', '인공지능', '자동화', '소상공인', '중소기업', 'AI 도구', 'AI 활용법', '뉴스레터'],
  authors: [{ name: 'AI AppPro' }],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'AI AppPro',
    title: 'AI AppPro - AI로 비즈니스를 혁신하세요',
    description: '소상공인과 중소기업을 위한 실전 AI 활용 가이드',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI AppPro - AI로 비즈니스를 혁신하세요',
    description: '소상공인과 중소기업을 위한 실전 AI 활용 가이드',
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "AI AppPro",
  "url": BASE_URL,
  "description": "소상공인과 중소기업을 위한 실전 AI 활용 가이드",
  "publisher": {
    "@type": "Organization",
    "name": "AI AppPro",
    "url": "https://apppro.kr",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <PageTracker />
        <header className="border-b border-[var(--color-border)] sticky top-0 bg-white/95 backdrop-blur-sm z-40">
          <nav className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between relative">
            <a href="/" className="text-xl font-bold text-[var(--color-primary)]">
              AI AppPro
            </a>
            {/* Desktop nav */}
            <div className="hidden sm:flex gap-6 text-sm text-[var(--color-text-muted)]">
              <a href="/" className="hover:text-[var(--color-text)] transition-colors">
                블로그
              </a>
              <a
                href="https://ai-directory-seven.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-text)] transition-colors"
              >
                AI 도구
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
            {/* Mobile nav */}
            <MobileNav />
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t border-[var(--color-border)] mt-16 bg-[var(--color-tag-bg)]">
          <div className="mx-auto max-w-4xl px-4 py-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-3">AI AppPro</h4>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  소상공인과 중소기업을 위한 실전 AI 활용 가이드.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-3">링크</h4>
                <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                  <li>
                    <a href="/" className="hover:text-[var(--color-primary)] transition-colors">블로그</a>
                  </li>
                  <li>
                    <a href="https://ai-directory-seven.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">AI 도구 디렉토리</a>
                  </li>
                  <li>
                    <a href="https://apppro.kr" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)] transition-colors">홈페이지</a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-3">콘텐츠</h4>
                <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                  <li>
                    <a href="/?category=AI+%EB%8F%84%EA%B5%AC+%EB%A6%AC%EB%B7%B0" className="hover:text-[var(--color-primary)] transition-colors">AI 도구 리뷰</a>
                  </li>
                  <li>
                    <a href="/?category=%EC%97%85%EC%A2%85%EB%B3%84+AI+%ED%99%9C%EC%9A%A9" className="hover:text-[var(--color-primary)] transition-colors">업종별 AI 활용</a>
                  </li>
                  <li>
                    <a href="/?category=%EC%9E%90%EB%8F%99%ED%99%94+%ED%94%8C%EB%A0%88%EC%9D%B4%EB%B6%81" className="hover:text-[var(--color-primary)] transition-colors">자동화 플레이북</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-[var(--color-border)] pt-6 text-center text-sm text-[var(--color-text-muted)]">
              <p>&copy; {new Date().getFullYear()} AI AppPro. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
