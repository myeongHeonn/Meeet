import { NextResponse } from "next/server";
import { submitResponseSchema } from "@/lib/validations/poll";
import { submitResponse } from "@/lib/polls/mutations";

// POST /api/polls/{token}/responses — 참가자 응답 제출/수정 (인증 불필요, FR-6,7).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = submitResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력이 올바르지 않습니다", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await submitResponse(token, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
