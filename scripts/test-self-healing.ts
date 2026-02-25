// projects/content-pipeline/scripts/test-self-healing.ts
import { createClient } from '@libsql/client/web';
import { logError } from '../src/lib/pipeline-logger';
import {
  detectErrors,
  classifyError,
  runSelfHealingCycle,
} from '../src/lib/self-healing';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

async function main() {
  console.log('=== Self-Healing 통합 테스트 시작 ===\n');

  // 1. 테스트 에러 생성
  console.log('[테스트 1] 에러 로그 생성...');
  const err1 = await logError('rss_collector', 'timeout', '테스트: RSS 타임아웃');
  const err2 = await logError('ai_generator', 'api_error', '테스트: AI API 500 오류');
  const err3 = await logError('publisher', 'auth_fail', '테스트: DB 인증 실패');
  console.log(`  생성된 에러: ${err1}, ${err2}, ${err3}`);

  // 2. detectErrors 테스트
  console.log('\n[테스트 2] detectErrors()...');
  const detected = await detectErrors();
  console.log(`  감지된 미해결 에러: ${detected.length}건`);
  for (const e of detected) {
    console.log(`    - ${e.id.slice(0, 8)}... ${e.component}:${e.error_type}`);
  }

  // 3. classifyError 테스트
  console.log('\n[테스트 3] classifyError()...');
  for (const e of detected) {
    const classification = classifyError(e as any);
    console.log(`    ${e.component}:${e.error_type} → ${classification.level} (${classification.autoFixAction})`);
  }

  // 4. runSelfHealingCycle 테스트
  console.log('\n[테스트 4] runSelfHealingCycle()...');
  const report = await runSelfHealingCycle();
  console.log(`  결과: total=${report.total}, fixed=${report.fixed}, escalated=${report.escalated}, skipped=${report.skipped}`);

  // 5. DB 상태 확인
  console.log('\n[테스트 5] DB 상태 확인...');
  const db = getContentDb();
  const errors = await db.execute({
    sql: `SELECT id, component, error_type, auto_fix_attempted, auto_fix_result, escalated
          FROM error_logs
          WHERE id IN (?, ?, ?)`,
    args: [err1, err2, err3],
  });
  for (const row of errors.rows) {
    console.log(`  ${(row.id as string).slice(0, 8)}... ${row.component}:${row.error_type} → attempted=${row.auto_fix_attempted}, result=${row.auto_fix_result}, escalated=${row.escalated}`);
  }

  // 6. 정리 (테스트 에러 삭제)
  console.log('\n[정리] 테스트 에러 삭제...');
  await db.execute({ sql: 'DELETE FROM error_logs WHERE id IN (?, ?, ?)', args: [err1, err2, err3] });
  // self-healing pipeline_logs도 삭제
  await db.execute({ sql: "DELETE FROM pipeline_logs WHERE pipeline_name = 'self-healing' AND created_at > ?", args: [Date.now() - 60000] });
  console.log('  완료');

  console.log('\n=== Self-Healing 통합 테스트 완료 ===');
}

main().catch(console.error);
