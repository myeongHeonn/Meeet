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
    datetime.ts                    # 로컬↔UTC 변환/포맷 단일 경로 (FR-12)
    validations/
      poll.ts                      # Zod: 폴 생성/응답/확정 (FR-11)
    polls/
      queries.ts                   # 폴 조회 (DB 읽기, raw 데이터)
      mutations.ts                 # 폴 생성/응답 upsert/확정 (DB 쓰기, 트랜잭션)
      grid.ts                      # [날짜×시간범위] → 30분 격자 슬롯 펼치기 (순수 함수, FR-3)
      aggregate.ts                 # 칸별 가능 인원 집계 → 히트맵 데이터 (순수 함수, FR-8)
      layout.ts                    # UTC 슬롯 → 뷰어 타임존 (날짜열×시간행) 배치 (순수 함수, FR-12)
      rules.ts                     # 확정 가능 여부 등 분기 판정 (순수 함수, DB 무관)
  app/
    page.tsx                       # 폴 생성 페이지 셸 (GET /, 서버 컴포넌트)
    create-poll-form.tsx           # "use client" 생성 폼(캘린더+시간범위) + 공유 화면
    p/[token]/
      page.tsx                     # 공개 폴 페이지 (조회+응답+확정)
      poll-view.tsx                # "use client" 상호작용 컴포넌트
    components/
      time-grid.tsx                # 공통 격자: mode="edit"(칠하기) | "heatmap" (design 구현노트)
      date-picker-calendar.tsx     # 생성 폼의 날짜 클릭·드래그 선택 캘린더
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

- `createPollSchema` (캘린더+시간범위 입력, FR-2):
  - `title`: 1~200자 비어있지 않은 문자열.
  - `description`: 선택, 최대 2000자.
  - `dates`: 길이 ≥ 1 배열, 각 원소 ISO date(`YYYY-MM-DD`), 중복 제거, 모두 미래 날짜(refine, FR-3).
  - `startTime`/`endTime`: `HH:mm`(30분 단위: 분이 `00`|`30`). `endTime > startTime`(refine).
  - 서버는 검증 통과 후 `grid.ts`로 [dates × (startTime~endTime)]를 30분 슬롯으로 펼친다(§4).
  - 타임존: 입력 날짜/시간은 생성자 로컬 기준 → `grid.ts`가 UTC ISO로 변환해 슬롯 생성(FR-12).
    생성자 타임존은 폼에서 함께 전송(`timeZone` 필드, IANA 문자열)해 변환 기준으로 쓴다(spec §9).
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
  날짜는 `date-picker-calendar.tsx`(클릭·드래그 선택), 시간 범위는 30분 단위 드롭다운.
  제출 시 `{ title, description?, dates[], startTime, endTime, timeZone }`를 전송(FR-2,12).
  성공 응답의 `token`을 받아 공유 화면으로 전환.
- 생성 후 공유 화면 — **생성 페이지 내 클라이언트 상태 전환**으로 처리한다(별도 라우트 미사용).
  생성 직후 `token`을 이미 손에 쥐고 있으므로 추가 라운드트립이 불필요하고, 새 라우트보다 단순하다.
  공유 화면은 `/p/{token}` 절대 URL + 복사 버튼 + "폴로 이동" 링크를 보여준다.
- `GET /p/[token]` ([page.tsx]) — 서버 컴포넌트에서 폴+슬롯+참여현황을 조회(`queries.ts`),
  없으면 `notFound()`(404, spec §8). 데이터를 `poll-view.tsx`("use client")에 전달.
  클라이언트에서 슬롯들을 (날짜 행 × 시간 열) 격자로 배치하고, 왼쪽 `time-grid`(edit) +
  오른쪽 `time-grid`(heatmap)로 렌더(브라우저 타임존 포맷, FR-12). 응답 폼·확정 섹션 포함.
- `time-grid.tsx` — 슬롯 배열을 격자로 받아 렌더하는 공통 컴포넌트. `mode="edit"`는 클릭·드래그
  토글로 `selectedSlotIds` 로컬 상태를 만들고, `mode="heatmap"`은 칸별 가능 인원 농도 + hover 명단.
- API:
  - `POST /api/polls` → 검증 → `grid.ts`로 격자 슬롯 펼침 → 토큰 생성 →
    트랜잭션으로 poll+slots 삽입 → `{ token }` 반환.
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
- `src/lib/validations/poll.test.ts` — 경계값: 빈 제목 거부, dates 0개 거부,
  `endTime ≤ startTime` 거부, 30분 안 떨어지는 시간 거부, 과거 날짜 거부, 정상 통과(FR-2,3,11).
- `src/lib/polls/grid.test.ts` — [dates × 시간범위] → 30분 슬롯 펼치기가 정확한지:
  칸 개수(예: 2일 × 8시간 = 32칸), 경계 시각, UTC 변환, 30분 간격(FR-3,12).
