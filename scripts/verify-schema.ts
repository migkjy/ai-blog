import { ensureSchema } from '../src/lib/content-db';

async function main() {
  console.log('[verify] ensureSchema 실행 중...');
  await ensureSchema();
  console.log('[verify] 완료.');

  // content-os DB에 직접 연결하여 테이블 존재 확인
  const { createClient } = await import('@libsql/client/web');
  const db = createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('[verify] 테이블 목록:', tables.rows.map(r => r.name));

  // channels 시드 확인
  const channels = await db.execute("SELECT id, name, type, is_active FROM channels");
  console.log('[verify] channels:', channels.rows);

  // content_queue 확장 컬럼 확인
  const cqInfo = await db.execute("PRAGMA table_info(content_queue)");
  console.log('[verify] content_queue 컬럼:', cqInfo.rows.map(r => r.name));

  // pipeline_logs error_log_id 컬럼 확인
  const plInfo = await db.execute("PRAGMA table_info(pipeline_logs)");
  console.log('[verify] pipeline_logs 컬럼:', plInfo.rows.map(r => r.name));
}

main().catch(console.error);
