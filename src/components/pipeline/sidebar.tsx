'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/pipeline', label: '홈', icon: '□' },
  { href: '/pipeline/review', label: '콘텐츠 검수', icon: '✎' },
  { href: '/pipeline/logs', label: '실행 이력', icon: '≡' },
  { href: '/pipeline/errors', label: '에러 현황', icon: '!' },
];

export default function Sidebar({ unresolvedErrors }: { unresolvedErrors?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] shrink-0 border-r border-[var(--color-border)] bg-[#F9FAFB] min-h-[calc(100vh-57px)]">
      <nav className="p-4 flex flex-col gap-1">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-3">
          Pipeline
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-gray-100'
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === '/pipeline/errors' && unresolvedErrors && unresolvedErrors > 0 ? (
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {unresolvedErrors > 9 ? '9+' : unresolvedErrors}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
