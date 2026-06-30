import { NextResponse } from "next/server";
import { createPollSchema } from "@/lib/validations/poll";
import { createPoll } from "@/lib/polls/mutations";

// POST /api/polls — 미팅 폴 생성 (인증 불필요, FR-1).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createPollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력이 올바르지 않습니다", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { token } = await createPoll(parsed.data);
  return NextResponse.json({ token }, { status: 201 });
}
