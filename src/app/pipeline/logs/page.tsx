'use client';

import { useEffect, useState, useCallback } from 'react';
import StatCard from '@/components/pipeline/stat-card';
import FilterBar from '@/components/pipeline/filter-bar';
import Pagination from '@/components/pipeline/pagination';
import LogTable, { type LogItem } from '@/components/pipeline/log-table';

const PIPELINE_FILTERS = [
  { label: '전체', value: '' },
  { label: '수집', value: 'collect' },
  { label: '생성', value: 'generate' },
  { label: '승인', value: 'approve' },
  { label: '배포', value: 'publish' },
  { label: '자체교정', value: 'self-healing' },
];

const STATUS_FILTERS = [
  { label: '전체', value: '' },
  { label: '완료', value: 'completed' },
  { label: '실패', value: 'failed' },
  { label: '진행중', value: 'started' },
];

const PERIOD_FILTERS = [
  { label: '최근 7일', value: '7' },
  { label: '최근 30일', value: '30' },
  { label: '전체', value: '365' },
];

interface LogsResponse {
  items: LogItem[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total_runs: number;
    success_rate: number;
    avg_duration_ms: number;
  };
}

export default function LogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('7');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (pipelineFilter) params.set('pipeline_name', pipelineFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('days', periodFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/pipeline/logs?${params}`);
      if (!res.ok) throw new Error('API error');
      setData(await res.json());
    } catch {
      setError('실행 이력을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [pipelineFilter, statusFilter, periodFilter, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [pipelineFilter, statusFilter, periodFilter]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
        <button onClick={fetchLogs} className="text-sm text-[var(--color-primary)] hover:underline">재시도</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">실행 이력</h1>
        <button onClick={fetchLogs} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          새로고침
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="총 실행" value={data?.stats.total_runs ?? '-'} color="blue" />
        <StatCard label="성공률" value={data ? `${data.stats.success_rate}%` : '-'} color="green" />
        <StatCard
          label="평균 소요"
          value={data?.stats.avg_duration_ms ? `${(data.stats.avg_duration_ms / 1000).toFixed(1)}초` : '-'}
          color="blue"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)] w-12">단계:</span>
          <FilterBar options={PIPELINE_FILTERS} value={pipelineFilter} onChange={setPipelineFilter} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)] w-12">상태:</span>
          <FilterBar options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)] w-12">기간:</span>
          <FilterBar options={PERIOD_FILTERS} value={periodFilter} onChange={setPeriodFilter} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      ) : (
        <LogTable items={data?.items || []} />
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
