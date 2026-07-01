import { NextResponse } from "next/server";
import { createPollSchema } from "@/lib/validations/poll";
import { createPoll } from "@/lib/polls/mutations";
import { parseJsonBody } from "@/lib/http";

// POST /api/polls — 미팅 폴 생성 (인증 불필요, FR-1).
export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, createPollSchema);
  if (!parsed.ok) return parsed.response;

  const { token } = await createPoll(parsed.data);
  return NextResponse.json({ token }, { status: 201 });
}
