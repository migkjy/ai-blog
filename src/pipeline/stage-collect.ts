// projects/content-pipeline/src/pipeline/stage-collect.ts
import { collectNews, saveCollectedNews } from './collect';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  logError,
  type TriggerType,
} from '../lib/pipeline-logger';
import { retryL1, escalateL5 } from '../lib/self-healing';

export interface CollectResult {
  success: boolean;
  itemsCollected: number;
  itemsSaved: number;
  feedsOk: number;
  feedsFail: number;
  pipelineLogId: string;
}

/**
 * Stage 1: RSS 수집 + pipeline_logs 기록
 *
 * 기존 collectNews()를 호출하고, 결과를 pipeline_logs에 기록한다.
 * 개별 피드 실패는 collectNews() 내부에서 console.warn으로 처리 (기존 동작 유지).
 */
export async function runCollectStage(
  triggerType: TriggerType = 'scheduled'
): Promise<CollectResult> {
  const pipelineLog = await logPipelineStart('collect', triggerType);

  try {
    // 기존 collectNews: RSS 파싱 + 중복 제거 + 필라 필터링
    const items = await collectNews();
    const saved = await saveCollectedNews(items);

    // 피드 통계 추정 (collectNews 내부 로그에서 출력되는 값을 기반)
    // 정확한 값을 위해 collectNews가 통계를 반환하도록 하면 좋으나,
    // 기존 코드 변경 최소화를 위해 전체 items 수로 대체
    const metadata = {
      raw_items: items.length,
      saved_items: saved,
      filter: 'pillar_keyword',
    };

    await logPipelineComplete(pipelineLog.id, saved, metadata);

    console.log(`[stage-collect] 완료: ${items.length}건 수집, ${saved}건 저장`);

    return {
      success: true,
      itemsCollected: items.length,
      itemsSaved: saved,
      feedsOk: 0, // collectNews가 통계를 반환하지 않으므로 0 (Phase 2에서 개선)
      feedsFail: 0,
      pipelineLogId: pipelineLog.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[stage-collect] 1차 실패: ${errMsg}, L1 재시도 시도...`);

    // L1: 5초 대기 후 전체 수집 1회 재시도
    const retryResult = await retryL1(
      async () => {
        const items = await collectNews();
        const saved = await saveCollectedNews(items);
        return { items, saved };
      },
      5000,
      'rss_collector',
      'api_error',
      errMsg
    );

    if (retryResult) {
      const { items, saved } = retryResult.result;
      await logPipelineComplete(pipelineLog.id, saved, {
        raw_items: items.length,
        saved_items: saved,
        filter: 'pillar_keyword',
        self_healing: 'L1_retry_success',
      });

      console.log(`[stage-collect] L1 재시도 성공: ${items.length}건 수집, ${saved}건 저장`);
      return {
        success: true,
        itemsCollected: items.length,
        itemsSaved: saved,
        feedsOk: 0,
        feedsFail: 0,
        pipelineLogId: pipelineLog.id,
      };
    }

    // L1 재시도도 실패 → auth_fail이면 L5, 아니면 에러 기록만
    const isAuthFail = errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('401') || errMsg.toLowerCase().includes('403');
    if (isAuthFail) {
      await escalateL5('rss_collector', 'auth_fail', errMsg);
    }

    const errorLogId = await logError('rss_collector', 'api_error', `L1 재시도 포함 최종 실패: ${errMsg}`);
    await logPipelineFailed(pipelineLog.id, errMsg, errorLogId);

    console.error(`[stage-collect] 최종 실패: ${errMsg}`);
    return {
      success: false,
      itemsCollected: 0,
      itemsSaved: 0,
      feedsOk: 0,
      feedsFail: 0,
      pipelineLogId: pipelineLog.id,
    };
  }
}
