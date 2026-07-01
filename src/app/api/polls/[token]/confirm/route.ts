import { NextResponse } from "next/server";
import { confirmPollSchema } from "@/lib/validations/poll";
import { confirmPoll } from "@/lib/polls/mutations";
import { jsonError, parseJsonBody } from "@/lib/http";

// POST /api/polls/{token}/confirm — 후보 칸 확정 (인증 불필요, 토큰 소지자면 누구나, FR-9).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = await parseJsonBody(req, confirmPollSchema);
  if (!parsed.ok) return parsed.response;

  const result = await confirmPoll(token, parsed.data.slotId);
  if (!result.ok) return jsonError(result.status, result.message);
  return NextResponse.json({ ok: true });
}
