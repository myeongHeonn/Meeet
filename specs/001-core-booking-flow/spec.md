# Spec: 핵심 예약 흐름 (Core Booking Flow)

- Status: Draft
- Owner: TBD
- Created: 2026-06-30

## 1. 배경 / 문제 정의
Meeet은 미팅/일정 스케줄링 서비스다. 호스트가 자신의 가능한 시간을 등록해두면,
초대받은 사람이 캘린더 없이도 공개 링크를 통해 가능한 시간을 골라 예약할 수 있어야 한다.
이 스펙은 Meeet의 가장 핵심적인 첫 번째 기능, 즉 "이벤트 타입 생성 → 가용 시간 설정 →
공개 예약 링크 → 초대자가 시간 선택 후 예약" 흐름을 정의한다.

## 2. 목표 (Goals)
- 호스트는 회원가입 후 하나 이상의 "이벤트 타입"(예: "30분 미팅")을 만들 수 있다.
- 호스트는 요일별 가용 시간(weekly availability)을 설정할 수 있다.
- 호스트는 이벤트 타입별 공개 예약 링크를 받는다.
- 초대자는 로그인 없이 공개 링크에서 예약 가능한 시간 슬롯을 보고 하나를 선택해 예약할 수 있다.
- 호스트는 자신에게 들어온 예약 목록을 확인하고 취소할 수 있다.

## 3. 비목표 (Non-Goals)
- 외부 캘린더 연동(Google Calendar 양방향 동기화)은 다음 스펙으로 미룬다.
- 이메일/알림 발송은 다음 스펙으로 미룬다 (예약 데이터만 저장).
- 결제, 유료 플랜은 범위 밖.
- 팀/그룹 스케줄링(여러 호스트가 얽힌 이벤트)은 범위 밖.

## 4. 사용자 시나리오 (User Stories)
- P1: As a 호스트, I want to 이벤트 타입(제목, 길이)을 만들고, so that 초대자에게 공유할 예약 링크가 생긴다.
- P1: As a 호스트, I want to 요일별 가용 시간을 설정하고, so that 내가 가능한 시간에만 예약이 들어온다.
- P1: As a 초대자, I want to 공개 링크에서 비어있는 시간을 보고 선택하고, so that 별도 조율 없이 미팅을 예약할 수 있다.
- P1: As a 초대자, I want to 이름/이메일을 입력하고 예약을 확정하고, so that 호스트가 누가 예약했는지 알 수 있다.
- P2: As a 호스트, I want to 들어온 예약 목록을 보고, so that 다가오는 미팅을 파악할 수 있다.
- P2: As a 호스트, I want to 예약을 취소하고, so that 더 이상 불가능한 미팅을 정리할 수 있다.

## 5. 기능 요구사항 (Functional Requirements)
- FR-1: 호스트는 이메일 기반 계정을 가지며, 이벤트 타입은 호스트 계정에 종속된다.
- FR-2: 이벤트 타입은 제목, 설명(선택), 길이(분 단위), 고유 slug를 가진다. slug는 호스트 범위 내에서 유일하다.
- FR-3: 호스트는 요일(월~일)별로 0개 이상의 시작/종료 시간 구간을 가용 시간으로 설정할 수 있다.
- FR-4: 가용 시간이 설정되지 않은 요일은 예약 불가로 처리한다.
- FR-5: 공개 예약 페이지(`/{hostHandle}/{eventSlug}`)는 호스트의 가용 시간과 기존 예약을 기준으로 향후 N일(기본 14일)간의 가능한 시간 슬롯을 이벤트 길이 단위로 계산해 보여준다.
- FR-6: 이미 예약이 존재하는 슬롯은 가능한 시간 목록에서 제외한다(겹침 방지).
- FR-7: 초대자가 슬롯을 선택하고 이름/이메일을 제출하면 예약(Booking)이 생성된다.
- FR-8: 동시에 같은 슬롯에 대해 두 개의 예약 요청이 들어오면 하나만 성공해야 한다(DB 제약조건 또는 트랜잭션으로 보장).
- FR-9: 호스트는 인증된 상태에서 자신의 모든 예약 목록(예정/지난/취소됨)을 조회할 수 있다.
- FR-10: 호스트는 자신의 예약을 취소할 수 있으며, 취소된 슬롯은 다시 예약 가능 상태가 된다.
- FR-11: 모든 사용자 입력(이벤트 타입 생성, 가용 시간 설정, 예약 제출)은 Zod 스키마로 검증한다.

