import { NextResponse } from "next/server";
import { deleteExpiredPolls } from "@/lib/polls/mutations";

// GET /api/cron/cleanup — 만료된 폴을 삭제하는 스케줄러 전용 엔드포인트(FR-13).
// CRON_SECRET이 설정되면 `Authorization: Bearer <secret>`가 있어야 실행된다(Vercel Cron 규약).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const deleted = await deleteExpiredPolls();
  return NextResponse.json({ deleted });
}
