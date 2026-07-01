import { notFound } from "next/navigation";
import { getPollByToken } from "@/lib/polls/queries";
import { PollView } from "./poll-view";

export default async function PollPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPollByToken(token);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 pt-4 pb-8 md:py-12">
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
