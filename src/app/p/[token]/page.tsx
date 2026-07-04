import { notFound } from "next/navigation";
import { getPollByToken } from "@/lib/polls/queries";
import { PollView } from "./poll-view";
import { ShareBanner } from "./share-banner";

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
      <ShareBanner token={token} />
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
