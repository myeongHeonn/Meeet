import { randomBytes } from "node:crypto";

// 공개 폴 토큰. 단순 조회뿐 아니라 확정 권한까지 쥐므로(spec §9), 추측 공격을 막을
// 만큼 충분한 엔트로피(256bit)를 URL-safe 문자열로 생성한다.
export function generatePublicToken(): string {
  return randomBytes(32).toString("base64url");
}
