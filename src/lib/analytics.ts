// 폴 주소(/p/<token>)의 토큰은 조회·참여·확정 권한 그 자체라서(spec §9) 분석 도구로
// 내보내지 않는다. 경로를 /p/[token]으로 바꿔 보내면 폴 페이지 방문 수는 그대로 집계된다.
export function redactPollToken(url: string): string {
  const u = new URL(url);
  u.pathname = u.pathname.replace(/^\/p\/[^/]+/, "/p/[token]");
  return u.toString();
}
