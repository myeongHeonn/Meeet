import { NextResponse } from "next/server";
import { getPollByToken } from "@/lib/polls/queries";
import { jsonError } from "@/lib/http";

// GET /api/polls/{token} — 그룹 현황 실시간 갱신용. 참가자+가용시간만 반환한다(FR-8, 폴링).
// 슬롯/폴 메타는 변하지 않으므로 최초 SSR 데이터를 그대로 쓰고 여기서는 재전송하지 않는다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getPollByToken(token);
  if (!data) return jsonError(404, "존재하지 않거나 만료된 폴입니다");

  return NextResponse.json({
    participants: data.participants.map((p) => ({ id: p.id, name: p.name })),
    availabilities: data.availabilities.map((a) => ({
      participantId: a.participantId,
      pollSlotId: a.pollSlotId,
    })),
  });
}
