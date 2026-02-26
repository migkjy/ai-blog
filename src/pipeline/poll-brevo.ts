// projects/content-pipeline/src/pipeline/poll-brevo.ts
import { getContentDb } from '../lib/content-db';
import { getCampaignStatus, getBrevoStatus } from '../lib/brevo';

export interface PollBrevoResult {
  polled: number;
  updated: number;
  errors: number;
}

export async function runPollBrevo(): Promise<PollBrevoResult> {
  const brevoStatus = getBrevoStatus();
  if (!brevoStatus.configured) {
    console.log('[poll-brevo] Brevo API 미설정, 스킵');
    return { polled: 0, updated: 0, errors: 0 };
  }

  const db = getContentDb();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const result = await db.execute({
    sql: `SELECT id, platform_id, platform_status, metrics, updated_at
          FROM content_distributions
          WHERE channel_id = 'ch-brevo'
            AND platform_status IN ('published', 'registered')
            AND platform_id IS NOT NULL
            AND (metrics IS NULL OR updated_at < ?)
          ORDER BY updated_at ASC
          LIMIT 10`,
    args: [oneHourAgo],
  });

  const rows = result.rows as unknown as {
    id: string;
    platform_id: string;
    platform_status: string;
    metrics: string | null;
    updated_at: number;
  }[];

  if (rows.length === 0) {
    console.log('[poll-brevo] 폴링 대상 없음');
    return { polled: 0, updated: 0, errors: 0 };
  }

  console.log(`[poll-brevo] 폴링 대상 ${rows.length}건`);

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const campaignId = parseInt(row.platform_id, 10);
    if (isNaN(campaignId)) {
      errors++;
      continue;
    }

    const stats = await getCampaignStatus(campaignId);
    if (!stats || !stats.success) {
      errors++;
      continue;
    }

    const now = Date.now();
    const metricsJson = JSON.stringify(stats);
    const newStatus = (stats.status === 'sent' || stats.status === 'archive') ? 'published' : row.platform_status;

    await db.execute({
      sql: `UPDATE content_distributions SET metrics = ?, platform_status = ?, updated_at = ? WHERE id = ?`,
      args: [metricsJson, newStatus, now, row.id],
    });

    const openRate = stats.opens != null && stats.delivered ? Math.round((stats.opens / stats.delivered) * 100) : 0;
    console.log(`[poll-brevo] 업데이트: dist.id=${row.id}, campaign=${campaignId}, opens=${stats.opens ?? 0}, openRate=${openRate}%`);
    updated++;
  }

  console.log(`[poll-brevo] 완료: polled=${rows.length}, updated=${updated}, errors=${errors}`);
  return { polled: rows.length, updated, errors };
}
