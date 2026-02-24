import Link from 'next/link';
import {
  getNewsletters,
  getContentQueue,
  getContentLogs,
  getPipelineLogs,
  getNewsStats,
  ensureSchema,
  type Newsletter,
  type ContentQueueItem,
  type ContentLog,
  type PipelineLog,
} from '@/lib/content-db';

export const revalidate = 60;

const STATUS_WORKFLOW = ['draft', 'review', 'approved', 'scheduled', 'published', 'ready', 'sent', 'failed'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
  ready: 'bg-emerald-100 text-emerald-800',
  sent: 'bg-teal-100 text-teal-800',
  pending: 'bg-orange-100 text-orange-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  started: 'bg-blue-100 text-blue-800',
};

const CHANNEL_ICONS: Record<string, string> = {
  'blog.apppro.kr': '✎',
  brevo: '✉',
  getlate: '◈',
  twitter: '✦',
  linkedin: '◇',
  instagram: '◎',
};

const PROJECTS = ['전체', 'AI설계자PDF PLF', 'apppro 블로그', '뉴스레터', '기타'];

function formatDate(ms: number | null): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function NewsletterRow({ item, idx }: { item: Newsletter; idx: number }) {
  return (
    <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
        <Link href={`/dashboard/newsletter/${item.id}`} className="hover:text-blue-600 transition-colors">
          {item.subject || '(제목 없음)'}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.created_at)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{item.sent_at ? formatDate(item.sent_at) : '-'}</td>
    </tr>
  );
}

function QueueRow({ item, idx }: { item: ContentQueueItem; idx: number }) {
  return (
    <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-xs font-medium text-gray-700 uppercase">{item.type}</td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{item.topic || item.pillar || '-'}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{item.project || '-'}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{item.channel || '-'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">우선순위 {item.priority}</td>
    </tr>
  );
}

function LogRow({ item, idx }: { item: ContentLog; idx: number }) {
  const icon = CHANNEL_ICONS[item.platform ?? ''] ?? '◌';
  return (
    <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{item.title || '(제목 없음)'}</td>
      <td className="px-4 py-3 text-xs text-gray-500 uppercase">{item.content_type}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <span className="mr-1">{icon}</span>{item.platform || '-'}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(item.published_at)}</td>
    </tr>
  );
}

