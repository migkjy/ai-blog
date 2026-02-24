import Link from 'next/link';
import { getScheduledContent, getNewsletters, type ContentQueueItem, type Newsletter } from '@/lib/content-db';

export const revalidate = 60;

const TYPE_COLORS: Record<string, string> = {
  newsletter: 'bg-blue-100 text-blue-800 border-blue-200',
  blog: 'bg-green-100 text-green-800 border-green-200',
  sns: 'bg-purple-100 text-purple-800 border-purple-200',
};

const CHANNEL_BADGES: Record<string, string> = {
  'blog.apppro.kr': 'bg-emerald-50 text-emerald-700',
  brevo: 'bg-sky-50 text-sky-700',
  getlate: 'bg-indigo-50 text-indigo-700',
  twitter: 'bg-slate-50 text-slate-700',
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  channel: string | null;
  project: string | null;
  date: Date;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; view?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()));
  const month = parseInt(params.month ?? String(now.getMonth()));
  const view = params.view ?? 'month';

  const [scheduledItems, newsletters] = await Promise.all([
    getScheduledContent().catch(() => [] as ContentQueueItem[]),
    getNewsletters().catch(() => [] as Newsletter[]),
  ]);

  // Merge calendar events from queue (scheduled_at) and newsletters (sent_at for scheduled/sent)
  const events: CalendarEvent[] = [];

  for (const item of scheduledItems) {
    if (item.scheduled_at) {
      events.push({
        id: item.id,
        title: item.topic ?? item.pillar ?? `${item.type} 콘텐츠`,
        type: item.type,
        channel: item.channel,
        project: item.project,
        date: new Date(item.scheduled_at),
      });
    }
  }

  for (const nl of newsletters) {
    const ts = nl.sent_at ?? (nl.status === 'scheduled' ? nl.created_at : null);
    if (ts) {
      events.push({
        id: nl.id,
        title: nl.subject,
        type: 'newsletter',
        channel: 'brevo',
        project: '뉴스레터',
        date: new Date(ts),
      });
    }
  }

  // Filter events for current month
  const monthEvents = events.filter(
    (e) => e.date.getFullYear() === year && e.date.getMonth() === month
  );

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const prevMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">배포 스케줄 캘린더</h1>
          <p className="mt-1 text-sm text-gray-500">콘텐츠 배포 일정 및 채널 매핑</p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← 대시보드
        </Link>
      </div>

      {/* Month Navigator */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <Link
            href={`/dashboard/calendar?year=${prevMonth.year}&month=${prevMonth.month}`}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            ← 이전
          </Link>
          <h2 className="text-lg font-bold text-gray-900">
            {year}년 {monthNames[month]}
            {monthEvents.length > 0 && (
              <span className="ml-2 text-sm font-normal text-blue-600">{monthEvents.length}개 일정</span>
            )}
          </h2>
          <Link
            href={`/dashboard/calendar?year=${nextMonth.year}&month=${nextMonth.month}`}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            다음 →
          </Link>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="min-h-20 border-r border-b border-gray-100 bg-gray-50" />;
            }

            const dayEvents = monthEvents.filter((e) => e.date.getDate() === day);
            const isToday =
              now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;

            return (
              <div
                key={day}
                className={`min-h-20 border-r border-b border-gray-100 p-1.5 ${
                  isToday ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={`text-xs px-1.5 py-0.5 rounded border truncate ${
                        TYPE_COLORS[ev.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${cls}`}>
            {type}
          </span>
        ))}
      </div>

      {/* Upcoming Events List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900">이번 달 배포 일정</h3>
        </div>
        {monthEvents.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            이번 달 예정된 배포 일정이 없습니다.
            <div className="mt-2 text-xs text-gray-300">
              content_queue에 scheduled_at 값을 설정하거나<br />
              newsletters에 sent_at 값이 있어야 캘린더에 표시됩니다.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {monthEvents
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((ev) => (
                <div key={ev.id} className="px-6 py-3 flex items-center gap-4">
                  <div className="w-12 text-center">
                    <div className="text-lg font-bold text-gray-900">{ev.date.getDate()}</div>
                    <div className="text-xs text-gray-400">{monthNames[ev.date.getMonth()]}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[ev.type] ?? ''}`}>
                        {ev.type}
                      </span>
                      {ev.channel && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CHANNEL_BADGES[ev.channel] ?? 'bg-gray-50 text-gray-600'}`}>
                          {ev.channel}
                        </span>
                      )}
                      {ev.project && (
                        <span className="text-xs text-gray-400">{ev.project}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {ev.date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
