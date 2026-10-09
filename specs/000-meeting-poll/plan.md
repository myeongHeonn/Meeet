# Plan: 미팅 폴 흐름 (Meeting Poll Flow)

이 문서는 [spec.md](./spec.md)(Status: Approved)의 요구사항을 어떻게 구현할지 설계한다.
FR 번호는 spec.md를 따른다.

> **2026-07-01 개정 노트 (시간 확정 기능 제거).** 아래 설계 중 "확정(confirm)" 관련 부분은
> 더 이상 유효하지 않다. spec.md 2026-07-01 개정에 따라 FR-9/FR-10과 데이터 모델의
> `status`/`confirmedSlotId`(및 `poll_status` enum)를 제거했다. 구체적으로:
> - 파일: `api/polls/[token]/confirm/route.ts` 삭제, `mutations.confirmPoll`·
>   `rules.canConfirm`/`canRespond`·`validations.confirmPollSchema` 제거.
> - 스키마: `meetingPolls`는 `id/title/description/publicToken/createdAt`만 남는다.
>   순환 FK(§2)도 사라져 마이그레이션 `drizzle/0002_*`에서 컬럼·enum·FK를 드롭한다.
> - 상호작용(§4, §8): 확정 조건부 갱신/409 경합 경로 제거. 응답 제출은 마감 상태가 없으므로
>   상시 허용(409 없음). 대신 히트맵 칸 hover/click 시 `aggregate.splitParticipantsBySlot`로
>   가능자·불가능자 명단을 상세 패널에 표시한다(FR-8 확장). design.md 화면2 참고.
>
> 이 노트 아래 본문은 최초 설계 기록으로 보존한다(수정하지 않음).

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
  성공 응답의 `token`을 받아 sessionStorage에 생성자 플래그(`creator-flag.ts`)를 남기고
  `/p/{token}`으로 즉시 `router.push`(별도 완료 화면 없음 — URL이 히스토리에 남아 링크 유실도 줄인다).
- 생성 후 공유 — 폴 페이지 상단의 `share-banner.tsx`("use client")가 담당한다.
  생성자 플래그가 있는 탭에서만 렌더되고(링크로 들어온 참가자에게는 안 보임),
  `/p/{token}` 절대 URL + 복사 버튼(`copy-link-button.tsx`, "복사됨 ✓" 피드백)을 보여주며
  ✕로 닫으면 플래그를 지워 다시 뜨지 않는다.
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

## 8. 개정 R1~R3: 참가자 식별을 편집 토큰으로 (spec FR-7/7a)

기존 "이름 덮어쓰기"를 "익명 편집 토큰" 모델로 바꾼다. 같은 브라우저에서만 수정 가능(트레이드오프).

- R1: 스키마/마이그레이션 — `participants`에 `editToken uuid not null unique default random` 추가,
  `(pollId, name)` unique 제거(이름은 식별자 아님). `db:generate`로 ADD COLUMN(gen_random_uuid()
  default라 기존 행 backfill됨) + DROP CONSTRAINT 마이그레이션 생성 후 로컬 적용.
- R2: 서버 — `submitResponseSchema`에 `editToken: z.uuid().optional()`. `mutations.submitResponse`는
  editToken이 그 폴의 참가자를 가리키면 `update`(이름 변경 포함), 아니면 `insert`. 반환을
  `{ editToken, participantId }`로 바꾸고, 응답 Route Handler가 이를 JSON으로 돌려준다.
- R3: 클라이언트 — `poll-view`가 마운트 시 `localStorage["meeet:poll:{token}"]`의
  `{editToken, participantId}`를 읽어, props의 participants/availabilities에서 내 이름·선택을
  프리필(FR-7a). 제출 시 editToken을 함께 보내고, 응답으로 받은 `{editToken, participantId}`를
  localStorage에 저장. participantId는 공개 데이터라 노출 무해하지만 editToken은 수정 권한이므로
  participants props에는 절대 싣지 않는다(localStorage에만).
- 검증: 단위 테스트(validation editToken optional, poll-view 프리필) + 로컬 DB E2E
  (test 제출 → 토큰 저장 → test1로 재제출 → 참가자 1명 유지 확인).

## 9. 개정: 일괄 선택 도구 (FR-14/15, 2026-07-06)

