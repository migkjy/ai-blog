# Content-OS DB Schema

Turso (SQLite) 스키마 — content-os 전용 DB.

## 테이블 목록

| # | 테이블 | 용도 | 출처 |
|---|--------|------|------|
| 1 | `collected_news` | RSS 수집 뉴스 저장 | NeonDB 이관 |
| 2 | `newsletters` | 생성된 뉴스레터 저장 | NeonDB 이관 |
| 3 | `content_queue` | 콘텐츠 생성 요청 큐 | 신규 |
| 4 | `content_logs` | 발행 이벤트 기록 (부서간 연동) | 신규 |
| 5 | `pipeline_logs` | 파이프라인 실행 로그 | 신규 |

## 설계 원칙

- **ID**: UUID v4 (TEXT, SQLite `randomblob` 기반 자동 생성)
- **Timestamp**: INTEGER (밀리초 epoch, `unixepoch() * 1000`)
- **Boolean**: INTEGER (0/1)
- **JSON**: TEXT 타입에 JSON 문자열 저장
- **AUTOINCREMENT 미사용**: UUID 기반 PK

## 테이블 상세

### 1. collected_news

RSS 피드에서 수집한 AI 뉴스. `collect.ts`에서 INSERT, `generate.ts`에서 미사용 뉴스를 SELECT.

NeonDB 대비 추가 컬럼: `lang`, `grade`, `category` — 기존 코드에서 CollectedItem 인터페이스에는 있었으나 DB에 저장하지 않던 필드. Turso 이관 시 저장하여 필터링 성능 향상.

### 2. newsletters

AI가 생성한 뉴스레터. `generate.ts`에서 INSERT, `publish.ts`에서 Stibee 발송 후 status/stibee_email_id 업데이트.

### 3. content_queue

콘텐츠 생성 요청 큐. 파이프라인 오케스트레이터(`run.ts`)가 이 큐에서 pending 작업을 가져와 처리.

- `type`: newsletter / blog / sns
- `pillar`: 5대 콘텐츠 필라 (AI도구리뷰, 업종별AI가이드, 주간AI브리핑, 자동화플레이북, 프롬프트가이드)
- `result_id`: 생성 완료 후 결과물 ID (newsletters.id 또는 blog_posts.id)

### 4. content_logs

모든 콘텐츠 발행 이벤트를 기록. **Operations OS(칸반)가 이 테이블을 읽어 OKR KR 자동 갱신**에 사용.

- `metrics`: JSON 형태로 조회수, 클릭수, 구독자수 등 저장
- `platform`: 발행 플랫폼 (blog.apppro.kr, stibee, twitter, linkedin 등)

### 5. pipeline_logs

파이프라인 실행 로그. 모니터링 대시보드 및 디버깅에 활용.

- `metadata`: JSON 형태로 실행 세부 정보 저장 (피드 성공/실패 수, 중복제거 수 등)

## 실행 방법

```bash
# Turso CLI로 실행
turso db shell content-os < schema/content-os.sql
```

## 인덱스

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| collected_news | `idx_collected_news_used` | 미사용 뉴스 빠른 조회 |
| collected_news | `idx_collected_news_source` | 소스별 필터링 |
| collected_news | `idx_collected_news_created` | 최신순 정렬 |
| newsletters | `idx_newsletters_status` | 상태별 필터링 (draft/sent) |
| newsletters | `idx_newsletters_created` | 최신순 정렬 |
| content_queue | `idx_content_queue_status` | pending 작업 빠른 조회 |
| content_queue | `idx_content_queue_type` | 타입별 필터링 |
| content_queue | `idx_content_queue_priority` | 우선순위 정렬 |
| content_logs | `idx_content_logs_type` | 콘텐츠 타입별 집계 |
| content_logs | `idx_content_logs_platform` | 플랫폼별 집계 |
| content_logs | `idx_content_logs_published` | 기간별 발행 현황 |
| pipeline_logs | `idx_pipeline_logs_name` | 파이프라인별 필터 |
| pipeline_logs | `idx_pipeline_logs_status` | 성공/실패 필터 |
| pipeline_logs | `idx_pipeline_logs_created` | 최신 로그 조회 |
