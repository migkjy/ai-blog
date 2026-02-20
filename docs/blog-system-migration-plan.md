# apppro 블로그 시스템 기획서: WP→Next.js 전환 + AI 자동화

> 작성: 자비스 총괄이사 | 2026-02-20
> 상태: 맥클로 VP 검수 대기
> AI Queue #2

---

## 1. 현재 상태 분석

### 1-1. 기존 WordPress 블로그

| 항목 | 현재 |
|---|---|
| URL | blog.apppro.kr |
| 플랫폼 | WordPress |
| 콘텐츠 | ~95건 blog_posts (DB에 보존됨) |
| 카테고리 | Cryptocurrency, Programming, Technologies, Uncategorized |
| 문제점 | 수동 관리, AI 자동화 불가, CEO 방침(Next.js 전환) 미반영 |

### 1-2. content-pipeline 프로젝트 (이미 구축됨)

**이미 구축된 것:**

| 구성요소 | 상태 | 상세 |
|---|---|---|
| Next.js 블로그 프론트엔드 | ✅ 구축됨 | App Router, SSG/ISR, 포스트 페이지, RSS, sitemap, robots.ts, OG 이미지 |
| AI 콘텐츠 생성 파이프라인 | ✅ 구축됨 | Claude Sonnet API, RSS 수집, 뉴스레터/블로그 생성 스크립트 |
| WP 마이그레이션 스크립트 | ✅ 구축됨 | `scripts/migrate-wp.ts` - WP REST API에서 포스트 fetch → DB INSERT |
| SNS 배포 스크립트 | ✅ 구축됨 | `publish:sns` - getlate.dev 연동 |
| GitHub 연동 | ✅ 완료 | `migkjy/ai-blog` |
| Vercel 연동 | ✅ 완료 | 프로젝트명: `content-pipeline` |
| 콘텐츠 전략 | ✅ 문서화 | 5대 필라, RSS 23개 소스, 콘텐츠 캘린더 |

**미완료 (Gap 분석):**

| 항목 | 상태 | 설명 |
|---|---|---|
| WP 데이터 마이그레이션 실행 | ❌ 미실행 | 스크립트 있으나 아직 실행 안 함 (95건 이전 필요) |
| blog.apppro.kr 도메인 연결 | ❌ 미설정 | Vercel 커스텀 도메인 미설정 (blog.apppro.kr → Next.js) |
| AI 파이프라인 실행/검증 | ❌ 미검증 | 파이프라인 코드 있으나 실제 실행+CEO 검수 안 됨 |
| Stibee API 키 | ❌ 미발급 | CEO 액션 필요 (Stibee 대시보드에서 API Key 발급) |
| 블로그 디자인 QA | ❌ 미검증 | 프론트엔드 빌드/배포 후 QA 필요 |
| WP 이미지 마이그레이션 | ❌ 미진행 | WP 콘텐츠 내 이미지 → Cloudflare R2 이전 |
| 301 리다이렉트 | ❌ 미설정 | WP URL → Next.js URL 매핑 |
| DB 분리 확인 | ⚠️ 확인 필요 | Prisma(apppro.kr) vs neon serverless(content-pipeline) 충돌 점검 |

---

## 2. 목표

### 핵심 목표
1. **blog.apppro.kr을 WordPress에서 Next.js로 완전 전환**
2. **기존 95건 콘텐츠 무손실 마이그레이션**
3. **AI 콘텐츠 자동 생성 파이프라인 활성화** (주 5건 자동 생성)
4. **뉴스레터 자동 발송** (Stibee, 10,000명 구독자)

### 비즈니스 목표
- 블로그 SEO → 유기적 트래픽 유입 → 리드 수집
- 뉴스레터 → 기존 이메일 리스트 10,000건 활용 → 브랜드 인지도
- AI 자동화 → CEO 개입 최소화 (주 15분 이하)

---

## 3. 기술 스택 (확정)

| 구성요소 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) | SSG/ISR |
| DB | NeonDB (neon serverless) | Prisma 사용 안 함 (충돌 방지) |
| AI 생성 | Claude Sonnet API | @anthropic-ai/sdk |
| 뉴스 수집 | RSS Parser | rss-parser 라이브러리 |
| 뉴스레터 | Stibee API | 한국 뉴스레터 플랫폼 |
| SNS 배포 | getlate.dev API | 멀티플랫폼 |
| 이미지 | Cloudflare R2 | WP 이미지 이전 |
| 배포 | Vercel | GitHub 자동 배포 |
| 도메인 | blog.apppro.kr | Vercel 커스텀 도메인 |

---

## 4. 구현 계획 (2주 MVP)