새 데이터 모델/API 없음 — `time-grid.tsx`(mode="edit")에만 상호작용을 추가한다.
서버로 가는 값은 여전히 기존 `selectedSlotIds`(Set) 하나뿐이고, 제출 경로(FR-6)도 그대로다.

- **배치**: 격자 좌상단의 빈 sticky 코너 셀(현재 `<th className="w-14 sticky top-0 left-0..." />`,
  time-grid.tsx:160)을 "전체 선택/해제" 토글 버튼으로 바꾼다(스프레드시트의 전체선택 코너와
  같은 자리 재사용, 별도 UI 공간 불필요). 각 날짜 컬럼 헤더(`formatDateLabel` 렌더하는 `<th>`,
  time-grid.tsx:161-168)는 `mode="edit"`일 때만 클릭 가능한 버튼으로 바꿔 그 날짜 전체를 토글한다
  (`mode="heatmap"`에서는 지금처럼 순수 텍스트, 변경 없음).
- **토글 판정**: 대상 슬롯 집합(코너=격자 전체 슬롯, 헤더=그 날짜 컬럼 슬롯)에서 하나라도
  `props.value`(선택 Set)에 없으면 `next=true`로 전체를 채우고, 전부 있으면 `next=false`로
  전체를 비운다(FR-14/15의 indeterminate 규칙). 컬럼별 슬롯 목록은 `layout.timeKeys.map(tk =>
  layout.cell.get(cellKey(dk, tk)))`로, 전체 슬롯 목록은 `layout.dateKeys` 전체에 대해 같은 방식으로
  구한다(이미 있는 `layout`에서 파생 — 새 상태 불필요).
- **적용 방법**: 새 prop을 추가하지 않고 기존 `props.onToggle(slotId, next)`를 대상 슬롯마다
  반복 호출한다. `poll-view.tsx`의 `setSelected((prev) => withSetItem(prev, slotId, next))`는
  함수형 업데이트라 같은 렌더 안에서 여러 번 호출돼도 순차 합성되어 정확하다(격자 상한
  1000칸 기준 반복 호출 비용은 무시 가능, spec §8 격자 상한 참고).
- **비활성 연동**: 코너/헤더 버튼은 `props.disabled`(FR-6, 이름 미입력 시 격자 비활성)를
  그대로 물려받아 `disabled`+`pointer-events-none` 처리한다. 새 disabled 조건을 만들지 않는다.
- **접근성/라벨**: 코너 버튼은 `aria-label="전체 선택 또는 해제"`, 현재 전부 선택 상태면
  버튼 텍스트/aria-label을 "전체 해제"로 바꿔 방향을 알 수 있게 한다. 날짜 헤더 버튼도
  동일하게 `aria-pressed`로 그 날짜의 전부-선택 여부를 노출한다.
- **영향 파일**: `src/app/components/time-grid.tsx`(수정), `time-grid.test.tsx`(테스트 추가).
  `poll-view.tsx`/API/스키마는 변경 없음.
- **테스트 (RTL, time-grid.test.tsx 추가)**:
  - 코너 버튼 클릭 → 격자 전체가 선택 상태가 되는지, 다시 클릭 → 전체 해제되는지.
  - 날짜 헤더 버튼 클릭 → 그 날짜 컬럼만 토글되고 다른 날짜는 그대로인지.
  - 일부만 선택된 상태에서 코너/헤더 클릭 시 "채우기" 방향으로 동작하는지(비우기 아님).
  - `disabled`일 때 코너/헤더 버튼 클릭이 아무 효과가 없는지.
  - `mode="heatmap"`에서는 코너/헤더가 버튼이 아닌 텍스트 그대로인지(회귀 방지).
- **구현 순서**: T11 — `time-grid.tsx` 수정 + 테스트 → `npm run lint`/`test`/`build` 통과 확인 →
  spec.md의 해당 리비전 줄에 "구현 완료" 기록.

## 10. 개정: 터치 드래그 칠하기 (FR-16, 2026-09-29)

새 데이터 모델/API 없음 — `time-grid.tsx`(mode="edit")에만 상호작용을 추가한다. 서버로 가는
값은 여전히 `selectedSlotIds`(Set) 하나이고 제출 경로(FR-6)도 그대로다.

