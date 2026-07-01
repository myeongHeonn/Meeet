// 클라이언트에서 JSON POST를 보내고 상태/파싱 결과를 표준 형태로 돌려준다.
// 네트워크 오류(fetch throw)는 호출자에게 그대로 전파해 각 화면이 처리한다.

export interface PostJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null; // 응답이 2xx일 때만 파싱, 아니면 null.
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
): Promise<PostJsonResult<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  return { ok: res.ok, status: res.status, data };
}

// 최신 데이터 조회용 GET. 항상 서버에서 다시 읽도록 캐시를 끈다(실시간 폴링, FR-8).
export async function getJson<T = unknown>(url: string): Promise<PostJsonResult<T>> {
  const res = await fetch(url, { cache: "no-store" });
  const data = res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  return { ok: res.ok, status: res.status, data };
}
