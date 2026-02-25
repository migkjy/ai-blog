'use client';

import { useState } from 'react';

interface ApproveActionsProps {
  contentId: string;
  status: string;
  onSuccess: (action: 'approve' | 'reject', result: Record<string, unknown>) => void;
  onError: (message: string) => void;
}

export default function ApproveActions({ contentId, status, onSuccess, onError }: ApproveActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const canAct = ['draft', 'reviewing'].includes(status);

  async function handleApprove() {
    if (!confirm('이 콘텐츠를 승인하시겠습니까? 승인 시 자동으로 블로그에 발행됩니다.')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, approvedBy: 'ceo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approve failed');
      onSuccess('approve', data);
    } catch (err) {
      onError(err instanceof Error ? err.message : '승인 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reject failed');
      setShowRejectModal(false);
      setRejectReason('');
      onSuccess('reject', data);
    } catch (err) {
      onError(err instanceof Error ? err.message : '거부 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (!canAct) {
    return (
      <div className="border-t border-[var(--color-border)] pt-4 mt-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          이 콘텐츠는 이미 {status === 'approved' ? '승인' : status === 'published' ? '발행' : '처리'}되었습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-border)] pt-4 mt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '처리중...' : '승인'}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          거부
        </button>
      </div>

      {/* 거부 사유 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold mb-3">거부 사유를 입력해주세요</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 본문이 너무 짧습니다. 소제목 2개 이상 추가 필요."
              className="w-full border border-[var(--color-border)] rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '처리중...' : '거부 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