- **왜 지금은 안 되나**: 두 가지가 겹쳐 있다. (1) `onPointerDown`에서 `pointerType === "touch"`
  이면 즉시 return해 드래그를 막아두었다(time-grid.tsx:99). 격자가 `overflow-auto max-h-[55vh]`
  세로 스크롤 영역인데 칠하는 방향도 세로라 제스처가 충돌하기 때문이다. (2) 가드를 풀어도
  동작하지 않는다 — 터치는 첫 요소가 포인터를 암묵 캡처하므로 손가락이 다른 칸으로 옮겨가도
  `onPointerEnter`가 발생하지 않는데, 현재 드래그는 전적으로 거기에 의존한다.
- **가르는 기준**: "길게 누름 → 칠하기" / "바로 쓸어넘김 → 스크롤". 누른 뒤 `LONG_PRESS_MS`
  (300ms) 동안 이동이 `MOVE_TOLERANCE_PX`(8px) 이내로 유지되면 칠하기 모드로 진입하고,
  그 전에 임계치를 넘으면 타이머를 취소해 네이티브 스크롤에 맡긴다.
- **데스크톱 불변 원칙**: 마우스/펜 경로(`onPointerDown` 즉시 칠하기 + `onPointerEnter` 확장)는
  건드리지 않는다. 터치는 컨테이너 레벨 `onPointerMove` + `document.elementFromPoint`로 **별도
  경로**를 추가하고, 실제 칠하는 판정(같은 날짜 컬럼 한정, 목표 상태로 통일)만 공용 헬퍼로
  뽑아 공유한다. 한 경로로 합치면 코드는 줄지만 잘 동작하는 데스크톱 드래그를 회귀 위험에
  올리게 되므로 하지 않는다.
- **칸 찾기**: 칠하기 모드 중 `pointermove`에서 `document.elementFromPoint(clientX, clientY)`로
  손가락 아래 요소를 얻고 `data-slot-id` / `data-date-key`를 읽는다(두 속성은 이미 렌더에
  들어 있다, time-grid.tsx:91-92). 드래그 시작 컬럼과 다르면 무시한다(기존 가로 드래그 차단과
  동일 규칙).
- **스크롤 잠금**: `touch-action`을 제스처 도중에 바꿔도 이미 시작된 제스처에는 적용되지 않으므로,
  컨테이너에 `useEffect`로 non-passive `touchmove` 리스너를 달아 칠하기 모드일 때만
  `preventDefault()`한다. 롱프레스 단계에서는 아직 스크롤이 시작되지 않았으므로 이 시점의
  차단이 유효하다. 모드 종료 시 잠금을 푼다. 컨테이너 ref와 `useEffect`는 `layout.dateKeys.length
  === 0` 조기 return **앞**에 둔다(Hooks 규칙 — 기존 `useRef`와 같은 위치).
- **가장자리 자동 스크롤 없음**: ~~스크롤이 잠기므로 한 제스처로는 보이는 칸까지만 칠한다.~~ → §11에서 개정.
- **중복 토글 방지**: 롱프레스 후 제자리에서 손을 떼면 click이 이어서 발생해 마지막 칸이 한 번 더
  뒤집힌다. 칠하기 모드에 진입하면 `suppressClick = true`를 세우고 `onClick`은 이를 보면 무시한다.
  단 드래그 후에는 브라우저가 click을 **보내지 않는 경우가 많으므로** 플래그를 click에서 지우는 방식은
  쓰지 않는다(플래그가 남아 다음 정상 탭을 삼킨다). 대신 **터치 `pointerdown`마다 `false`로 초기화**한다.
  짧은 탭(모드 미진입)은 지금처럼 `onClick`이 토글한다.
- **격자 밖 판정**: 터치는 첫 칸이 포인터를 암묵 캡처하므로, 캡처 중에는 컨테이너 `pointerleave`가
  발생하지 않는다(경계 이벤트가 캡처 대상 기준으로만 난다). 따라서 칠하기 모드 중 `pointermove`에서
  `clientX/clientY`가 컨테이너 `getBoundingClientRect()` 밖이면 모드를 종료한다. 한 번 종료되면
  다시 들어와도 재개하지 않는다. (→ §11에서 개정: 격자 밖에서도 모드 유지 + 자동 스크롤)
