'use client';

export interface ErrorItem {
  id: string;
  occurred_at: number;
  component: string;
  error_type: string;
  error_message: string;
  auto_fix_attempted: number;
  auto_fix_result: string | null;
  auto_fix_action: string | null;
  resolved_at: number | null;
  resolution_type: string | null;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function AutoFixBadge({ item }: { item: ErrorItem }) {
  if (!item.auto_fix_attempted) {
    return <span className="text-xs text-gray-400">대기중</span>;
  }
  switch (item.auto_fix_result) {
    case 'success':
      return <span className="text-xs text-green-600 font-medium">자동교정 성공 {item.auto_fix_action ? `(${item.auto_fix_action})` : ''}</span>;
    case 'failed':
      return <span className="text-xs text-orange-600 font-medium">자동교정 실패</span>;
    case 'skipped':
      return <span className="text-xs text-gray-500">교정 미시도</span>;
    default:
      return <span className="text-xs text-gray-400">대기중</span>;
  }
}

interface ErrorTableProps {
  items: ErrorItem[];
  onResolve: (id: string) => void;
  resolving: string | null;
}

export default function ErrorTable({ items, onResolve, resolving }: ErrorTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 border border-green-200 bg-green-50 rounded-lg">
        <p className="text-sm text-green-700">에러가 없습니다. 파이프라인이 정상 동작 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-tag-bg)]">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">시각</th>
            <th className="text-left px-4 py-2 font-semibold">컴포넌트</th>
            <th className="text-left px-4 py-2 font-semibold">유형</th>
            <th className="text-left px-4 py-2 font-semibold">자동교정</th>
            <th className="text-left px-4 py-2 font-semibold">메시지</th>
            <th className="text-center px-4 py-2 font-semibold">액션</th>
          </tr>
        </thead>
        <tbody>
          {items.map((err) => (
            <tr key={err.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
              <td className="px-4 py-2 text-[var(--color-text-muted)]">{formatTime(err.occurred_at)}</td>
              <td className="px-4 py-2">{err.component}</td>
              <td className="px-4 py-2">{err.error_type}</td>
              <td className="px-4 py-2"><AutoFixBadge item={err} /></td>
              <td className="px-4 py-2 text-xs text-[var(--color-text-muted)] max-w-xs truncate">{err.error_message}</td>
              <td className="px-4 py-2 text-center">
                {!err.resolved_at ? (
                  <button
                    onClick={() => onResolve(err.id)}
                    disabled={resolving === err.id}
                    className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
                  >
                    {resolving === err.id ? '...' : '해결됨'}
                  </button>
                ) : (
                  <span className="text-xs text-green-600">{err.resolution_type || '해결'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
