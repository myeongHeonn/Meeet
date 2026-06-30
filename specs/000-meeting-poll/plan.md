# Plan: 미팅 폴 흐름 (Meeting Poll Flow)

이 문서는 [spec.md](./spec.md)(Status: Approved)의 요구사항을 어떻게 구현할지 설계한다.
FR 번호는 spec.md를 따른다.

## 1. 영향 범위

추가되는 파일:

```
src/
  db/
    schema.ts                      # (수정) 4개 테이블 정의
  lib/
    token.ts                       # publicToken 생성 (FR-4)
    datetime.ts                    # 로컬↔UTC 변환/포맷 단일 경로 (FR-13)
    validations/
      poll.ts                      # Zod: 폴 생성/응답/확정 (FR-11)
    polls/
      queries.ts                   # 폴 조회 (DB 읽기, raw 데이터)
      mutations.ts                 # 폴 생성/응답 upsert/확정 (DB 쓰기, 트랜잭션)
      aggregate.ts                 # 슬롯별 가능 인원 집계 (순수 함수, FR-8)
      rules.ts                     # 확정 가능 여부 등 분기 판정 (순수 함수, DB 무관)
  app/
    page.tsx                       # 폴 생성 페이지 셸 (GET /, 서버 컴포넌트)
    create-poll-form.tsx           # "use client" 생성 폼 + 생성 후 공유 화면 (상태 전환)
    p/[token]/
      page.tsx                     # 공개 폴 페이지 (조회+응답+확정)
      poll-view.tsx                # "use client" 상호작용 컴포넌트
    api/
      polls/
        route.ts                   # POST /api/polls
        [token]/
          responses/route.ts       # POST /api/polls/{token}/responses
          confirm/route.ts         # POST /api/polls/{token}/confirm
drizzle/                           # 마이그레이션 산출물 (db:generate)
```

테스트는 각 대상 파일과 같은 디렉토리에 `*.test.ts(x)`로 둔다 (§5).

## 2. 데이터 모델 / 마이그레이션

spec §6을 Drizzle(`pg-core`)로 옮긴다. 모든 PK는 `uuid().defaultRandom()`,
타임스탬프는 `timestamp({ withTimezone: true })`로 통일한다(저장은 UTC, FR-13).

테이블:
- `meetingPolls` — `id`, `title`, `description(nullable)`, `publicToken(unique)`,
  `status`(pgEnum `poll_status`: `open`|`confirmed`, default `open`),
  `confirmedSlotId(nullable)`, `createdAt`.
- `pollSlots` — `id`, `pollId(FK→meetingPolls, onDelete cascade)`, `startsAt`, `endsAt`.
- `participants` — `id`, `pollId(FK→meetingPolls, onDelete cascade)`, `name`, `createdAt`.
  `unique(pollId, name)` (FR-7 덮어쓰기의 근거).
- `participantAvailabilities` — `participantId(FK→participants, onDelete cascade)`,
  `pollSlotId(FK→pollSlots, onDelete cascade)`, 복합 PK `(participantId, pollSlotId)`.

순환 FK 처리: `meetingPolls.confirmedSlotId → pollSlots.id`와
`pollSlots.pollId → meetingPolls.id`가 서로를 참조한다. `confirmedSlotId`는 nullable이고
폴 생성 시점엔 항상 null이므로 삽입 순서 문제는 없다. Drizzle에서 한쪽 FK는
`AddConstraint`가 순환을 일으킬 수 있어, `confirmedSlotId`의 FK 제약은
`references(() => pollSlots.id)`로 선언하되 필요 시 마이그레이션에서 분리 적용한다.
"confirmedSlotId가 가리키는 슬롯이 같은 폴 소속"은 DB FK로 보장 불가 →
애플리케이션(확정 mutation)에서 검증한다(spec §8, 400).

마이그레이션: `npm run db:generate`로 SQL 생성 → `npm run db:migrate`로 적용.
기존 `_placeholder` 테이블은 이 스키마로 대체하므로 제거한다.

## 3. 검증 (Zod) — `src/lib/validations/poll.ts`

- `createPollSchema`:
  - `title`: 1~200자 비어있지 않은 문자열.
  - `description`: 선택, 최대 2000자.
  - `slots`: 길이 ≥ 1 배열. 각 원소 `{ startsAt: ISO datetime, endsAt: ISO datetime }`.
    - `endsAt > startsAt` (refine).
    - `startsAt > now` (refine, FR-3 과거 거부). 서버 기준 현재 시각으로 검증.
