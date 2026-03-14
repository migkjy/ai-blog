# Content Pipeline (ai-blog)

## 프로젝트 개요
AI 기반 뉴스레터 + 블로그 자동 생성/배포 파이프라인.
RSS 수집 -> Claude API 가공 -> Brevo 이메일 발송 -> Next.js 블로그 게시 -> SNS 배포.

**내부 전용 도구 -- SEO/마케팅/Lighthouse 최적화 금지.**

## 기술 스택
- **Runtime**: Node.js >=20, TypeScript, tsx
- **Framework**: Next.js 15 (App Router), React 19, Tailwind CSS 4
- **AI**: Anthropic Claude API, Google Generative AI, OpenRouter (우선순위 1순위)
- **Email**: Brevo (@getbrevo/brevo)
- **DB**: Turso/LibSQL (apppro-kr DB + content-os DB + kanban DB)
- **SNS**: getlate.dev API
- **Deploy**: Vercel (main + production 브랜치)
- **Test**: Vitest

## 주요 명령어
```bash
npm run dev              # Next.js 개발 서버
npm run build            # 프로덕션 빌드
npm run pipeline         # 전체 파이프라인 (수집+생성+게시)
npm run pipeline:collect # 뉴스 수집만
npm run pipeline:generate # 콘텐츠 생성만
npm run pipeline:publish  # 게시만
npm run pipeline:blog    # 블로그 파이프라인
npm run publish:sns      # SNS 배포
```

## GitHub
- Repo: migkjy/ai-blog
- Branch: main, production

## 배포
- Vercel 자동 배포 (main, production)
- Cron: 매일 21:00 UTC publish, 월-금 21:00 UTC pipeline

## 세션 프로토콜
- 자비스 회신: `scripts/project-reply.sh "메시지" "content-pipeline"`
- 세션 시작 시: `.claude/knowledge/` 하위 파일 읽기
- 세션 종료 전: 작업 결과를 knowledge에 업데이트

## 핵심 규칙
1. `.env` 파일 절대 커밋 금지
2. Brevo 캠페인 API 직접 호출 금지 (CEO만)
3. 10명 이상 수신자 발송 시 CEO 승인 필수
4. DB 스키마 변경 시 마이그레이션 스크립트 사용
5. `drizzle-kit push` 절대 금지
