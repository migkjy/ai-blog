'use client';

import StatusBadge from './status-badge';

export interface ContentListItem {
  id: string;
  title: string | null;
  status: string;
  pillar: string | null;
  created_at: number;
  rejected_reason: string | null;
}

interface ContentListProps {
  items: ContentListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ContentList({ items, selectedId, onSelect }: ContentListProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] py-12 text-center">
        검수할 콘텐츠가 없습니다.<br />
        파이프라인이 실행되면 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`text-left p-3 rounded-lg border transition-colors ${
            selectedId === item.id
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
              : 'border-[var(--color-border)] hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={item.status} />
            {item.pillar && (
              <span className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
                {item.pillar}
              </span>
            )}
          </div>
          <p className="text-sm font-medium line-clamp-2 leading-snug">
            {item.title || '(제목 없음)'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {formatDate(item.created_at)}
          </p>
          {item.rejected_reason && (
            <p className="text-xs text-red-500 mt-1 truncate">
              거부: {item.rejected_reason}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
