import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '콘텐츠 대시보드 | AI AppPro',
  description: '콘텐츠 파이프라인 관리 대시보드',
  robots: { index: false, follow: false },
};

const NAV_ITEMS = [
  { href: '/dashboard', label: '개요', icon: '◈' },
  { href: '/dashboard/calendar', label: '캘린더', icon: '◷' },
  { href: '/dashboard/rss', label: 'RSS 수집', icon: '◉' },
  { href: '/dashboard/logs', label: '실행 로그', icon: '≡' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              ← 블로그
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-bold text-gray-800">콘텐츠 대시보드</span>
          </div>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
