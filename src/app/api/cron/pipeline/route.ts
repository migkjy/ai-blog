// projects/content-pipeline/src/app/api/cron/pipeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runCollectStage } from '../../../../pipeline/stage-collect';
import { runGenerateStage } from '../../../../pipeline/stage-generate';
import { ensureSchema } from '../../../../lib/content-db';
import { runSelfHealingCycle } from '../../../../lib/self-healing';

/**
 * GET /api/cron/pipeline
 *
 * Vercel Cron: 매일 06:00 KST (UTC 21:00) 월~금 실행
 * Stage 1(수집) → Stage 2(생성) 순차 실행
 * Stage 3(승인)은 CEO 대시보드에서 수동
 * Stage 4(발행)는 승인 API에서 자동 트리거
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET 인증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[cron/pipeline] 파이프라인 시작');
  const startTime = Date.now();

  try {
    // DB 스키마 확인 (멱등)
    await ensureSchema();

    // Self-Healing: 이전 실행 잔류 에러 교정
    console.log('[cron/pipeline] Self-Healing 사이클 실행...');
    const healingReport = await runSelfHealingCycle();
    if (healingReport.total > 0) {
      console.log(`[cron/pipeline] Self-Healing: ${healingReport.total}건 스캔, ${healingReport.fixed}건 교정, ${healingReport.escalated}건 에스컬레이션`);
    }

    // Stage 1: RSS 수집
    console.log('[cron/pipeline] Stage 1: 수집...');
    const collectResult = await runCollectStage('scheduled');

    if (!collectResult.success) {
      console.error('[cron/pipeline] Stage 1 실패, 파이프라인 중단');
      return NextResponse.json({
        stage: 'collect',
        success: false,
        error: 'RSS 수집 실패',
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }

    // Stage 2: AI 콘텐츠 생성
    console.log('[cron/pipeline] Stage 2: 생성...');
    const generateResult = await runGenerateStage(undefined, undefined, 'scheduled');

    const duration = Date.now() - startTime;
    console.log(`[cron/pipeline] 파이프라인 완료 (${duration}ms)`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      selfHealing: healingReport.total > 0 ? healingReport : null,
      collect: {
        itemsCollected: collectResult.itemsCollected,
        itemsSaved: collectResult.itemsSaved,
      },
      generate: {
        success: generateResult.success,
        contentQueueId: generateResult.contentQueueId,
        title: generateResult.title,
        qaScore: generateResult.qaScore,
      },
      nextStep: generateResult.success
        ? `CEO 승인 대기: POST /api/pipeline/approve { "contentId": "${generateResult.contentQueueId}" }`
        : '생성 실패 — 수동 재실행 필요',
    });
  } catch (err) {
    console.error('[cron/pipeline] 오류:', err);
    return NextResponse.json({ error: 'Pipeline error', detail: String(err) }, { status: 500 });
  }
}
