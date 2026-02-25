'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StatusBadge from './status-badge';

export interface ContentDetail {
  id: string;
  type: string;
  pillar: string | null;
  topic: string | null;
  status: string;
  title: string | null;
  content_body: string | null;
  approved_by: string | null;
  approved_at: number | null;
  rejected_reason: string | null;
  created_at: number;
  updated_at: number;
}

interface ContentPreviewProps {
  content: ContentDetail | null;
  loading: boolean;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ContentPreview({ content, loading }: ContentPreviewProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-20 text-[var(--color-text-muted)]">
        좌측에서 콘텐츠를 선택하세요.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Metadata */}
      <div className="border-b border-[var(--color-border)] pb-4 mb-4 space-y-2">
        <h2 className="text-xl font-bold">{content.title || '(제목 없음)'}</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <StatusBadge status={content.status} />
          {content.pillar && (
            <span className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-full">
              {content.pillar}
            </span>
          )}
          <span>유형: {content.type || '-'}</span>
          <span>생성일: {formatDate(content.created_at)}</span>
        </div>
        {content.approved_by && (
          <p className="text-xs text-green-600">
            승인: {content.approved_by} ({content.approved_at ? formatDate(content.approved_at) : '-'})
          </p>
        )}
        {content.rejected_reason && (
          <p className="text-xs text-red-500">
            이전 거부 사유: {content.rejected_reason}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {content.content_body ? (
          <article className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.content_body}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] italic">본문이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