- **종료 처리**: `pointerup` / `pointercancel` / 위 격자 밖 판정에서 타이머를 지우고 모드를 해제하며
  스크롤을 복구한다. 기존 컨테이너 `pointerleave`의 `endDrag`는 마우스용으로 그대로 둔다. 이미 칠해진
  칸은 되돌리지 않는다.
- **OS 길게 누르기 차단**: 칠하는 중 손가락이 멈춰 있으면 Android는 약 500ms에 `contextmenu`를
  보내고, iOS는 콜아웃을 띄울 수 있다. 터치 누름이 진행 중(타이머 대기 또는 칠하기 모드)일 때
  컨테이너 `onContextMenu`에서 `preventDefault()`하고, 편집 칸에 `-webkit-touch-callout: none`을
  준다(Tailwind 임의 속성 `[-webkit-touch-callout:none]`). 텍스트 선택은 기존 `select-none`이 막는다.
- **피드백**: 모드 진입 시 `navigator.vibrate?.(10)`으로 짧은 진동을 준다. 미지원 환경에서는
  옵셔널 체이닝으로 조용히 건너뛰고 기능은 동일하게 동작한다.
- **비활성 연동**: `props.disabled`(FR-6)면 타이머 자체를 시작하지 않는다. 새 disabled 조건을
  만들지 않는다.
- **안내 문구**: `mode="edit"`일 때 스크롤 컨테이너 바로 위에 "길게 눌러 드래그하면 여러 칸을 칠할 수
  있어요"를 `<p>`로 렌더한다. `hidden pointer-coarse:block`(Tailwind 4 내장 `@media (pointer: coarse)`
  변형)으로 터치 기기에서만 보이게 해 JS 판별·하이드레이션 불일치가 없다. 히트맵 모드에서는 렌더하지
  않는다. TimeGrid 안에 두어 `poll-view.tsx`는 건드리지 않는다(반환을 Fragment로 감싼다 — 부모
  섹션의 `space-y-3`이 간격을 준다).
- **접근성**: 칸의 `role="checkbox"` / `aria-checked` / `aria-label`은 그대로 둔다. 롱프레스는
  터치 전용 추가 경로라 키보드·스크린리더 동선에 영향이 없다.
- **영향 파일**: `src/app/components/time-grid.tsx`(수정), `time-grid.test.tsx`(테스트 추가),
  `README.md`(모바일 조작 설명 갱신). `poll-view.tsx`/API/스키마는 변경 없음.
- **테스트 환경 준비**: 설치된 jsdom(26.1)에는 `PointerEvent`도 `document.elementFromPoint`도 없다.
  RTL `fireEvent`는 생성자가 없으면 일반 `Event`로 대체하므로 `pointerType`/`clientX`/`clientY`가
  **전달되지 않는다**(@testing-library/dom events.js). 따라서
  - `time-grid.test.tsx` 상단에서 `MouseEvent`를 상속해 `pointerId`/`pointerType`을 받는 최소
    `PointerEvent` 폴리필을 `window`에 등록한다(다른 테스트에 영향 없도록 이 파일 한정).
  - `elementFromPoint`는 원래 없는 함수라 `jest.spyOn`이 불가 — `document.elementFromPoint = jest.fn()`으로
    직접 할당하고 `afterEach`에서 제거한다. 좌표→칸 매핑은 이 목으로 흉내 낸다.
  - 격자 밖 판정용으로 컨테이너의 `getBoundingClientRect`도 목으로 고정한다.
  - 타이머는 `jest.useFakeTimers()`로 진행시킨다.
- **테스트 (RTL, time-grid.test.tsx 추가)**:
  - 터치로 누른 뒤 300ms 경과 → 그 칸이 토글되고 칠하기 모드로 들어가는지.
  - 칠하기 모드에서 같은 컬럼의 다른 칸으로 이동 → 처음 칸과 같은 방향으로 칠해지는지.
  - 다른 날짜 컬럼으로 이동 → 칠해지지 않는지.
  - 300ms 전에 임계치를 넘겨 움직이면 → 칠하기 모드로 들어가지 않고 아무것도 토글되지 않는지.
  - 짧은 탭(모드 미진입) → 기존처럼 한 칸만 토글되는지(회귀 방지).
  - 롱프레스 후 손을 뗄 때 이어지는 click이 마지막 칸을 다시 토글하지 않는지.
  - 롱프레스+드래그 후 click 없이 끝난 다음, 새 짧은 탭이 정상적으로 토글되는지(플래그 누수 회귀 방지).
  - 칠하기 모드 중 격자 밖 좌표로 이동하면 모드가 끝나고, 다시 안으로 들어와도 칠해지지 않는지.
  - 칠하기 모드 중 `contextmenu`가 `preventDefault`되는지.
  - `disabled`면 롱프레스해도 아무 일이 없는지.
  - 안내 문구가 edit 모드에서만 렌더되고 heatmap 모드에는 없는지.
  - 마우스 드래그(pointerType="mouse")가 기존과 동일하게 동작하는지(회귀 방지).
