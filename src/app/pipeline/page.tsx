'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/pipeline/stat-card';
import StatusBadge from '@/components/pipeline/status-badge';
import Link from 'next/link';

interface Stats {
  collected_today: number;
  pending_review: number;
  published_today: number;
  unresolved_errors: number;
  recent_logs: Array<{
    id: string;
    pipeline_name: string;
    status: string;
    items_processed: number;
    duration_ms: number | null;
    created_at: number;
  }>;
}

interface ContentItem {
  id: string;
  title: string | null;
  status: string;
  pillar: string | null;
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
  const d = new Date(ms);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}초`;
}

export default function PipelineHomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingItems, setPendingItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, contentRes] = await Promise.all([
        fetch('/api/pipeline/stats'),
        fetch('/api/pipeline/content?status=reviewing'),
      ]);

      if (!statsRes.ok || !contentRes.ok) throw new Error('API error');

      const statsData = await statsRes.json();
      const contentData = await contentRes.json();

      setStats(statsData);
      setPendingItems((contentData.items || []).slice(0, 3));
    } catch {
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">파이프라인 홈</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
        <button onClick={fetchData} className="text-sm text-[var(--color-primary)] hover:underline">
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">파이프라인 홈</h1>
        <button onClick={fetchData} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          새로고침
        </button>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="오늘 수집" value={stats?.collected_today ?? 0} color="blue" />
        <StatCard label="검수 대기" value={stats?.pending_review ?? 0} color="yellow" href="/pipeline/review" />
        <StatCard label="오늘 발행" value={stats?.published_today ?? 0} color="green" />
        <StatCard label="미해결 에러" value={stats?.unresolved_errors ?? 0} color="red" href="/pipeline/errors" />
      </div>

      {/* 최근 파이프라인 실행 5건 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">최근 파이프라인 실행</h2>
          <Link href="/pipeline/logs" className="text-sm text-[var(--color-primary)] hover:underline">
            전체 보기
          </Link>
        </div>
        {stats?.recent_logs && stats.recent_logs.length > 0 ? (
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-tag-bg)]">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">시각</th>
                  <th className="text-left px-4 py-2 font-semibold">단계</th>
                  <th className="text-left px-4 py-2 font-semibold">상태</th>
                  <th className="text-right px-4 py-2 font-semibold">건수</th>
                  <th className="text-right px-4 py-2 font-semibold">소요</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2 text-[var(--color-text-muted)]">{formatTime(log.created_at)}</td>
                    <td className="px-4 py-2">{PIPELINE_NAMES[log.pipeline_name] || log.pipeline_name}</td>
                    <td className="px-4 py-2"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-2 text-right">{log.items_processed}건</td>
                    <td className="px-4 py-2 text-right text-[var(--color-text-muted)]">{formatDuration(log.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center border border-[var(--color-border)] rounded-lg">
            아직 파이프라인이 실행되지 않았습니다.
          </p>
        )}
      </section>

      {/* 검수 대기 콘텐츠 미리보기 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">검수 대기 콘텐츠</h2>
        {pendingItems.length > 0 ? (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <div key={item.id} className="border border-[var(--color-border)] rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    {item.pillar && (
                      <span className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
                        {item.pillar}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{item.title || '(제목 없음)'}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatTime(item.created_at)}</p>
                </div>
                <Link
                  href="/pipeline/review"
                  className="ml-4 shrink-0 text-sm text-[var(--color-primary)] hover:underline"
                >
                  검수하기 &rarr;
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center border border-[var(--color-border)] rounded-lg">
            검수 대기 중인 콘텐츠가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