- `submitResponseSchema`:
  - `name`: 1~80자.
  - `availableSlotIds`: `string().uuid()` 배열(중복 제거). 빈 배열 허용("전부 불가능"도 응답).
- `confirmPollSchema`:
  - `slotId`: uuid.

API Route Handler에서 `schema.safeParse(await req.json())` → 실패 시 400 + 이슈 반환.
클라이언트 폼에서도 같은 스키마를 재사용해 제출 전 1차 검증(중복 정의 방지).

## 4. 라우트 / 컴포넌트 설계

**왜 Route Handler인가**: spec §7이 공개 토큰 기반 REST 엔드포인트를 명시했고, 폴은
외부에 공유되는 링크라 표준 HTTP 의미(404/409/400)를 그대로 노출하는 편이 자연스럽다.
Server Action 대신 `app/api/.../route.ts`로 구현하고, 클라이언트 컴포넌트에서 `fetch`로 호출한다.

- `GET /` ([page.tsx]) — 서버 컴포넌트 셸 + `"use client"` 생성 폼.
  슬롯 입력은 `<input type="datetime-local">`(로컬 시각) → 제출 시 `new Date(...).toISOString()`로
  UTC 변환해 전송(FR-13). 성공 응답의 `token`을 받아 공유 화면으로 이동.
- 생성 후 공유 화면 — **생성 페이지 내 클라이언트 상태 전환**으로 처리한다(별도 라우트 미사용).
  생성 직후 `token`을 이미 손에 쥐고 있으므로 추가 라운드트립이 불필요하고, 새 라우트보다 단순하다.
  공유 화면은 `/p/{token}` 절대 URL + 복사 버튼 + "폴로 이동" 링크를 보여준다.
- `GET /p/[token]` ([page.tsx]) — 서버 컴포넌트에서 폴+슬롯+참여현황을 조회(`queries.ts`),
  없으면 `notFound()`(404, spec §8). 데이터를 `poll-view.tsx`("use client")에 전달.
  클라이언트에서 브라우저 타임존으로 시각 포맷(FR-13), 응답 폼·확정 버튼·집계 표시.
- API:
  - `POST /api/polls` → 검증 → 토큰 생성 → 트랜잭션으로 poll+slots 삽입 → `{ token }` 반환.
  - `POST /api/polls/[token]/responses` → 폴 조회(404) → status=confirmed면 409(FR-10) →
    검증 → 응답 교체 트랜잭션(아래) → 200.
  - `POST /api/polls/[token]/confirm` → 폴 조회(404) → `rules.ts`로 slotId가 이 폴
    소속인지 판정(400) → 조건부 갱신(409) → 200.

**응답 교체 트랜잭션 (FR-7 덮어쓰기)**: 단일 트랜잭션 안에서
(1) `participants`에 `(pollId, name)` 기준 upsert(`onConflictDoUpdate`)로 participantId 확보 →
(2) 그 participantId의 기존 `participantAvailabilities` 행을 전부 삭제 →
(3) 요청의 `availableSlotIds`로 새 행을 삽입.
이렇게 해야 "같은 이름 재제출 시 이전 선택을 완전히 대체"가 보장된다(부분 갱신 아님).
`availableSlotIds`가 모두 이 폴의 슬롯인지도 삽입 전에 `rules.ts`로 검증한다(아니면 400).

**확정 조건부 갱신 (§8 동시성, 409)**: `UPDATE meeting_polls SET status='confirmed',
confirmed_slot_id=$slot WHERE public_token=$token AND status='open'`. 영향 행이 0이면
이미 확정된 것으로 보고 409를 반환한다(먼저 쓴 쪽이 이김).

## 5. 테스트 전략 (Jest + RTL)

DB 없이도 의미 있는 단위를 우선한다. 순수 로직을 함수로 분리해 테스트 가능하게 한다.

- `src/lib/token.test.ts` — 토큰이 충분한 길이/엔트로피이고 매번 다름(FR-4).
- `src/lib/validations/poll.test.ts` — 경계값: 빈 제목 거부, slots 0개 거부,
  `endsAt ≤ startsAt` 거부, 과거 `startsAt` 거부, 정상 입력 통과(FR-2,3,11).
- `src/lib/polls/aggregate.test.ts` — 참여 데이터로부터 슬롯별 가능 인원/명단 집계가
  정확하고 정렬 규칙대로인지(FR-8).
