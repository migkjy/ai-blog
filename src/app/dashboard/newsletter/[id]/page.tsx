import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNewsletterById, updateNewsletterStatus } from '@/lib/content-db';

export const revalidate = 0;

const STATUS_WORKFLOW = ['draft', 'review', 'approved', 'scheduled', 'ready', 'sent'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sent: 'bg-teal-100 text-teal-800 border-teal-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

function formatDate(ms: number | null): string {
  if (!ms) return '-';
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const newsletter = await getNewsletterById(id).catch(() => null);

  if (!newsletter) notFound();

  const currentStatusIdx = STATUS_WORKFLOW.indexOf(newsletter.status);
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_WORKFLOW.length - 1
    ? STATUS_WORKFLOW[currentStatusIdx + 1]
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← 대시보드
        </Link>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[newsletter.status] ?? ''}`}>
            {newsletter.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{newsletter.subject}</h1>
        <div className="flex gap-6 text-sm text-gray-500 mb-6">
          <span>생성: {formatDate(newsletter.created_at)}</span>
          {newsletter.sent_at && <span>발송: {formatDate(newsletter.sent_at)}</span>}
        </div>

        {/* Status Workflow Stepper */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">상태 워크플로우</p>
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_WORKFLOW.map((s, i) => {
              const done = STATUS_WORKFLOW.indexOf(newsletter.status) >= i;
              const current = newsletter.status === s;
              return (
                <div key={s} className="flex items-center gap-1">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      current
                        ? STATUS_COLORS[s] ?? 'bg-blue-100 text-blue-800 border-blue-200'
                        : done
                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                        : 'bg-white text-gray-300 border-gray-200'
                    }`}
                  >
                    {s}
                  </span>
                  {i < STATUS_WORKFLOW.length - 1 && (
                    <span className={`text-xs ${done ? 'text-gray-400' : 'text-gray-200'}`}>→</span>
                  )}
                </div>
              );
            })}
          </div>
          {nextStatus && (
            <form
              action={async () => {
                'use server';
                await updateNewsletterStatus(id, nextStatus);
              }}
              className="mt-3"
            >
              <button
                type="submit"
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {nextStatus}(으)로 이동
              </button>
            </form>
          )}
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">본문 미리보기</p>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: newsletter.html_content }}
            />
          </div>
        </div>

        {newsletter.plain_content && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">텍스트 버전</p>
            <pre className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
              {newsletter.plain_content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