function PipelineRow({ item, idx }: { item: PipelineLog; idx: number }) {
  return (
    <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-4 py-3 text-sm font-medium text-gray-700">{item.pipeline_name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{item.items_processed ?? 0}건</td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {item.duration_ms ? `${(item.duration_ms / 1000).toFixed(1)}s` : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(item.created_at)}</td>
    </tr>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; status?: string }>;
}) {
  await ensureSchema().catch(() => {});

  const { project, status } = await searchParams;

  const [newsletters, queue, logs, pipelines, newsStats] = await Promise.all([
    getNewsletters().catch(() => [] as Newsletter[]),
    getContentQueue().catch(() => [] as ContentQueueItem[]),
    getContentLogs().catch(() => [] as ContentLog[]),
    getPipelineLogs().catch(() => [] as PipelineLog[]),
    getNewsStats().catch(() => ({ total: 0, used: 0, unused: 0 })),
  ]);

  // Filter newsletters by status
  const filteredNewsletters = status
    ? newsletters.filter((n) => n.status === status)
    : newsletters;

  // Filter queue by project
  const filteredQueue = project && project !== '전체'
    ? queue.filter((q) => q.project === project)
    : queue;

  // Summary counts
  const nlByStatus = STATUS_WORKFLOW.reduce((acc, s) => {
    acc[s] = newsletters.filter((n) => n.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const queueByStatus = {
    pending: queue.filter((q) => q.status === 'pending').length,
    processing: queue.filter((q) => q.status === 'processing').length,
    completed: queue.filter((q) => q.status === 'completed').length,
    failed: queue.filter((q) => q.status === 'failed').length,
  };

  const lastPipeline = pipelines[0];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠 오케스트레이션</h1>
        <p className="mt-1 text-sm text-gray-500">뉴스레터, 블로그, SNS 콘텐츠 파이프라인 통합 관리</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="뉴스레터 전체" value={newsletters.length} sub="누적" color="blue" />
        <StatCard title="큐 대기" value={queueByStatus.pending} sub={`실패 ${queueByStatus.failed}건`} color="orange" />
        <StatCard title="수집 기사" value={newsStats.total} sub={`미사용 ${newsStats.unused}건`} color="green" />
        <StatCard
          title="마지막 파이프라인"
          value={lastPipeline ? lastPipeline.pipeline_name : '-'}
          sub={lastPipeline ? lastPipeline.status : '실행 기록 없음'}
          color={lastPipeline?.status === 'failed' ? 'red' : 'purple'}
          isText
        />
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/calendar" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
          ◷ 배포 캘린더
        </Link>
        <Link href="/dashboard/rss" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
          ◉ RSS 수집 현황
        </Link>
        <Link href="/dashboard/logs" className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
          ≡ 파이프라인 로그
        </Link>
      </div>

      {/* Section 1: Newsletters */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">뉴스레터 목록</h2>
          <div className="flex gap-1 flex-wrap">
            <Link
              href="/dashboard"
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                !status ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
              }`}
            >
              전체 {newsletters.length}
            </Link>
            {Object.entries(nlByStatus).filter(([, count]) => count > 0).map(([s, count]) => (
              <Link
                key={s}
                href={`/dashboard?status=${s}`}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  status === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {s} {count}
              </Link>
            ))}
          </div>
        </div>

        {filteredNewsletters.length === 0 ? (
          <EmptyState message="뉴스레터 데이터가 없습니다." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">제목</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">생성일</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">발송일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredNewsletters.slice(0, 20).map((nl, i) => (
                  <NewsletterRow key={nl.id} item={nl} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Content Queue */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">콘텐츠 큐</h2>
          <div className="flex gap-1">
            {PROJECTS.map((p) => (
              <Link
                key={p}
                href={p === '전체' ? '/dashboard' : `/dashboard?project=${encodeURIComponent(p)}`}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  (p === '전체' && !project) || project === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <EmptyState message="큐에 항목이 없습니다." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">타입</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">주제</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">프로젝트</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">채널</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">우선순위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredQueue.slice(0, 20).map((item, i) => (
                  <QueueRow key={item.id} item={item} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3: Channel Distribution */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">채널별 배포 현황</h2>
        <ChannelDistribution logs={logs} />
      </section>

      {/* Section 4: Recent Content Logs */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">최근 발행 기록</h2>
        {logs.length === 0 ? (
          <EmptyState message="발행 기록이 없습니다." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">제목</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">타입</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">채널</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">발행일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.slice(0, 15).map((log, i) => (
                  <LogRow key={log.id} item={log} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 5: Recent Pipeline Runs */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">최근 파이프라인 실행</h2>
        {pipelines.length === 0 ? (
          <EmptyState message="파이프라인 실행 기록이 없습니다." />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">파이프라인</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">처리 건수</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">소요시간</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">실행시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pipelines.slice(0, 10).map((pl, i) => (
                  <PipelineRow key={pl.id} item={pl} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  color,
  isText = false,
}: {
  title: string;
  value: number | string;
  sub: string;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'red';
  isText?: boolean;
}) {
  const borderColors = {
    blue: 'border-l-blue-500',
    orange: 'border-l-orange-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    red: 'border-l-red-500',
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColors[color]} p-4 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <p className={`font-bold text-gray-900 ${isText ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

function ChannelDistribution({ logs }: { logs: ContentLog[] }) {
  const channels = ['blog.apppro.kr', 'brevo', 'getlate', 'twitter', 'linkedin', 'instagram'];
  const channelCounts = channels.map((ch) => ({
    name: ch,
    count: logs.filter((l) => l.platform === ch).length,
    icon: CHANNEL_ICONS[ch] ?? '◌',
  }));

  const maxCount = Math.max(...channelCounts.map((c) => c.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {channelCounts.every((c) => c.count === 0) ? (
        <p className="text-sm text-gray-400 text-center py-4">채널 배포 기록이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {channelCounts.map((ch) => (
            <div key={ch.name} className="flex items-center gap-3">
              <span className="text-gray-500 w-4 text-sm">{ch.icon}</span>
              <span className="text-sm text-gray-700 w-32 shrink-0">{ch.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(ch.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 w-8 text-right">{ch.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
