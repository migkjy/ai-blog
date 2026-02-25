'use client';

import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: number | string;
  href?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

const COLOR_MAP = {
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  yellow: 'border-yellow-200 bg-yellow-50',
  red: 'border-red-200 bg-red-50',
};

export default function StatCard({ label, value, href, color = 'blue' }: StatCardProps) {
  const content = (
    <div className={`rounded-xl border p-4 ${COLOR_MAP[color]} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <p className="text-sm text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-3xl font-bold text-[var(--color-text)]">{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
