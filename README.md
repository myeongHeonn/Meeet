# Meeet

여러 사람이 참여하는 미팅 하나의 시간을 빠르게 정하는 일회성 도구 (When2meet/Doodle식).

## 스택
Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS 4 · Drizzle ORM ·
Postgres · Zod · Jest + React Testing Library · Vercel

## 시작하기

```bash
cp .env.example .env.local   # DATABASE_URL 설정
npm install
npm run dev
```

http://localhost:3000 에서 확인.

## 개발 방식
이 프로젝트는 SDD(Spec-Driven Development)로 개발한다. 기능을 추가하기 전에
`specs/` 디렉토리를 먼저 읽어볼 것. 자세한 워크플로우는 [AGENTS.md](./AGENTS.md) 참고.

## 명령어
| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm run test` | Jest |
| `npm run db:generate` | Drizzle 마이그레이션 생성 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run db:studio` | Drizzle Studio |