### Phase 1: 기반 점검 + WP 마이그레이션 (Day 1-3)

| # | 작업 | 상세 | CEO 액션 |
|---|---|---|---|
| 1-1 | DB 분리 확인 | neon serverless가 Prisma 테이블과 충돌 안 하는지 확인. 필요 시 별도 NeonDB 프로젝트(db_blog) 생성 | DB 생성 시 CEO 승인 |
| 1-2 | content-pipeline 빌드 검증 | `npm run build` 정상 여부, 로컬 dev 서버 확인 | 없음 |
| 1-3 | WP 마이그레이션 실행 | `migrate-wp.ts` 실행 → 95건 blog_posts INSERT | 없음 |
| 1-4 | WP 이미지 마이그레이션 | WP 콘텐츠 내 이미지 URL 추출 → Cloudflare R2 업로드 → 콘텐츠 내 URL 교체 | 없음 |
| 1-5 | 블로그 프론트엔드 점검 | 마이그레이션된 포스트가 정상 렌더링되는지 확인 | 없음 |

### Phase 2: 배포 + 도메인 연결 (Day 4-5)

| # | 작업 | 상세 | CEO 액션 |
|---|---|---|---|
| 2-1 | Vercel 배포 확인 | `git push` → Vercel 자동 배포 작동 확인 | 없음 |
| 2-2 | blog.apppro.kr 도메인 연결 | Vercel 커스텀 도메인 설정 + DNS CNAME 레코드 추가 | DNS 설정 (CEO or 총괄이사) |
| 2-3 | SSL 인증서 확인 | Vercel 자동 SSL 활성화 확인 | 없음 |
| 2-4 | 301 리다이렉트 설정 | WP URL 패턴 → Next.js URL 매핑 (next.config.ts redirects) | 없음 |
| 2-5 | QA (5개 항목) | URL 200, 유저플로우 3가지, 콘솔 에러, 모바일 반응형, QA 기록 | 없음 |

### Phase 3: AI 파이프라인 활성화 (Day 6-9)

| # | 작업 | 상세 | CEO 액션 |
|---|---|---|---|
| 3-1 | AI 블로그 생성 테스트 | `npm run pipeline:blog "AI 도구 리뷰 테스트"` → 1건 생성 | CEO 검수 (콘텐츠 품질) |
| 3-2 | CEO 검수 + 피드백 반영 | CEO가 생성된 블로그 포스트 검수 → 품질 확인 → 프롬프트 조정 | **필수: 1건 검수** |
| 3-3 | RSS 수집 파이프라인 테스트 | `npm run pipeline:collect` → 뉴스 수집 정상 작동 확인 | 없음 |
| 3-4 | 파이프라인 스케줄 자동화 | cron 스케줄 설정 (평일 1건/일 자동 생성) | 없음 |

### Phase 4: 뉴스레터 + SNS 연동 (Day 10-14)

| # | 작업 | 상세 | CEO 액션 |
|---|---|---|---|
| 4-1 | Stibee API 연동 | Stibee API Key 설정 → 뉴스레터 발송 테스트 | **필수: Stibee API Key 발급** |
| 4-2 | 이메일 리스트 Stibee 임포트 | 기존 10,000건 이메일 → Stibee 구독자 리스트 | **필수: 이메일 리스트 제공** |
| 4-3 | 뉴스레터 템플릿 + 1건 테스트 | 주간 AI 브리핑 뉴스레터 1건 생성 → CEO 검수 | **필수: 뉴스레터 검수** |
| 4-4 | getlate.dev SNS 배포 테스트 | `npm run publish:sns` → SNS 자동 배포 테스트 | 없음 |
| 4-5 | 전체 파이프라인 통합 테스트 | 수집→생성→블로그게시→뉴스레터→SNS 전 과정 1회 실행 | CEO 최종 검수 |

---

## 5. DB 구조 주의사항

### 핵심: Prisma/Drizzle 충돌 방지

> 🚨 2026-02-19 데이터 소실 사건 교훈: apppro.kr(Prisma)과 칸반(Drizzle)이 같은 NeonDB를 공유하다 Prisma push 시 Drizzle 테이블 전부 삭제됨.

**content-pipeline은 `@neondatabase/serverless`를 직접 사용** (Prisma도 Drizzle도 아님).
- SQL을 직접 실행하므로 ORM 충돌 위험은 낮음
- 단, apppro.kr의 Prisma가 `blog_posts` 테이블을 관리하고 있다면 충돌 가능
- **권장**: 별도 NeonDB 프로젝트(db_blog) 생성하여 완전 분리

### blog_posts 테이블 현황

