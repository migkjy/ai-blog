'use client';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '초안', color: 'text-gray-700', bg: 'bg-gray-100' },
  reviewing: { label: '검수중', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: '승인됨', color: 'text-green-700', bg: 'bg-green-100' },
  scheduled: { label: '예약됨', color: 'text-blue-700', bg: 'bg-blue-100' },
  published: { label: '발행됨', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  failed: { label: '실패', color: 'text-red-700', bg: 'bg-red-100' },
  // pipeline_logs status
  started: { label: '진행중', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: '완료', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}