- `src/lib/polls/aggregate.test.ts` — 참여 데이터로부터 칸별 가능 인원/명단 집계(히트맵 데이터)가
  정확한지(FR-8).
- `src/lib/polls/rules.test.ts` — slotId가 폴 소속인지 판정, 확정 가능 여부 판정 등
  분기 로직(DB 무관 순수 함수). DB 통합 테스트 없이도 400/409 분기 근거를 커버(§8).
- `src/app/components/time-grid.test.tsx` (RTL) — edit 모드: 칸 클릭/드래그 토글로
  선택 상태 변화; heatmap 모드: 인원 농도/명단 렌더(FR-6,8).
- `src/app/p/[token]/poll-view.test.tsx` (RTL) — 폴 데이터 렌더링, 이름 입력 전 격자 비활성,
  응답 제출 핸들러 호출, 확정 섹션 노출(open)/숨김(confirmed) (FR-5,6,9,10).
- `src/app/page.test.tsx` (RTL, 기존 교체) — 생성 폼 렌더링, 날짜 선택/시간범위, 제출 시
  `{dates, startTime, endTime, timeZone}` 페이로드 확인.

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
2. T2: `src/lib/token.ts` + `datetime.ts` + 테스트. (FR-4,12)
3. T3: `src/lib/validations/poll.ts` 3개 스키마 + 테스트. (FR-11, FR-2/3)
4. T4: `src/lib/polls/grid.ts`(격자 펼치기) + `aggregate.ts`(히트맵 집계) + 테스트. (FR-3,8)
5. T5: `queries.ts`/`mutations.ts`/`rules.ts` — 조회, 폴 생성 트랜잭션(grid 사용),
   응답 upsert+교체, 확정 조건부 갱신. (FR-1,5,7,9,10 + §8 엣지)
6. T6: `POST /api/polls` + `/responses` + `/confirm` Route Handler. (FR-1,6,9,10)
7. T7: `time-grid.tsx`(edit/heatmap 공통) + 테스트. (FR-6,8) — 화면2/생성 양쪽이 의존하므로 먼저.
8. T8: `GET /` 생성 폼(`date-picker-calendar` + 시간범위) + 공유 화면 + RTL 테스트. (FR-1,2,12)
9. T9: `GET /p/[token]` 페이지 + `poll-view`(time-grid edit+heatmap 조합) + RTL 테스트. (FR-5,6,8,9,12)
10. T10: `npm run lint`/`test`/`build` 통과 확인, spec.md Status를 `Implemented`로 갱신.

## 7. 리스크 / 트레이드오프

- **DB 통합 테스트 부재**: mutation의 동시성/트랜잭션 경로(확정 409, 응답 덮어쓰기)는
  단위 테스트로 완전히 커버되지 않는다. MVP에서는 수동 검증으로 가고, 통합 테스트는
  후속 작업으로 명시한다. 가장 큰 품질 리스크 지점.
- **publicToken = 확정 권한**: 토큰이 유출되면 누구나 확정 가능(spec이 수용한 트레이드오프).
  토큰은 `node:crypto`의 `randomBytes(32).toString("base64url")`(256bit)로 생성해
  추측 공격을 차단한다 — spec §9 열린 질문을 이 방식으로 닫는다.
- **격자 타임존 변환**: 생성자 로컬 날짜/시간 → UTC 슬롯(`grid.ts`) → 참가자 브라우저
  타임존 표시(`time-grid`)의 변환 경로가 흩어지면 칸이 어긋나기 쉽다. 변환 유틸을
  한 곳(`src/lib/datetime.ts`)에 모아 단일 경로로 강제한다. 30분 단위가 아닌 타임존
  (UTC+5:30 등)에서는 라벨 경계가 :00/:30이 아닐 수 있으나 칸 정합성은 유지된다(spec §8 수용).
- **격자 폭증**: 날짜를 많이 고르고 시간 범위를 넓히면 슬롯 수가 급증한다. MVP는 입력 단계에서
  칸 수 상한(날짜 ≤ 31, 총 칸 ≤ 1000)을 두어 방어한다 — `validations/poll.ts`에서 검증. 31일 ×
  하루 47칸 = 1457을 막으려면 1000이 실질 상한이 된다(1500은 날짜 상한에 가려 도달 불가라 1000으로 조정).
- **순환 FK 마이그레이션**: `confirmedSlotId`↔`pollId` 순환이 drizzle-kit 생성 SQL에서
  문제를 일으키면, 해당 FK를 별도 `ALTER TABLE`로 분리해 적용한다(T1에서 확인).
- **DB 연결 전제**: `db:migrate`와 모든 mutation/query는 `DATABASE_URL`로 접근 가능한
  Postgres가 있어야 동작한다. 개발은 로컬 Postgres, 운영은 추후 Vercel 환경변수로 주입한다.
