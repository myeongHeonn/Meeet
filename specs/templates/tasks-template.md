# Tasks: {기능명}

`plan.md`를 실행 가능한 작업 단위로 쪼갠다. 각 작업은 하나의 커밋/PR 단위가 되는 것을 권장한다.

- [ ] T1: {작업} — 대상 FR: {FR-1}
- [ ] T2: {작업} — 대상 FR: {FR-2}
- [ ] T3: 테스트 작성 — 대상 FR: {FR-1, FR-2}

## 완료 조건 (Definition of Done)
- [ ] 모든 FR이 테스트로 커버됨
- [ ] `npm run lint`, `npm run test`, `npm run build` 통과
- [ ] spec.md의 Status를 Implemented로 갱신
