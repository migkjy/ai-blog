# Project History

## 주요 마일스톤

### Phase 1: MVP (2026-02)
- Next.js App Router 기반 블로그 프론트엔드 구축
- 콘텐츠 파이프라인 CLI 구현 (collect -> generate -> publish)
- Vercel Cron 자동화 설정
- 파이프라인 대시보드 UI (5 APIs, 4 pages, 12 components)
- Self-healing L2 구현 (L1/L2/L5 자체교정 시스템)
- 외부 연동 L2 구현 (channels 기반 다채널 배포)
- content-orchestration Phase 1 완료

### Phase 1.5: 안정화 (2026-02 ~ 03)
- NeonDB -> Turso 마이그레이션 (apppro-kr DB 공유)
- Stibee -> Brevo 이메일 서비스 전환
- Claude API fallback 추가 (Google API 미설정 시)
- OpenRouter 통합 (CEO 지정 우선순위 1순위)
- Brevo SOURCE='content-pipeline' 속성 추가 (구독자 세그멘테이션)
- OKR 자동 연동 (포스트 게시 시 KR3-1 자동 증가)

### 주요 버그 수정
- AI타임스 RSS 카테고리 필터링 (비AI 기사 오염 방지)
- Claude API max_tokens 4000->8000 (콘텐츠 잘림 방지)
- BLOG_DB_URL 환경변수 분리 (Vercel vs 로컬)
- Vercel preview 배포 비활성화 (배포 제한 절약)