- **구현 순서**: T12 — `time-grid.tsx` 수정 + 테스트 추가 → `npm run lint`/`test`/`build` 통과 →
  README의 "모바일은 탭, 데스크톱은 드래그" 문구 갱신 → spec.md의 해당 리비전 줄에 "구현 완료" 기록.

## 11. 개정: 터치 칠하기 중 가장자리 자동 스크롤 (FR-16, 2026-10-09)

새 데이터 모델/API 없음 — `time-grid.tsx`의 터치 칠하기 경로(§10)만 고친다. 마우스/펜 경로는 불변.

- **문제**: 칠하기 모드에서는 네이티브 스크롤을 막으므로(§10 스크롤 잠금) 손가락을 아래로 내려도
  격자가 따라오지 않고, 격자 밖으로 나가면 모드가 끝났다. 가려진 칸은 스크롤 후 다시 롱프레스해야 했다.
- **보이는 영역**: 격자 컨테이너 `getBoundingClientRect()`와 뷰포트(`0..window.innerHeight`)의 교집합
  세로 구간 `[top, bottom]`을 기준으로 한다(페이지가 스크롤돼 격자 일부가 화면 밖일 수 있으므로).
- **속도**: `AUTO_SCROLL_EDGE_PX`(48px) 안쪽 가장자리 구간에 들어오면 깊이에 비례해, 구간 밖(격자 밖)이면
  최대 `AUTO_SCROLL_MAX_PX`(프레임당 14px)로 스크롤한다. 순수 함수 `autoScrollDelta(y, top, bottom)`로 뽑는다.
- **스크롤 대상**: 먼저 격자 컨테이너의 `scrollTop`을 옮기고, 더 못 움직이면(끝에 닿음) 격자가 그 방향으로
  화면 밖에 이어져 있을 때만 `window.scrollBy`로 페이지를 옮긴다. 둘 다 프로그램 스크롤이라 §10의 touchmove
  `preventDefault` 잠금과 충돌하지 않는다.
- **루프**: 칠하기 모드 중 `pointermove`마다 마지막 손가락 좌표(`lastX/lastY`)를 저장하고, rAF 루프가 없으면
  시작한다. 각 프레임은 delta를 다시 계산해 0이면 멈추고, 아니면 스크롤한 뒤 `paintAt(lastX, lastY)`로 손가락
  아래 새로 들어온 칸을 칠한다(손가락이 멈춰 있어도 pointermove가 오지 않으므로 루프에서 칠해야 한다).
  `endTouch`(pointerup/cancel)와 언마운트에서 `cancelAnimationFrame`.
- **격자 밖 판정 개정**: §10의 "격자 밖이면 모드 종료"를 제거한다. 칸 찾기(`elementFromPoint` → `data-slot-id`)가
  컨테이너 안의 칸이 아니면 칠하지 않을 뿐 모드는 유지한다.
- **테스트 (time-grid.test.tsx)**:
  - `autoScrollDelta`: 가운데 0, 위/아래 가장자리 깊이에 비례한 음/양수, 밖이면 ±최대값.
  - 칠하기 모드 중 아래 가장자리로 이동 → 컨테이너 `scrollTop`이 증가하고, 스크롤 후 손가락 아래 들어온 칸이 칠해지는지.
  - 격자 밖으로 나갔다가 다시 들어오면 계속 칠해지는지(기존 "재개 안 됨" 테스트를 대체).
  - pointerup 후에는 자동 스크롤이 멈추는지.
- **구현 순서**: T13 — `time-grid.tsx` 수정 + 테스트 → `npm run lint`/`test`/`build` 통과 → spec 리비전 줄 확인.
