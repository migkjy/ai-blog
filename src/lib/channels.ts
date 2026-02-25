import { createClient } from '@libsql/client/web';

function getContentDb() {
  return createClient({
    url: process.env.CONTENT_OS_DB_URL!,
    authToken: process.env.CONTENT_OS_DB_TOKEN!,
  });
}

export interface Channel {
  id: string;
  name: string;
  type: string;       // 'blog' | 'newsletter' | 'sns'
  platform: string;   // 'apppro.kr' | 'brevo' | 'twitter' | 'linkedin'
  project: string | null;
  config: string | null;
  credentials_ref: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface ChannelConfig {
  [key: string]: unknown;
}

/**
 * 활성 채널 목록 조회.
 * is_active=1인 채널만 반환.
 * type으로 필터 가능 (예: 'blog', 'newsletter', 'sns').
 */
export async function getActiveChannels(type?: string): Promise<Channel[]> {
  const db = getContentDb();

  let sql = 'SELECT * FROM channels WHERE is_active = 1';
  const args: (string | number)[] = [];

  if (type) {
    sql += ' AND type = ?';
    args.push(type);
  }

  sql += ' ORDER BY created_at ASC';

  const result = await db.execute({ sql, args });
  return result.rows as unknown as Channel[];
}

/**
 * 채널 ID로 조회.
 */
export async function getChannelById(id: string): Promise<Channel | null> {
  const db = getContentDb();
  const result = await db.execute({
    sql: 'SELECT * FROM channels WHERE id = ? LIMIT 1',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Channel) : null;
}

/**
 * 채널의 config JSON을 파싱.
 * 파싱 실패 시 빈 객체 반환.
 */
export function parseChannelConfig(channel: Channel): ChannelConfig {
  if (!channel.config) return {};
  try {
    return JSON.parse(channel.config);
  } catch {
    return {};
  }
}

/**
 * 채널의 credentials_ref에 대응하는 환경변수 값을 반환.
 * 미설정 시 null (mock 모드 진입용).
 */
export function getChannelCredential(channel: Channel): string | null {
  if (!channel.credentials_ref) return null;
  return process.env[channel.credentials_ref] || null;
}
