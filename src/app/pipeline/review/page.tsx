'use client';

import { useEffect, useState, useCallback } from 'react';
import ContentList, { type ContentListItem } from '@/components/pipeline/content-list';
import ContentPreview, { type ContentDetail } from '@/components/pipeline/content-preview';
import ApproveActions from '@/components/pipeline/approve-actions';
import FilterBar from '@/components/pipeline/filter-bar';
import { ToastContainer, useToast } from '@/components/pipeline/toast';

type FilterValue = 'all' | 'pending' | 'approved' | 'rejected';

const FILTER_OPTIONS = [
  { label: '전체', value: 'all' },
  { label: '검수대기', value: 'pending' },
  { label: '승인됨', value: 'approved' },
  { label: '거부됨', value: 'rejected' },
];

export default function ReviewPage() {
  const [items, setItems] = useState<ContentListItem[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Fetch content list
  const fetchList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline/content');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError('데이터를 불러올 수 없습니다.');
    } finally {
      setListLoading(false);
    }
  }, []);

  // Fetch content detail
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/pipeline/content/${id}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setDetail(data.item || null);
    } catch {
      addToast('error', '콘텐츠 상세를 불러올 수 없습니다.');
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else setDetail(null);
  }, [selectedId, fetchDetail]);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filter === 'pending') return ['draft', 'reviewing'].includes(item.status);
    if (filter === 'approved') return item.status === 'approved';
    if (filter === 'rejected') return item.rejected_reason != null && item.status === 'draft';
    return true;
  });

  // Update filter counts
  const filterOptions = FILTER_OPTIONS.map((opt) => ({
    ...opt,
    count:
      opt.value === 'all'
        ? items.length
        : opt.value === 'pending'
          ? items.filter((i) => ['draft', 'reviewing'].includes(i.status)).length
          : opt.value === 'approved'
            ? items.filter((i) => i.status === 'approved').length
            : items.filter((i) => i.rejected_reason != null && i.status === 'draft').length,
  }));

  function handleActionSuccess(action: 'approve' | 'reject', result: Record<string, unknown>) {
    if (action === 'approve') {
      const autoPublish = result.autoPublish as { success?: boolean } | undefined;
      if (autoPublish?.success) {
        addToast('success', '승인 완료! 블로그 발행이 시작되었습니다.');
      } else {
        addToast('success', '승인 완료! (자동 발행은 별도 확인 필요)');
      }
    } else {
      addToast('info', '콘텐츠가 거부되었습니다. AI가 사유를 반영하여 재생성합니다.');
    }
    // Refresh data
    fetchList();
    if (selectedId) fetchDetail(selectedId);
  }

  function handleActionError(message: string) {
    addToast('error', message);
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-text-muted)] mb-4">{error}</p>
        <button onClick={fetchList} className="text-sm text-[var(--color-primary)] hover:underline">
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-57px-48px)]">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">콘텐츠 검수</h1>
        <button onClick={fetchList} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          새로고침
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-4">
        <FilterBar options={filterOptions} value={filter} onChange={(v) => setFilter(v as FilterValue)} />
      </div>

      {/* Two-column layout: list + preview */}
      <div className="flex gap-4 h-[calc(100%-100px)]">
        {/* Left: Content list */}
        <div className="w-[360px] shrink-0 overflow-auto border border-[var(--color-border)] rounded-lg p-3">
          {listLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <ContentList items={filteredItems} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>

        {/* Right: Preview */}
        <div className="flex-1 overflow-auto border border-[var(--color-border)] rounded-lg p-4 flex flex-col">
          <ContentPreview content={detail} loading={detailLoading} />
          {detail && (
            <ApproveActions
              contentId={detail.id}
              status={detail.status}
              onSuccess={handleActionSuccess}
              onError={handleActionError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
