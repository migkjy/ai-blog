'use client';

import StatusBadge from './status-badge';

export interface LogItem {
  id: string;
  pipeline_name: string;
  status: string;
  duration_ms: number | null;
  items_processed: number;
  error_message: string | null;
  metadata: string | null;
  trigger_type: string | null;
  created_at: number;
}

const PIPELINE_NAMES: Record<string, string> = {
  collect: '수집',
  generate: '생성',
  approve: '승인',
  publish: '배포',
  'self-healing': '자체교정',
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}초`;
}

function extractMetadataPreview(metadata: string | null, pipelineName: string): string {
  if (!metadata) return '';
  try {
    const data = JSON.parse(metadata);
    switch (pipelineName) {
      case 'collect':
        return [
          data.feeds_ok != null && `feeds:${data.feeds_ok}/${(data.feeds_ok || 0) + (data.feeds_fail || 0)}`,
          data.filter_pass != null && `pass:${data.filter_pass}`,
        ].filter(Boolean).join(' ');
      case 'generate':
        return [data.pillar, data.qa_score != null && `qa:${data.qa_score}`].filter(Boolean).join(' ');
      case 'approve':
        return data.approved_by || data.action || '';
      case 'publish':
        return data.channels_ok != null ? `ch:${data.channels_ok}/${(data.channels_ok || 0) + (data.channels_fail || 0)}` : '';
      default:
        return '';
    }
  } catch {
    return '';
  }
}

export default function LogTable({ items }: { items: LogItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-12 text-center border border-[var(--color-border)] rounded-lg">
        아직 파이프라인이 실행되지 않았습니다.<br />
        Cron이 매일 06:00(KST)에 자동 실행합니다.
      </p>
    );
  }

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-tag-bg)]">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">시각</th>
            <th className="text-left px-4 py-2 font-semibold">단계</th>
            <th className="text-left px-4 py-2 font-semibold">상태</th>
            <th className="text-right px-4 py-2 font-semibold">건수</th>
            <th className="text-right px-4 py-2 font-semibold">소요</th>
            <th className="text-left px-4 py-2 font-semibold">메타데이터</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => (
            <tr key={log.id} className="border-t border-[var(--color-border)] hover:bg-gray-50">
              <td className="px-4 py-2 text-[var(--color-text-muted)]">{formatTime(log.created_at)}</td>
              <td className="px-4 py-2">{PIPELINE_NAMES[log.pipeline_name] || log.pipeline_name}</td>
              <td className="px-4 py-2"><StatusBadge status={log.status} /></td>
              <td className="px-4 py-2 text-right">{log.items_processed}건</td>
              <td className="px-4 py-2 text-right text-[var(--color-text-muted)]">{formatDuration(log.duration_ms)}</td>
              <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">
                {extractMetadataPreview(log.metadata, log.pipeline_name)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
