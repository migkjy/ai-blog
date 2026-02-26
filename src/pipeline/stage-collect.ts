// projects/content-pipeline/src/pipeline/stage-collect.ts
import { collectNews, saveCollectedNews } from './collect';
import { collectYouTube } from './collect-youtube';
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
 * 병렬로 RSS + YouTube 수집을 실행하고 결과를 합친다.
 * Promise.allSettled로 개별 실패를 격리한다.
 */
async function collectAll() {
  const [rssResult, ytResult] = await Promise.allSettled([
    collectNews(),
    collectYouTube(),
  ]);

  const rssItems = rssResult.status === 'fulfilled' ? rssResult.value : [];
  const ytItems = ytResult.status === 'fulfilled' ? ytResult.value : [];

  if (rssResult.status === 'rejected') {
    console.warn(`[stage-collect] RSS 수집 실패: ${rssResult.reason}`);
  }
  if (ytResult.status === 'rejected') {
    console.warn(`[stage-collect] YouTube 수집 실패: ${ytResult.reason}`);
  }

  return {
    items: [...rssItems, ...ytItems],
    rssCount: rssItems.length,
    ytCount: ytItems.length,
  };
}

/**
 * Stage 1: RSS + YouTube 수집 + pipeline_logs 기록
 *
 * collectNews()와 collectYouTube()를 병렬 호출하고, 결과를 pipeline_logs에 기록한다.
 * 개별 피드/채널 실패는 내부에서 console.warn으로 처리 (기존 동작 유지).
 */
export async function runCollectStage(
  triggerType: TriggerType = 'scheduled'
): Promise<CollectResult> {
  const pipelineLog = await logPipelineStart('collect', triggerType);

  try {
    const { items, rssCount, ytCount } = await collectAll();
    const saved = await saveCollectedNews(items);

    const metadata = {
      rss_items: rssCount,
      youtube_items: ytCount,
      total_items: items.length,
      saved_items: saved,
      filter: 'pillar_keyword',
    };

    await logPipelineComplete(pipelineLog.id, saved, metadata);

    console.log(
      `[stage-collect] 완료: RSS ${rssCount}건 + YouTube ${ytCount}건 = ${items.length}건 수집, ${saved}건 저장`
    );

    return {
      success: true,
      itemsCollected: items.length,
      itemsSaved: saved,
      feedsOk: 0,
      feedsFail: 0,
      pipelineLogId: pipelineLog.id,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[stage-collect] 1차 실패: ${errMsg}, L1 재시도 시도...`);

    // L1: 5초 대기 후 전체 수집 1회 재시도
    const retryResult = await retryL1(
      async () => {
        const { items, rssCount, ytCount } = await collectAll();
        const saved = await saveCollectedNews(items);
        return { items, saved, rssCount, ytCount };
      },
      5000,
      'rss_collector',
      'api_error',
      errMsg
    );

    if (retryResult) {
      const { items, saved, rssCount, ytCount } = retryResult.result;
      await logPipelineComplete(pipelineLog.id, saved, {
        rss_items: rssCount,
        youtube_items: ytCount,
        total_items: items.length,
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
