# Constraints (제한사항)

## 프로젝트 성격
- **내부 전용 도구 -- SEO/마케팅/Lighthouse 최적화 금지**
- 콘텐츠 생성/배포 자동화 도구로, 외부 서비스가 아님

## 이메일 발송 안전장치 (CEO 긴급 지시)
1. 전체 구독자(1,800+명) 대상 뉴스레터/대량 발송 절대 금지
2. 테스트 발송은 Brevo 리스트 8번(TEST) 전용
3. Brevo campaign API 호출 절대 금지 -- 캠페인 생성/발송은 CEO만 직접
4. 10명 이상 수신자 발송 시 즉시 중단 + CEO 승인 요청

## 콘텐츠 생성 규칙 (CEO 지시)
1. 자비스 콘텐츠 생성 완전 금지
2. 대량 사전 생성 절대 금지 (수십 편 미리 만들기 금지)
3. 발행 스케줄: CEO + 머스크 VP + 게리비 3자 협의 후 배포

## DB 보호 규칙
1. 앱 런타임은 app_user 권한 사용 (DROP/TRUNCATE/CREATE 불가)
2. neondb_owner는 마이그레이션 전용
3. drizzle-kit push 절대 금지
4. DROP TABLE / TRUNCATE 포함 마이그레이션 발견 시 즉시 중단 + CEO 보고

## Vercel 배포
- 무료 플랜 일일 배포 100개 제한
- vercel deploy / vercel --prod 절대 금지 (Git push로만 배포)
- 새 Vercel 프로젝트 생성 절대 금지

## 코드 변경
- 기존 파일 수정 우선, 새 파일 생성 최소화
- 파괴적 명령 (reset, rm -rf, DROP, --force-reset) CEO 승인 없이 금지