- `src/lib/polls/rules.test.ts` — slotId가 폴 소속인지 판정, 확정 가능 여부 판정 등
  분기 로직(DB 무관 순수 함수). DB 통합 테스트 없이도 400/409 분기 근거를 커버(§8).
- `src/app/p/[token]/poll-view.test.tsx` (RTL) — 폴 데이터 렌더링, 응답 폼 입력/제출 핸들러
  호출, 확정 버튼 노출(open일 때)/숨김(confirmed일 때) (FR-5,6,9,10).
- `src/app/page.test.tsx` (RTL, 기존 교체) — 생성 폼 렌더링, 슬롯 추가/삭제, 제출 시
  로컬→UTC 변환 페이로드 확인.

DB에 직접 의존하는 mutation/query는 MVP에서 통합 테스트를 두지 않는다(로컬 Postgres
부트스트랩 비용). 대신 분기 판정을 `rules.ts` 순수 함수로 떼어내 단위 테스트로 커버하고,
원자적 `UPDATE`의 경합 자체와 트랜잭션 묶음은 §6 구현 시 수동 검증한 뒤 추후 통합
테스트 스펙으로 분리한다. → §7 리스크 참고.

## 6. 단계별 구현 순서

0. T0: ✅ 완료 — 로컬 Postgres는 `docker compose up -d`(루트 `docker-compose.yml`,
   `meeet-db` 컨테이너, 호스트 포트 5434)로 띄운다. `.env.local`에
   `DATABASE_URL=postgresql://meeet:meeet_local_dev@localhost:5434/meeet`. `db:migrate`는
   실제 DB 연결이 필요하다(`db:generate`는 스키마만으로 가능). 운영 DB는 추후 Vercel 환경변수로 교체.
1. T1: `src/db/schema.ts` 4개 테이블 + enum 작성, `_placeholder` 제거, `db:generate`로
   마이그레이션 생성 후 `db:migrate`로 로컬 적용. (FR-2 데이터 구조)
2. T2: `src/lib/token.ts` + 테스트. (FR-4)
3. T3: `src/lib/validations/poll.ts` 3개 스키마 + 테스트. (FR-11, FR-2/3)
4. T4: `src/lib/polls/aggregate.ts` 집계 순수 함수 + 테스트. (FR-8)
5. T5: `queries.ts`/`mutations.ts` — 조회, 폴 생성 트랜잭션, 응답 upsert+교체,
   확정 조건부 갱신. (FR-1,5,7,9,10 + §8 엣지)
6. T6: `POST /api/polls` + `/responses` + `/confirm` Route Handler. (FR-1,6,9,10)
7. T7: `GET /` 생성 폼 + 공유 화면(상태 전환) + RTL 테스트. (FR-1,12,13)
8. T8: `GET /p/[token]` 페이지 + `poll-view` + RTL 테스트. (FR-5,6,8,9,13)
9. T9: `npm run lint`/`test`/`build` 통과 확인, spec.md Status를 `Implemented`로 갱신.

## 7. 리스크 / 트레이드오프

- **DB 통합 테스트 부재**: mutation의 동시성/트랜잭션 경로(확정 409, 응답 덮어쓰기)는
  단위 테스트로 완전히 커버되지 않는다. MVP에서는 수동 검증으로 가고, 통합 테스트는
  후속 작업으로 명시한다. 가장 큰 품질 리스크 지점.
- **publicToken = 확정 권한**: 토큰이 유출되면 누구나 확정 가능(spec이 수용한 트레이드오프).
  토큰은 `node:crypto`의 `randomBytes(32).toString("base64url")`(256bit)로 생성해
  추측 공격을 차단한다 — spec §9 열린 질문을 이 방식으로 닫는다.
- **datetime-local 타임존**: 브라우저 로컬 시각을 UTC로 변환해 저장/표시하는 경로가
  여러 컴포넌트에 흩어지면 버그가 나기 쉽다. 변환 유틸을 한 곳(`src/lib/datetime.ts`)에
  모아 단일 경로로 강제한다.
- **순환 FK 마이그레이션**: `confirmedSlotId`↔`pollId` 순환이 drizzle-kit 생성 SQL에서
  문제를 일으키면, 해당 FK를 별도 `ALTER TABLE`로 분리해 적용한다(T1에서 확인).
- **DB 연결 전제**: `db:migrate`와 모든 mutation/query는 `DATABASE_URL`로 접근 가능한
  Postgres가 있어야 동작한다. 개발은 로컬 Postgres, 운영은 추후 Vercel 환경변수로 주입한다.
