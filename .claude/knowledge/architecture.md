# Architecture

## 디렉토리 구조
```
content-pipeline/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/cron/        # Vercel Cron (pipeline, publish)
│   │   ├── api/pipeline/    # 파이프라인 API
│   │   ├── api/subscribe/   # 구독 API
│   │   ├── api/track/       # 추적 API
│   │   ├── pipeline/        # 파이프라인 대시보드 UI
│   │   └── posts/[slug]/    # 블로그 포스트 페이지
│   ├── pipeline/            # CLI 파이프라인 스크립트
│   │   ├── collect.ts       # RSS 뉴스 수집
│   │   ├── generate.ts      # AI 콘텐츠 생성
│   │   ├── generate-blog.ts # 블로그 전용 생성
│   │   ├── publish.ts       # 블로그 게시
│   │   ├── publish-blog.ts  # 블로그 게시 (단독)
│   │   ├── publish-sns.ts   # SNS 배포 (getlate.dev)
│   │   ├── run.ts           # 전체 파이프라인 오케스트레이터
│   │   └── run-blog-pipeline.ts # 블로그 파이프라인
│   ├── lib/                 # 공통 라이브러리
│   ├── components/          # React 컴포넌트
│   ├── config/              # 설정
│   ├── actions/             # Server Actions
│   └── styles/              # CSS
├── scripts/                 # 유틸리티 스크립트 (마이그레이션, 디버그)
├── prompts/                 # AI 프롬프트 템플릿
├── schema/                  # DB 스키마
├── emails/                  # 이메일 템플릿
└── docs/                    # 문서
```

## 파이프라인 흐름
```
RSS 수집 (collect) → AI 가공 (generate, Claude/OpenRouter) → 뉴스레터 생성
                                                                  ↓
                                                            Brevo 발송
                                                                  ↓
                                                         블로그 게시 (publish)
                                                                  ↓
                                                        SNS 배포 (getlate.dev)
```

## DB 연결
| DB | 용도 | 환경변수 |
|----|------|---------|
| apppro-kr Turso | 블로그 포스트, 구독자 | TURSO_DB_URL, BLOG_DB_URL |
| content-os Turso | 콘텐츠 OS 데이터 | CONTENT_OS_DB_URL |
| kanban Turso | OKR 자동 업데이트 | KANBAN_DB_URL |

## 배포 구조
- **Vercel**: main + production 브랜치 자동 배포
- **Cron Jobs**: Vercel Cron (publish 매일 21:00 UTC, pipeline 월-금 21:00 UTC)
- **Preview 배포 비활성화** (Vercel 배포 제한 절약)

## AI API 우선순위
1. OPENROUTER_API_KEY (CEO 지정 통합 API)
2. ANTHROPIC_API_KEY (Claude 직접)
3. GOOGLE_API_KEY (Gemini fallback)
