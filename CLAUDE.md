# Content Pipeline - AI 콘텐츠 자동 생성/배포 파이프라인

## 프로젝트 개요

AI 기반 주간 뉴스레터 + 블로그 자동 생성/배포 시스템.
CEO 개입 최소화(주 15분 이하)로 고품질 콘텐츠를 자동 생산하는 파이프라인.

## 태스크 ID

`2cb751a5-ec2d-4d27-bafb-601f664abc98` (컨텐츠 자동화 시스템 구축 + SNS 멀티채널 운영)

## MVP 스펙 (v0.1)

### 핵심 기능
1. **AI 뉴스 수집**: RSS/API로 AI 관련 뉴스/트렌드 자동 수집
2. **콘텐츠 생성**: Claude Sonnet API로 주간 뉴스레터 원고 자동 생성
3. **뉴스레터 발행**: Brevo API로 자동 발송 (이메일 캠페인 + 구독자 관리)
4. **블로그 포스팅**: 뉴스레터 콘텐츠를 Next.js 블로그에 자동 게시

### MVP Cut (v0.2 이후)
- SNS 멀티채널 배포 (getlate.dev, v0.2)
- 영상 콘텐츠 ($50-100/월 고비용)
- SEO 엔진 자동화
- 유료 구독 모델
- 커스텀 CMS

## 기술 스택

| 구성요소 | 기술 | 비고 |
|---------|------|------|
| 프레임워크 | Next.js (App Router) | CEO 방침: 모든 웹은 Next.js |
| 콘텐츠 생성 | Claude Sonnet API | 월 $0.80 (16건 기준) |
| 뉴스레터 | Brevo API (@getbrevo/brevo) | CEO API키 발급 중 |
| 블로그 | Next.js SSG/ISR | SEO 최적화 |
| 뉴스 수집 | RSS + 웹 크롤링 (CLI/API) | n8n 사용 금지 |
| 배포 | Vercel | 초기 저비용 |
| DB | Turso (LibSQL) | apppro-kr DB 공유 |
| SNS (v0.2) | getlate.dev | 멀티플랫폼 배포 |

## 콘텐츠 전략

### 5대 콘텐츠 필라
1. AI 도구 리뷰 (실전 사용기)
2. 업종별 AI 가이드 (블루오션)
3. 주간 AI 브리핑 (뉴스레터 메인)
4. 자동화 플레이북 (How-to)
5. 프롬프트 템플릿

### 타겟
- 한국 SMB/소상공인
- AI에 관심 있지만 실전 활용법을 모르는 비즈니스 오너

## 비용

| 항목 | v0.1 | v0.2 |
|------|------|------|
| Claude API | $0.80/월 | $3-5/월 |
| Brevo | 무료 (300통/일) | Starter $9/월 |
| Vercel | 무료 (Hobby) | Pro $20/월 |
| **합계** | **~$1.50/월** | **~$5-15/월** |

## 자동화 목표

```json
{
  "ceo_initial": ["콘텐츠 방향 결정", "첫 뉴스레터 검수"],
  "ai_initial": ["파이프라인 구축", "프롬프트 설계", "블로그 셋업", "Brevo API 연동"],
  "ceo_ongoing": ["주 1회 15분 검수 (선택사항)"],
  "ai_ongoing": ["뉴스 수집", "콘텐츠 생성", "뉴스레터 발송", "블로그 게시"],
  "automation_goal": "high"
}
```

## 파이프라인 흐름

```
[뉴스 수집 (RSS/API)] → [AI 가공 (Claude Sonnet)] → [뉴스레터 생성]
                                                          ↓
                                                   [Brevo API 발송]
                                                          ↓
                                                   [블로그 자동 게시]
                                                          ↓
                                              [SNS 배포 (v0.2, getlate.dev)]
```

## 디렉토리 구조 (권장)

```
content-pipeline/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── .env.local              # 로컬 환경 변수 (gitignore)
├── .env.example            # 환경 변수 템플릿
├── src/
│   ├── app/                # Next.js App Router (블로그 프론트엔드)
│   │   ├── layout.tsx
│   │   ├── page.tsx        # 블로그 홈
│   │   └── posts/
│   │       └── [slug]/
│   │           └── page.tsx  # 개별 포스트 페이지 (SSG/ISR)
│   ├── pipeline/           # 콘텐츠 파이프라인 (CLI 스크립트)
│   │   ├── collect.ts      # 뉴스 수집 (RSS 파싱)
│   │   ├── generate.ts     # AI 콘텐츠 생성 (Claude API)
│   │   ├── publish.ts      # 블로그 게시 + SNS 배포
│   │   └── run.ts          # 파이프라인 오케스트레이터
│   ├── lib/
│   │   ├── db.ts           # NeonDB 연결
│   │   ├── claude.ts       # Claude API 클라이언트
│   │   └── rss.ts          # RSS 파서
│   └── types/
│       └── index.ts        # 공통 타입 정의
├── prompts/                # 프롬프트 템플릿
│   └── newsletter.md       # 뉴스레터 생성 프롬프트
└── drizzle/                # DB 마이그레이션 (콘텐츠 테이블)
```

## 빌드 & 실행

```bash
# 의존성 설치
npm install

# 개발 서버 (블로그)
npm run dev

# 프로덕션 빌드
npm run build

# 파이프라인 실행 (수동, 1회)
npm run pipeline

# 파이프라인 실행 (스케줄 - 주 1회)
npm run pipeline:schedule
```

## 환경 변수

| 변수 | 필수 | 발급 방법 |
|------|------|----------|
| `TURSO_DB_URL` | 필수 | apppro-kr Turso DB URL |
| `TURSO_DB_TOKEN` | 필수 | apppro-kr Turso 인증 토큰 |
| `ANTHROPIC_API_KEY` | 필수 | CEO가 https://console.anthropic.com 에서 발급 |

```bash
# .env.local
TURSO_DB_URL=libsql://apppro-kr-migkjy.aws-ap-northeast-1.turso.io
TURSO_DB_TOKEN=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

## 뉴스 수집 소스 (RSS)

MVP에서 사용할 AI 뉴스 RSS 피드 후보:
- **The Verge AI**: `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml`
- **TechCrunch AI**: `https://techcrunch.com/category/artificial-intelligence/feed/`
- **MIT Technology Review AI**: `https://www.technologyreview.com/topic/artificial-intelligence/feed`
- **OpenAI Blog**: `https://openai.com/blog/rss.xml`
- **AI News (한국)**: 국내 AI 관련 RSS 추가 조사 필요 (PL 착수 시)

> PL 참고: 한국 SMB 타겟이므로 해외 뉴스를 한국어로 가공하고, 한국 시장 관점 인사이트를 추가하는 것이 핵심 차별점.

## 이메일 발송 (Brevo — 연동 중)

- **SDK**: `@getbrevo/brevo`
- **API Key**: CEO 발급 중 (BREVO_API_KEY)
- **상태**: 코드 작성 중 (Stibee 제거 완료, Brevo 전환)

## 프로젝트 경로

`/Users/nbs22/(Claude)/(claude).projects/business-builder/projects/content-pipeline/`
