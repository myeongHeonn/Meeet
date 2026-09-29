import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPollByToken } from "@/lib/polls/queries";
import { PollView } from "./poll-view";

// 폴 페이지는 토큰을 아는 사람만 보는 곳이라 검색 결과에 싣지 않는다(spec §9).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PollPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPollByToken(token);
  if (!data) notFound();

  return (
    // body가 flex-col이라 mx-auto만 있으면 main이 내용 폭으로 수축한다 — w-full로 강제.
    <main className="mx-auto w-full max-w-4xl px-4 pt-4 pb-8 md:py-12">
      <PollView
        token={token}
        poll={{
          title: data.poll.title,
          description: data.poll.description,
        }}
        slots={data.slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
        }))}
        participants={data.participants.map((p) => ({ id: p.id, name: p.name }))}
        availabilities={data.availabilities.map((a) => ({
          participantId: a.participantId,
          pollSlotId: a.pollSlotId,
        }))}
      />
    </main>
  );
}
