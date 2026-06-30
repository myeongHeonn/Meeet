import { NextResponse } from "next/server";
import { confirmPollSchema } from "@/lib/validations/poll";
import { confirmPoll } from "@/lib/polls/mutations";

// POST /api/polls/{token}/confirm — 후보 칸 확정 (인증 불필요, 토큰 소지자면 누구나, FR-9).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = confirmPollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력이 올바르지 않습니다", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await confirmPoll(token, parsed.data.slotId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
