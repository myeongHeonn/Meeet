# Meeet

여러 사람이 참여하는 미팅 하나의 시간을 빠르게 정하는 일회성 도구 (When2meet/Doodle식).
누구나 로그인 없이 후보 시간 여러 개로 폴을 만들고, 참가자도 계정 없이 공개 링크로
들어와 가능한 시간을 표시(투표)한다. **사이트 차원의 계정/로그인 개념이 없다** — 폴의
공개 토큰을 아는 것 자체가 조회/참여/확정 권한이다. Calendly식 반복 가용 시간 등록
모델이 아니다.

## 기술 스택
- Next.js 15 (App Router), TypeScript, React 19
- Tailwind CSS 4
- Drizzle ORM + Postgres (`postgres` 드라이버)
- Zod (모든 외부 입력 검증)
- Jest + React Testing Library

## 디렉토리 구조
- `src/app/` — App Router 라우트
- `src/db/schema.ts` — Drizzle 스키마 (단일 진실 소스)
- `src/db/index.ts` — DB 클라이언트
- `src/lib/validations/` — Zod 스키마 (기능별로 분리)
- `specs/` — SDD 스펙 문서 (아래 참고)
- `drizzle.config.ts`, `drizzle/` — 마이그레이션 설정/산출물

## 개발 방식: SDD (Spec-Driven Development)
이 프로젝트는 코드를 먼저 짜지 않는다. 모든 기능은 `specs/<NNN>-<slug>/` 아래에
다음 순서로 문서를 쌓고, 각 단계가 승인된 뒤 다음 단계로 넘어간다.

1. `spec.md` — 무엇을, 왜 만드는지. `specs/templates/spec-template.md` 사용.
   요구사항(FR-N)과 데이터 모델을 정의한다. **Status: Approved**가 되기 전에는
   구현을 시작하지 않는다.
2. `plan.md` — spec을 어떻게 구현할지 기술 설계. `specs/templates/plan-template.md` 사용.
   Drizzle 스키마 변경, Zod 스키마 위치, 라우트/컴포넌트 경계, 테스트 전략을 명시한다.
3. `design.md`(선택) — UI가 있는 기능은 화면 단위 경량 와이어프레임을 잡는다.
   화면 ASCII 스케치 + 요소 + 상태 + FR↔화면 매핑. 정보 구조가 복잡한 화면이 있을 때만.
4. `tasks.md` — plan을 실행 가능한 작업 목록으로 분해. `specs/templates/tasks-template.md` 사용.
5. 구현 — tasks.md의 각 항목을 순서대로 수행하고 체크한다. 구현이 끝나면 spec.md의
   Status를 `Implemented`로 갱신한다.

규칙:
- spec 없이 새 기능 코드를 작성하지 않는다. 사소한 버그 수정/리팩토링은 예외.
- spec의 FR 번호는 plan과 tasks에서 추적 가능해야 한다 (어떤 코드가 어떤 FR을 구현하는지).
- 데이터 모델은 spec → Drizzle 스키마 순으로 흐른다. 스키마를 먼저 바꾸고 spec을
  나중에 맞추지 않는다.
- 현재 상태: `specs/000-meeting-poll/` — spec.md(Implemented). plan §6 T1~T9 구현 완료.
  순수 로직(token/datetime/grid/aggregate/layout/rules)은 Jest 단위 테스트, DB 레이어
  (queries/mutations)와 Route Handler는 로컬 DB 대상 수동 E2E로 검증. 통합 테스트는 후속 과제.
- 모델 요약: 로그인 없음. 폴 생성자가 캘린더에서 날짜들 + 하루 시간 범위를 고르면 서버가
  30분 격자 슬롯으로 펼친다. 참가자는 격자를 드래그로 칠해 응답, 집계는 히트맵. 공개 토큰이 권한.

## 브랜치 & 배포 규칙
- Claude는 `feat/*` 및 `dev` 브랜치까지만 push한다.
- `dev → main` 머지 및 push는 **사용자(myeongHeonn)만** 한다. Claude가 직접 main에 push하지 않는다.
- 작업 완료 후 `dev`에 push하고, main 머지는 사용자에게 맡긴다.

## 컨벤션
- 모든 서버 입력(폼 제출, API 바디, 쿼리 파라미터)은 Zod로 파싱한다. 신뢰할 수 없는
  경계에서만 검증하고, 내부 함수 간에는 타입으로 충분하다.
- 컴포넌트는 기본적으로 서버 컴포넌트. 상호작용(폼, 클라이언트 상태)이 필요할 때만
  `"use client"`.
- 테스트는 구현 파일과 같은 디렉토리에 `*.test.tsx` / `*.test.ts`로 둔다.

## 명령어
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run lint` — ESLint
- `npm run test` — Jest
- `npm run db:generate` — 스키마 변경으로부터 마이그레이션 생성
- `npm run db:migrate` — 마이그레이션 적용
- `npm run db:studio` — Drizzle Studio
