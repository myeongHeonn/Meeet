import { NextResponse } from "next/server";
import { submitResponseSchema } from "@/lib/validations/poll";
import { submitResponse } from "@/lib/polls/mutations";
import { jsonError, parseJsonBody } from "@/lib/http";

// POST /api/polls/{token}/responses — 참가자 응답 제출/수정 (인증 불필요, FR-6,7).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = await parseJsonBody(req, submitResponseSchema);
  if (!parsed.ok) return parsed.response;

  const result = await submitResponse(token, parsed.data);
  if (!result.ok) return jsonError(result.status, result.message);
  return NextResponse.json({ ok: true, ...result.data });
}
