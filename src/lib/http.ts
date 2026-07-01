import { NextResponse } from "next/server";
import { type z } from "zod";

// 표준 JSON 에러 응답. 라우트 핸들러의 실패 분기를 한 형태로 통일한다.
export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// 요청 바디를 JSON으로 읽어 Zod로 검증한다(신뢰 경계에서의 입력 검증, 컨벤션).
// 실패 시 400 응답을 만들어 돌려주므로 호출부는 ok만 분기하면 된다.
export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<
  { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }
> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(400, "입력이 올바르지 않습니다", {
        issues: parsed.error.issues,
      }),
    };
  }
  return { ok: true, data: parsed.data };
}
