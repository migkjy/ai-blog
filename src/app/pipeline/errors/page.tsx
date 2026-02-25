'use client';

import { useEffect, useState, useCallback } from 'react';
import StatCard from '@/components/pipeline/stat-card';
import FilterBar from '@/components/pipeline/filter-bar';
import Pagination from '@/components/pipeline/pagination';
import ErrorEscalated, { type EscalatedError } from '@/components/pipeline/error-escalated';
import ErrorTable, { type ErrorItem } from '@/components/pipeline/error-table';
import { ToastContainer, useToast } from '@/components/pipeline/toast';

const STATUS_FILTERS = [
  { label: '미해결', value: 'unresolved' },
  { label: '전체', value: 'all' },
  { label: '해결됨', value: 'resolved' },
];

interface ErrorsResponse {
  escalated: EscalatedError[];
  items: ErrorItem[];
  total: number;
  page: number;
  limit: number;
  stats: {
    unresolved: number;
    escalated_count: number;
    auto_fix_success_rate: number;
  };
}

export default function ErrorsPage() {
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('unresolved');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('resolved', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/pipeline/errors?${params}`);
      if (!res.ok) throw new Error('API error');
      setData(await res.json());
    } catch {
      setError('에러 현황을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`/api/pipeline/errors/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_type: 'manual_fixed' }),
      });
      if (!res.ok) throw new Error('Resolve failed');
      addToast('success', '에러가 해결됨으로 처리되었습니다.');
      fetchErrors();
    } catch {
      addToast('error', '에러 해결 처리에 실패했습니다.');
    } finally {
      setResolving(null);
    }
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
        <button onClick={fetchErrors} className="text-sm text-[var(--color-primary)] hover:underline">재시도</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">에러 현황</h1>
        <button onClick={fetchErrors} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          새로고침
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="미해결 에러" value={data?.stats.unresolved ?? '-'} color="red" />
        <StatCard label="에스컬레이션" value={data?.stats.escalated_count ?? '-'} color="red" />
        <StatCard label="자동교정 성공률" value={data ? `${data.stats.auto_fix_success_rate}%` : '-'} color="green" />
      </div>

      {/* Escalated section */}
      {!loading && data && (
        <ErrorEscalated errors={data.escalated} onResolve={handleResolve} resolving={resolving} />
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)] w-12">상태:</span>
        <FilterBar options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      ) : (
        <ErrorTable items={data?.items || []} onResolve={handleResolve} resolving={resolving} />
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
