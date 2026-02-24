import Link from 'next/link';
import { getPipelineLogs, getContentLogs, type PipelineLog, type ContentLog } from '@/lib/content-db';

export const revalidate = 60;

const STATUS_COLORS: Record<string, string> = {
  started: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  published: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-gray-100 text-gray-700',
};

const PIPELINE_ICONS: Record<string, string> = {
  collect: '↓',
  generate: '✦',
  publish: '→',
  blog: '✎',
  sns: '◈',
};

function formatDate(ms: number | null): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function PipelineLogRow({ item, idx }: { item: PipelineLog; idx: number }) {
  let metadata: Record<string, unknown> = {};
  if (item.metadata) {
    try { metadata = JSON.parse(item.metadata); } catch { /* ignore */ }
  }

  return (
    <div className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="px-4 py-3 flex items-start gap-4">
        {/* Icon & Name */}
        <div className="flex items-center gap-2 w-36 shrink-0">
          <span className="text-lg text-gray-400">{PIPELINE_ICONS[item.pipeline_name] ?? '◌'}</span>
          <span className="text-sm font-semibold text-gray-800">{item.pipeline_name}</span>
        </div>

        {/* Status */}
        <div className="w-24 shrink-0 pt-0.5">
          <StatusBadge status={item.status} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 flex-1">
          <div className="text-sm">
            <span className="text-gray-400 text-xs">처리</span>
            <span className="ml-1 font-medium text-gray-800">{item.items_processed ?? 0}건</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400 text-xs">소요</span>
            <span className="ml-1 font-medium text-gray-800">{formatDuration(item.duration_ms)}</span>
          </div>
          {Object.keys(metadata).length > 0 && (
            <div className="text-xs text-gray-500 flex gap-3">
              {Object.entries(metadata).slice(0, 4).map(([k, v]) => (
                <span key={k}>
                  <span className="text-gray-400">{k}:</span> {String(v)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Time */}
        <div className="text-xs text-gray-400 shrink-0">{formatDate(item.created_at)}</div>
      </div>

      {/* Error Message */}
      {item.error_message && (
        <div className="px-4 pb-3">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-mono break-all">
            {item.error_message}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const { pipeline } = await searchParams;

  const [pipelineLogs, contentLogs] = await Promise.all([
    getPipelineLogs().catch(() => [] as PipelineLog[]),
    getContentLogs().catch(() => [] as ContentLog[]),
  ]);

  const pipelines = ['전체', 'collect', 'generate', 'publish', 'blog', 'sns'];
  const filteredLogs = pipeline && pipeline !== '전체'
    ? pipelineLogs.filter((l) => l.pipeline_name === pipeline)
    : pipelineLogs;

  // Stats
  const successCount = pipelineLogs.filter((l) => l.status === 'completed').length;
  const failCount = pipelineLogs.filter((l) => l.status === 'failed').length;
  const totalItems = pipelineLogs.reduce((sum, l) => sum + (l.items_processed ?? 0), 0);
  const avgDuration = pipelineLogs.filter((l) => l.duration_ms).length > 0
    ? pipelineLogs.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0) / pipelineLogs.filter((l) => l.duration_ms).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">파이프라인 실행 로그</h1>
          <p className="mt-1 text-sm text-gray-500">최근 {pipelineLogs.length}개 실행 기록</p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← 대시보드
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-500 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">전체 실행</p>
          <p className="text-2xl font-bold text-gray-900">{pipelineLogs.length}회</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">성공</p>
          <p className="text-2xl font-bold text-green-700">{successCount}회</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-500 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">실패</p>
          <p className="text-2xl font-bold text-red-700">{failCount}회</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-purple-500 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">총 처리량</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}건</p>
          {avgDuration > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">평균 {formatDuration(avgDuration)}</p>
          )}
        </div>
      </div>

      {/* Pipeline Filter */}
      <div className="flex gap-2 flex-wrap">
        {pipelines.map((p) => (
          <Link
            key={p}
            href={p === '전체' ? '/dashboard/logs' : `/dashboard/logs?pipeline=${p}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              (p === '전체' && !pipeline) || pipeline === p
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {PIPELINE_ICONS[p] ?? ''} {p}
          </Link>
        ))}
      </div>

      {/* Pipeline Logs */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">파이프라인 실행 내역</h2>
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            {pipeline ? `'${pipeline}' 파이프라인 실행 기록이 없습니다.` : '파이프라인 실행 기록이 없습니다.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {filteredLogs.map((log, i) => (
              <PipelineLogRow key={log.id} item={log} idx={i} />
            ))}
          </div>
        )}
      </section>

      {/* Content Logs */}
      <section>
        <h2 className="text-base font-bold text-gray-900 mb-3">콘텐츠 발행 이벤트</h2>
        {contentLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            발행 이벤트 기록이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">제목</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">타입</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">플랫폼</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">발행시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contentLogs.map((log, i) => (
                  <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                      {log.title || '(제목 없음)'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{log.content_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.platform || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(log.published_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