- 현재 95건이 NeonDB `neondb`에 존재 (Prisma 스키마 소속)
- content-pipeline의 마이그레이션 스크립트도 같은 DB를 바라봄
- **결정 필요**: 같은 DB 유지 vs 별도 DB 분리
  - 같은 DB 유지: 마이그레이션 불필요, 충돌 리스크 존재
  - 별도 DB 분리: 안전, 추가 NeonDB 프로젝트 생성 필요 (무료 1개 추가 가능)

---

## 6. 비용 산출

| 항목 | 월 비용 | 비고 |
|---|---|---|
| Claude Sonnet API | ~$1-3 | 월 20건 블로그 생성 기준 |
| Vercel | $0 (Hobby) | 상업적 사용 제한 주의 → 추후 Pro($20/월) 또는 Cloudflare Pages(무료) |
| NeonDB | $0 (Free) | 0.5GB 스토리지, 충분 |
| Stibee | $0~$9 | 무료: 구독자 500명까지. 10,000명이면 유료 플랜 필요 → CEO 확인 |
| Cloudflare R2 | $0 | 무료 tier (10GB, 충분) |
| getlate.dev | 확인 필요 | API 요금제 확인 필요 |
| **합계** | **~$1-12/월** | Stibee 유료 시 최대 ~$12 |

---

## 7. CEO 필요 액션 (대기 항목)

| # | 액션 | 긴급도 | 설명 |
|---|---|---|---|
| 1 | Stibee API Key 발급 | Phase 4 | Stibee 대시보드 > 설정 > API |
| 2 | 이메일 리스트 제공/임포트 | Phase 4 | 10,000건 CSV → Stibee 업로드 |
| 3 | 생성 콘텐츠 1건 검수 | Phase 3 | AI 생성 블로그 포스트 품질 확인 |
| 4 | 뉴스레터 1건 검수 | Phase 4 | 주간 AI 브리핑 뉴스레터 품질 확인 |
| 5 | DB 분리 여부 결정 | Phase 1 | 같은 DB vs 별도 db_blog 생성 |
| 6 | Stibee 요금제 확인 | Phase 4 | 10,000명 구독자 요금 확인 |
| 7 | blog.apppro.kr DNS 설정 | Phase 2 | CNAME → Vercel (총괄이사 대행 가능) |

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| Prisma/neon 충돌 | DB 테이블 소실 | DB 분리 (별도 NeonDB 프로젝트) |
| WP 이미지 링크 깨짐 | 마이그레이션된 포스트 이미지 누락 | R2 업로드 + URL 교체 스크립트 |
| AI 콘텐츠 품질 미달 | CEO 반려, 방향 전환 | 1건 먼저 생성→검수→프롬프트 조정 |
| Stibee 비용 | 10,000명이면 유료 | 요금제 확인 후 진행 |
| Vercel 상업적 사용 | Hobby Plan 제한 | Cloudflare Pages 대안 검토 |
| blog.apppro.kr SEO 순위 하락 | WP→Next.js 전환 시 일시적 | 301 리다이렉트 + sitemap 제출 |

---

## 9. 성공 지표

| 지표 | 목표 | 측정 방법 |
|---|---|---|
| WP→Next.js 전환 완료 | blog.apppro.kr이 Next.js로 서비스 | URL 접속 확인 |
| 기존 콘텐츠 마이그레이션 | 95건 무손실 이전 | DB 건수 확인 |
| AI 자동 생성 | 주 5건 블로그 자동 게시 | 게시 건수 모니터링 |
| 뉴스레터 발송 | 주 1회 자동 발송 | Stibee 발송 기록 |
| CEO 개입 시간 | 주 15분 이하 | CEO 피드백 |

---

## 10. 결론

**content-pipeline 프로젝트가 이미 80% 구축 완료 상태.** 남은 작업은:

1. **WP 마이그레이션 실행** (스크립트 준비됨, 실행만 하면 됨)
2. **도메인 연결** (Vercel + DNS)
3. **AI 파이프라인 검증** (1건 생성 → CEO 검수)
4. **뉴스레터 연동** (Stibee API Key 필요)

기존 프로젝트를 활용하여 **1주 내 Phase 1-2 (블로그 전환)**, **2주 내 Phase 3-4 (AI 자동화)** 달성 가능.

---

## 참조

- GitHub: `migkjy/ai-blog`
- Vercel: `content-pipeline`
- 프로젝트 경로: `projects/content-pipeline/`
- 콘텐츠 전략: `projects/content-pipeline/docs/content-strategy.md`
- WP 마이그레이션 스크립트: `projects/content-pipeline/scripts/migrate-wp.ts`
