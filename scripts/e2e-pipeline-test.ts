// projects/content-pipeline/scripts/e2e-pipeline-test.ts
import { ensureSchema } from '../src/lib/content-db';
import { runCollectStage } from '../src/pipeline/stage-collect';
import { runGenerateStage } from '../src/pipeline/stage-generate';
import { runPublishStage } from '../src/pipeline/stage-publish';
import { createClient } from '@libsql/client/web';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

async function main() {
  console.log('=== E2E 파이프라인 테스트 ===\n');

  // 0. 스키마 확인
  console.log('--- Step 0: DB 스키마 확인 ---');
  await ensureSchema();
  console.log('OK\n');

  // 1. Stage 1: 수집
  console.log('--- Stage 1: RSS 수집 ---');
  const collectResult = await runCollectStage('manual');
  console.log(`수집 결과: ${collectResult.success ? 'OK' : 'FAIL'}`);
  console.log(`  수집: ${collectResult.itemsCollected}건, 저장: ${collectResult.itemsSaved}건\n`);

  if (!collectResult.success) {
    console.error('Stage 1 실패. 중단.');
    process.exit(1);
  }

  // 2. Stage 2: 생성
  console.log('--- Stage 2: AI 콘텐츠 생성 ---');
  const generateResult = await runGenerateStage(
    '소상공인을 위한 AI 고객 응대 자동화',
    'AI도구리뷰',
    'manual'
  );
  console.log(`생성 결과: ${generateResult.success ? 'OK' : 'FAIL'}`);
  console.log(`  제목: ${generateResult.title}`);
  console.log(`  QA 점수: ${generateResult.qaScore}/8`);
  console.log(`  content_queue ID: ${generateResult.contentQueueId}\n`);

  if (!generateResult.success || !generateResult.contentQueueId) {
    console.error('Stage 2 실패. 중단.');
    process.exit(1);
  }

  // 3. Stage 3: 승인 (수동 시뮬레이션)
  console.log('--- Stage 3: 승인 (자동 시뮬레이션) ---');
  const db = getContentDb();
  const now = Date.now();
  await db.execute({
    sql: `UPDATE content_queue SET status = 'approved', approved_by = 'e2e-test', approved_at = ?, updated_at = ? WHERE id = ?`,
    args: [now, now, generateResult.contentQueueId],
  });
  console.log(`승인 완료: ${generateResult.contentQueueId}\n`);

  // 4. Stage 4: 발행
  console.log('--- Stage 4: 블로그 발행 ---');
  const publishResult = await runPublishStage(generateResult.contentQueueId, 'manual');
  console.log(`발행 결과: ${publishResult.success ? 'OK' : 'FAIL'}`);
  console.log(`  blog_post ID: ${publishResult.blogPostId}`);
  console.log(`  distribution ID: ${publishResult.distributionId}\n`);

  // 5. 검증
  console.log('--- 최종 검증 ---');

  // content_queue status 확인
  const cqResult = await db.execute({
    sql: 'SELECT status FROM content_queue WHERE id = ?',
    args: [generateResult.contentQueueId],
  });
  const cqStatus = cqResult.rows[0]?.status;
  console.log(`content_queue.status: ${cqStatus} ${cqStatus === 'published' ? 'OK' : 'FAIL'}`);

  // pipeline_logs 확인
  const plResult = await db.execute({
    sql: 'SELECT pipeline_name, status FROM pipeline_logs ORDER BY created_at DESC LIMIT 10',
    args: [],
  });
  console.log(`pipeline_logs: ${plResult.rows.length}건`);
  for (const row of plResult.rows) {
    console.log(`  ${row.pipeline_name}: ${row.status}`);
  }

  // content_distributions 확인
  const distResult = await db.execute({
    sql: 'SELECT platform_status, platform_url FROM content_distributions WHERE content_id = ?',
    args: [generateResult.contentQueueId],
  });
  console.log(`content_distributions: ${distResult.rows.length}건`);
  for (const row of distResult.rows) {
    console.log(`  ${row.platform_status}: ${row.platform_url}`);
  }

  // content_logs 확인
  const clResult = await db.execute({
    sql: 'SELECT content_type, platform, status FROM content_logs ORDER BY created_at DESC LIMIT 5',
    args: [],
  });
  console.log(`content_logs: ${clResult.rows.length}건`);

  console.log('\n=== E2E 테스트 완료 ===');
  console.log(publishResult.success ? 'PASS' : 'FAIL');
}

main().catch((err) => {
  console.error('E2E 테스트 오류:', err);
  process.exit(1);
});
