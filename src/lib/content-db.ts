import { createClient } from '@libsql/client/web';

export function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

export interface Newsletter {
  id: string;
  subject: string;
  html_content: string;
  plain_content: string | null;
  status: string;
  email_service_id: string | null;
  sent_at: number | null;
  created_at: number;
  content_queue_id: string | null;
  project: string | null;
}

export interface ContentQueueItem {
  id: string;
  type: string;
  pillar: string | null;
  topic: string | null;
  status: string;
  priority: number;
  result_id: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  scheduled_at: number | null;
  channel: string | null;
  project: string | null;
  title: string | null;
  content_body: string | null;
  approved_by: string | null;
  approved_at: number | null;
  rejected_reason: string | null;
}

export interface ContentLog {
  id: string;
  content_type: string;
  content_id: string | null;
  title: string | null;
  platform: string | null;
  status: string;
  metrics: string | null;
  published_at: number;
  created_at: number;
}

export interface PipelineLog {
  id: string;
  pipeline_name: string;
  status: string;
  duration_ms: number | null;
  items_processed: number;
  error_message: string | null;
  metadata: string | null;
  created_at: number;
}

export interface NewsSource {
  source: string;
  total: number;
  latest_at: number | null;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  platform: string;
  project: string | null;
  config: string | null;
  credentials_ref: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface ContentDistribution {
  id: string;
  content_id: string;
  channel_id: string;
  platform_status: string;
  platform_id: string | null;
  platform_url: string | null;
  scheduled_at: number | null;
  published_at: number | null;
  error_message: string | null;
  retry_count: number;
  metrics: string | null;      // JSON string: { sent, delivered, opened, clicked, openRate, clickRate }
  created_at: number;
  updated_at: number;
}

export interface ErrorLog {
  id: string;
  occurred_at: number;
  component: string;
  error_type: string;
  error_message: string;
  content_id: string | null;
  channel_id: string | null;
  auto_fix_attempted: number;
  auto_fix_result: string | null;
  auto_fix_action: string | null;
  escalated: number;
  resolved_at: number | null;
  resolution_type: string | null;
}

export interface PipelineNotification {
  id: string;
  type: string;        // 'draft_created' | 'qa_failed' | 'published' | 'error_escalation' | 'review_request'
  target: string;      // 'vp' | 'ceo'
  title: string;
  body: string;
  content_id: string | null;
  pipeline_log_id: string | null;
  error_log_id: string | null;
  status: string;      // 'pending' | 'sent' | 'failed'
  sent_at: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

export async function ensureSchema(): Promise<void> {
  const db = getContentDb();
  // Legacy columns (previously added)
  await db.execute(`ALTER TABLE content_queue ADD COLUMN scheduled_at INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN channel TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN project TEXT`).catch(() => {});
  // Phase 1: content_queue approval flow columns
  await db.execute(`ALTER TABLE content_queue ADD COLUMN title TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN content_body TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN approved_by TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN approved_at INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE content_queue ADD COLUMN rejected_reason TEXT`).catch(() => {});
  // Phase 1: newsletters linkage columns
  await db.execute(`ALTER TABLE newsletters ADD COLUMN content_queue_id TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE newsletters ADD COLUMN project TEXT`).catch(() => {});
  // Phase 1: new tables (idempotent)
  await db.execute(`CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
    name TEXT NOT NULL, type TEXT NOT NULL, platform TEXT NOT NULL,
    project TEXT, config TEXT, credentials_ref TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`).catch(() => {});
  await db.execute(`CREATE TABLE IF NOT EXISTS content_distributions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
    content_id TEXT NOT NULL, channel_id TEXT NOT NULL,
    platform_status TEXT NOT NULL DEFAULT 'pending',
    platform_id TEXT, platform_url TEXT, scheduled_at INTEGER, published_at INTEGER,
    error_message TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`).catch(() => {});
  await db.execute(`CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
    occurred_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    component TEXT NOT NULL, error_type TEXT NOT NULL, error_message TEXT NOT NULL,
    content_id TEXT, channel_id TEXT,
    auto_fix_attempted INTEGER NOT NULL DEFAULT 0,
    auto_fix_result TEXT, auto_fix_action TEXT,
    escalated INTEGER NOT NULL DEFAULT 0, resolved_at INTEGER, resolution_type TEXT
  )`).catch(() => {});
  // Phase 1: pipeline_logs 확장 컬럼 (pipeline-logger에서 사용)
  await db.execute(`ALTER TABLE pipeline_logs ADD COLUMN trigger_type TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE pipeline_logs ADD COLUMN error_log_id TEXT`).catch(() => {});
  // Phase 1 시드 데이터 (channels)
  await db.execute(`INSERT OR IGNORE INTO channels (id, name, type, platform, project, config, is_active) VALUES ('ch-apppro-blog', 'AppPro 블로그', 'blog', 'apppro.kr', 'apppro', '{"publish_api":"/api/cron/publish","auto_publish":true}', 1)`).catch(() => {});
  await db.execute(`INSERT OR IGNORE INTO channels (id, name, type, platform, project, config, is_active) VALUES ('ch-brevo', 'Brevo 뉴스레터', 'newsletter', 'brevo', 'apppro', '{"list_id":8,"template":"weekly"}', 1)`).catch(() => {});
  await db.execute(`INSERT OR IGNORE INTO channels (id, name, type, platform, project, config, is_active) VALUES ('ch-twitter', 'Twitter/X', 'sns', 'twitter', NULL, '{"max_chars":280}', 0)`).catch(() => {});
  // Phase 2-B: content_distributions metrics 컬럼
  await db.execute(`ALTER TABLE content_distributions ADD COLUMN metrics TEXT`).catch(() => {});
  // Phase 2: pipeline_notifications 테이블
  await db.execute(`CREATE TABLE IF NOT EXISTS pipeline_notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    content_id TEXT,
    pipeline_log_id TEXT,
    error_log_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_status ON pipeline_notifications(status)`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON pipeline_notifications(type)`).catch(() => {});
}

export async function getNewsletters(): Promise<Newsletter[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT id, subject, status, sent_at, created_at FROM newsletters ORDER BY created_at DESC LIMIT 50',
    args: [],
  });
  return result.rows as unknown as Newsletter[];
}

export async function getNewsletterById(id: string): Promise<Newsletter | null> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM newsletters WHERE id = ? LIMIT 1',
    args: [id],
  });
  return result.rows[0] ? (result.rows[0] as unknown as Newsletter) : null;
}

export async function updateNewsletterStatus(id: string, status: string): Promise<void> {
  const db = getContentDb();
  await db.execute({
    sql: 'UPDATE newsletters SET status = ? WHERE id = ?',
    args: [status, id],
  });
}

export async function getContentQueue(): Promise<ContentQueueItem[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM content_queue ORDER BY priority DESC, created_at DESC LIMIT 100',
    args: [],
  });
  return result.rows as unknown as ContentQueueItem[];
}

export async function getScheduledContent(): Promise<ContentQueueItem[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM content_queue WHERE scheduled_at IS NOT NULL ORDER BY scheduled_at ASC LIMIT 200',
    args: [],
  });
  return result.rows as unknown as ContentQueueItem[];
}

export async function getContentLogs(): Promise<ContentLog[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM content_logs ORDER BY published_at DESC LIMIT 50',
    args: [],
  });
  return result.rows as unknown as ContentLog[];
}

export async function getPipelineLogs(): Promise<PipelineLog[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM pipeline_logs ORDER BY created_at DESC LIMIT 30',
    args: [],
  });
  return result.rows as unknown as PipelineLog[];
}

export async function getRssSourceStats(): Promise<NewsSource[]> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT source, COUNT(*) as total, MAX(created_at) as latest_at FROM collected_news GROUP BY source ORDER BY total DESC',
    args: [],
  });
  return result.rows as unknown as NewsSource[];
}

export async function getNewsStats(): Promise<{ total: number; used: number; unused: number }> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT COUNT(*) as total, SUM(used_in_newsletter) as used FROM collected_news',
    args: [],
  });
  const row = result.rows[0] as unknown as { total: number; used: number };
  return {
    total: Number(row.total) || 0,
    used: Number(row.used) || 0,
    unused: (Number(row.total) || 0) - (Number(row.used) || 0),
  };
}
