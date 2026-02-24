import Link from 'next/link';
import { getRssSourceStats, getNewsStats } from '@/lib/content-db';
import { RSS_FEEDS, type FeedSource } from '@/pipeline/collect';

export const revalidate = 60;

const GRADE_COLORS: Record<string, string> = {
  S: 'bg-yellow-100 text-yellow-800',
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-gray-100 text-gray-700',
};

const CATEGORY_COLORS: Record<string, string> = {
  news: 'bg-red-50 text-red-700',
  official: 'bg-blue-50 text-blue-700',
  community: 'bg-green-50 text-green-700',
  research: 'bg-purple-50 text-purple-700',
};

const LANG_LABELS: Record<string, string> = {
  en: '영어',
  ko: '한국어',
};

function formatRelativeTime(ms: number | null): string {
  if (!ms) return '수집 기록 없음';
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return '1시간 이내';
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
}

export default async function RssPage() {
  const [sourceStats, newsStats] = await Promise.all([
    getRssSourceStats().catch(() => []),
    getNewsStats().catch(() => ({ total: 0, used: 0, unused: 0 })),
  ]);

  const statsMap = new Map(sourceStats.map((s) => [s.source, s]));

  // Merge defined feeds with DB stats
  const feedsWithStats = RSS_FEEDS.map((feed: FeedSource) => {
    const stat = statsMap.get(feed.name);
    return {
      ...feed,
      total: stat?.total ?? 0,
      latest_at: stat?.latest_at ?? null,
      hasData: !!stat,
    };
  });

  const successFeeds = feedsWithStats.filter((f) => f.hasData);
  const failedFeeds = feedsWithStats.filter((f) => !f.hasData);

  // Known failed feeds based on task description
  const knownFailed = ['ZDNet Korea AI', '블로터', 'ITWorld Korea', 'Reddit r/artificial', 'Reddit r/LocalLLaMA', 'Anthropic Blog'];
  const failedKnown = failedFeeds.filter((f) => knownFailed.includes(f.name));
  const failedOther = failedFeeds.filter((f) => !knownFailed.includes(f.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RSS 수집 현황</h1>
          <p className="mt-1 text-sm text-gray-500">{RSS_FEEDS.length}개 소스 모니터링</p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← 대시보드
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="전체 소스" value={RSS_FEEDS.length} label="개" />
        <StatCard title="수집 성공" value={successFeeds.length} label="개" color="green" />
        <StatCard title="수집 실패 / 미확인" value={failedFeeds.length} label="개" color="red" />
        <StatCard title="총 수집 기사" value={newsStats.total} label="건" color="blue" />
      </div>

      {/* News Usage */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">기사 활용 현황</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
            <div
              className="bg-blue-500 h-4 rounded-full transition-all"
              style={{ width: `${newsStats.total > 0 ? (newsStats.used / newsStats.total) * 100 : 0}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 whitespace-nowrap">
            <span className="font-bold text-blue-600">{newsStats.used}</span>
            <span className="text-gray-400"> / {newsStats.total}건 사용</span>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-xs text-gray-500">
          <span>미사용: <strong className="text-orange-600">{newsStats.unused}건</strong></span>
          <span>사용률: <strong>{newsStats.total > 0 ? Math.round((newsStats.used / newsStats.total) * 100) : 0}%</strong></span>
        </div>
      </div>

      {/* Active Feeds Table */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          수집 성공 피드
          <span className="ml-2 text-sm font-normal text-green-600">({successFeeds.length}개)</span>
        </h2>
        {successFeeds.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            수집된 데이터가 없습니다. pipeline:collect를 실행해주세요.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">소스</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">언어</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">등급</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">수집량</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">최근 수집</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {successFeeds
                  .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
                  .map((feed, i) => (
                    <tr key={feed.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-800">{feed.name}</div>
                        <div className="text-xs text-gray-400 truncate max-w-xs">{feed.url}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{LANG_LABELS[feed.lang] ?? feed.lang}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[feed.grade] ?? ''}`}>
                          {feed.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[feed.category] ?? ''}`}>
                          {feed.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{feed.total}건</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatRelativeTime(feed.latest_at)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                          정상
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failed Feeds */}
      {failedFeeds.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            실패 / 미수집 피드
            <span className="ml-2 text-sm font-normal text-red-500">({failedFeeds.length}개)</span>
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">소스</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">언어</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">등급</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...failedKnown, ...failedOther].map((feed, i) => (
                  <tr key={feed.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-700">{feed.name}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs">{feed.url}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{LANG_LABELS[feed.lang] ?? feed.lang}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[feed.grade] ?? ''}`}>
                        {feed.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[feed.category] ?? ''}`}>
                        {feed.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                        {knownFailed.includes(feed.name) ? '피드 오류' : '미수집'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {knownFailed.includes(feed.name) ? 'RSS 접근 불가' : 'collect 미실행'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  label,
  color = 'gray',
}: {
  title: string;
  value: number;
  label: string;
  color?: 'gray' | 'green' | 'red' | 'blue';
}) {
  const borderColors = {
    gray: 'border-l-gray-400',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColors[color]} p-4 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{label}</span>
      </p>
    </div>
  );
}
