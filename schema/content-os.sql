-- Content-OS Turso DB Schema
-- Database: content-os (Turso, Tokyo region)
-- Created: 2026-02-23
-- All timestamps: INTEGER (millisecond epoch via unixepoch() * 1000)
-- All IDs: TEXT (UUID v4)
-- Boolean: INTEGER (0/1)
-- JSON: TEXT

----------------------------------------------------------------------
-- 1. collected_news (기존 NeonDB 이관)
--    RSS 수집된 AI 뉴스 저장. collect.ts에서 INSERT, generate.ts에서 SELECT.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collected_news (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  title           TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  source          TEXT NOT NULL,
  lang            TEXT DEFAULT 'en',       -- 'en' | 'ko'
  grade           TEXT DEFAULT 'A',        -- 'S' | 'A' | 'B'
  category        TEXT DEFAULT 'news',     -- 'news' | 'official' | 'community' | 'research'
  summary         TEXT,
  content_snippet TEXT,
  published_at    TEXT,                    -- ISO 8601 string (from RSS feed)
  used_in_newsletter INTEGER DEFAULT 0,   -- 0=unused, 1=used
  created_at      INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_collected_news_used ON collected_news(used_in_newsletter);
CREATE INDEX IF NOT EXISTS idx_collected_news_source ON collected_news(source);
CREATE INDEX IF NOT EXISTS idx_collected_news_created ON collected_news(created_at);

----------------------------------------------------------------------
-- 2. newsletters (기존 NeonDB 이관)
--    생성된 뉴스레터 저장. generate.ts에서 INSERT, publish.ts에서 UPDATE.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletters (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  subject         TEXT NOT NULL,
  html_content    TEXT NOT NULL,
  plain_content   TEXT,
  status          TEXT DEFAULT 'draft',    -- draft, ready, sent, failed
  stibee_email_id TEXT,                    -- Stibee 발송 후 반환되는 ID
  sent_at         INTEGER,                 -- 발송 시각 (ms epoch)
  created_at      INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_newsletters_status ON newsletters(status);
CREATE INDEX IF NOT EXISTS idx_newsletters_created ON newsletters(created_at);

----------------------------------------------------------------------
-- 3. content_queue (신규)
--    콘텐츠 생성 요청 큐. 파이프라인이 이 큐에서 다음 작업을 가져감.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_queue (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  type            TEXT NOT NULL,           -- 'newsletter', 'blog', 'sns'
  pillar          TEXT,                    -- AI도구리뷰, 업종별AI가이드, 주간AI브리핑, 자동화플레이북, 프롬프트가이드
  topic           TEXT,
  status          TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  priority        INTEGER DEFAULT 0,       -- higher = more urgent
  result_id       TEXT,                    -- 생성된 결과물 ID (newsletters.id or blog_posts.id)
  error_message   TEXT,
  created_at      INTEGER DEFAULT (unixepoch() * 1000),
  updated_at      INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_type ON content_queue(type);
CREATE INDEX IF NOT EXISTS idx_content_queue_priority ON content_queue(priority DESC);

----------------------------------------------------------------------
-- 4. content_logs (신규, 부서간 연동용)
--    모든 콘텐츠 발행 이벤트 기록. Operations OS가 읽어 KR 자동 갱신.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_logs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  content_type    TEXT NOT NULL,           -- 'blog', 'newsletter', 'sns'
  content_id      TEXT,                    -- FK to newsletters.id or blog_posts.id (logical, not enforced)
  title           TEXT,
  platform        TEXT,                    -- 'blog.apppro.kr', 'stibee', 'getlate', 'twitter', 'linkedin', etc.
  status          TEXT DEFAULT 'published', -- published, draft, failed
  metrics         TEXT,                    -- JSON: {"views": 0, "clicks": 0, "subscribers": 0}
  published_at    INTEGER DEFAULT (unixepoch() * 1000),
  created_at      INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_content_logs_type ON content_logs(content_type);
CREATE INDEX IF NOT EXISTS idx_content_logs_platform ON content_logs(platform);
CREATE INDEX IF NOT EXISTS idx_content_logs_published ON content_logs(published_at);

----------------------------------------------------------------------
-- 5. pipeline_logs (신규)
--    파이프라인 실행 로그. 모니터링 및 디버깅용.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  pipeline_name   TEXT NOT NULL,           -- 'collect', 'generate', 'publish', 'blog', 'sns'
  status          TEXT NOT NULL,           -- 'started', 'completed', 'failed'
  duration_ms     INTEGER,
  items_processed INTEGER DEFAULT 0,
  error_message   TEXT,
  metadata        TEXT,                    -- JSON: {"feeds_ok": 15, "feeds_fail": 2, "dedup_count": 85}
  created_at      INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_name ON pipeline_logs(pipeline_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_status ON pipeline_logs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created ON pipeline_logs(created_at);
