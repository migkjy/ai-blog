'use client';

export interface EscalatedError {
  id: string;
  occurred_at: number;
  component: string;
  error_type: string;
  error_message: string;
  auto_fix_attempted: number;
  auto_fix_result: string | null;
}

const ACTION_SUGGESTIONS: Record<string, string> = {
  auth_fail: 'API 키 갱신이 필요합니다. 환경 변수를 확인하세요.',
  quality_fail: '프롬프트 검토가 필요합니다.',
  timeout: '서비스 상태를 확인하세요.',
  api_error: '외부 서비스 장애가 의심됩니다.',
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface ErrorEscalatedProps {
  errors: EscalatedError[];
  onResolve: (id: string) => void;
  resolving: string | null;
}

export default function ErrorEscalated({ errors, onResolve, resolving }: ErrorEscalatedProps) {
  if (errors.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-red-700">에스컬레이션</h2>
      {errors.map((err) => (
        <div key={err.id} className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-red-800">
                ESCALATED: {err.error_message}
              </p>
              <p className="text-sm text-red-600 mt-1">
                component: {err.component} | type: {err.error_type}
              </p>
              <p className="text-xs text-red-500 mt-1">
                {formatTime(err.occurred_at)}
              </p>
              <p className="text-sm text-red-700 mt-2 font-medium">
                조치필요: {ACTION_SUGGESTIONS[err.error_type] || '확인이 필요합니다.'}
              </p>
            </div>
            <button
              onClick={() => onResolve(err.id)}
              disabled={resolving === err.id}
              className="shrink-0 ml-4 px-3 py-1.5 text-xs bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              {resolving === err.id ? '처리중...' : '해결됨 처리'}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
