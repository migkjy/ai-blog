/**
 * SNS 배포 mock 모듈 (Phase 1).
 *
 * Phase 1에서는 SNS 채널이 is_active=0이므로 이 함수가 호출되지 않지만,
 * 만약 호출되더라도 안전하게 mock 결과를 반환한다.
 * Phase 2에서 실제 getlate.dev 연동으로 교체 예정.
 */

export interface SnsPublishResult {
  success: boolean;
  mock: boolean;
  channelId: string;
  platformId: string | null;
  error: string | null;
}

/**
 * SNS 채널에 콘텐츠 배포 (Phase 1 mock).
 *
 * 항상 mock 결과를 반환한다. content_distributions에는
 * platform_status='failed', error_message='MOCK_MODE: Phase 2' 로 기록.
 */
export async function publishToSnsMock(
  channelId: string,
  _contentId: string,
  _title: string,
  _contentBody: string,
): Promise<SnsPublishResult> {
  console.log(`[sns-mock] SNS 배포 mock: channelId=${channelId} — Phase 2에서 구현 예정`);
  return {
    success: false,
    mock: true,
    channelId,
    platformId: null,
    error: 'MOCK_MODE: SNS publishing is Phase 2',
  };
}
