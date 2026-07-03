import { neonConfig, Pool } from "@neondatabase/serverless";
import {
  drizzle as drizzleNeon,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// 운영/프리뷰(Neon)는 서버리스 드라이버를 쓴다: 단발 쿼리는 fetch(HTTP)로 나가고
// (poolQueryViaFetch), 트랜잭션만 WebSocket 연결을 쓴다. TCP+TLS 핸드셰이크가 없어
// 서버리스 콜드 스타트에서 postgres-js보다 빠르다. 로컬 Postgres는 Neon 프록시가
// 없으므로 기존 postgres-js(TCP)를 유지한다.
neonConfig.poolQueryViaFetch = true;

const isNeon = connectionString.includes("neon.tech");

export const db: NeonDatabase<typeof schema> = isNeon
  ? drizzleNeon(new Pool({ connectionString }), { schema })
  : (drizzlePostgresJs(postgres(connectionString), {
      schema,
    }) as unknown as NeonDatabase<typeof schema>);
