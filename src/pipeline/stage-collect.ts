// projects/content-pipeline/src/pipeline/stage-collect.ts
import { collectNews, saveCollectedNews } from './collect';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineFailed,
  logError,
  type TriggerType,
} from '../lib/pipeline-logger';

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
    const errorLogId = await logError('rss_collector', 'api_error', errMsg);
    await logPipelineFailed(pipelineLog.id, errMsg, errorLogId);

    console.error(`[stage-collect] 실패: ${errMsg}`);

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