## 6. 데이터 모델 (Data Model)

| 엔티티 | 필드 | 타입 | 제약조건 |
|---|---|---|---|
| User (Host) | id | uuid | PK |
| | email | text | unique, not null |
| | name | text | not null |
| | handle | text | unique, not null (공개 URL용) |
| | createdAt | timestamp | not null, default now |
| EventType | id | uuid | PK |
| | hostId | uuid | FK -> User.id, not null |
| | title | text | not null |
| | description | text | nullable |
| | slug | text | not null |
| | durationMinutes | integer | not null, > 0 |
| | createdAt | timestamp | not null, default now |
| | (unique) | hostId + slug | unique |
| Availability | id | uuid | PK |
| | hostId | uuid | FK -> User.id, not null |
| | weekday | integer | not null, 0~6 |
| | startTime | time | not null |
| | endTime | time | not null, > startTime |
| Booking | id | uuid | PK |
| | eventTypeId | uuid | FK -> EventType.id, not null |
| | startsAt | timestamp (tz) | not null |
| | endsAt | timestamp (tz) | not null |
| | inviteeName | text | not null |
| | inviteeEmail | text | not null |
| | status | enum(confirmed, cancelled) | not null, default confirmed |
| | createdAt | timestamp | not null, default now |
| | (unique) | eventTypeId + startsAt (status=confirmed인 행만) | 슬롯 중복 예약 방지 |

## 7. API / 인터페이스 개요
- `POST /api/event-types` — 이벤트 타입 생성 (인증 필요)
- `PUT /api/availability` — 호스트 가용 시간 설정 (인증 필요)
- `GET /{handle}/{slug}` — 공개 예약 페이지 (App Router page, 서버 컴포넌트)
- `GET /api/event-types/{id}/slots?from=&to=` — 가능한 시간 슬롯 조회
- `POST /api/bookings` — 예약 생성 (공개, 인증 불필요)
- `GET /dashboard/bookings` — 호스트의 예약 목록 (인증 필요)
- `POST /api/bookings/{id}/cancel` — 예약 취소 (인증 필요, 본인 소유만)

## 8. 엣지 케이스 & 에러 처리
- 동시성: 같은 슬롯에 대한 동시 예약 요청은 DB unique 제약(부분 인덱스: status=confirmed)으로 하나만 성공시키고, 나머지는 409 Conflict를 반환한다.
- 타임존: 호스트의 가용 시간은 호스트의 타임존 기준으로 저장하고, 슬롯 계산 시 UTC로 변환한다. (호스트 타임존 필드는 User에 추가 필요 — Open Question 참고)
- 길이가 0이거나 음수인 이벤트 타입, startTime >= endTime인 가용 시간은 Zod 단계에서 거부한다.
- 과거 시간에 대한 예약 요청은 거부한다.
- slug 중복 생성 시도는 409로 거부한다.

## 9. 열린 질문 (Open Questions)
- [ ] 호스트의 타임존을 어디서 어떻게 설정/저장할 것인가? (User.timezone 필드 추가 필요해 보임)
- [ ] 인증 방식은 무엇으로 할 것인가? (이메일 매직링크 / OAuth / 비밀번호) — 별도 스펙(000-auth)으로 분리할지 결정 필요
- [ ] 슬롯 조회 범위 기본값(14일)이 적절한가?
