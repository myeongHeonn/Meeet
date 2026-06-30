"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TimeGrid } from "@/app/components/time-grid";
import {
  aggregateHeatmap,
  type AvailabilityRow,
  type ParticipantRow,
} from "@/lib/polls/aggregate";
import { getZonedParts } from "@/lib/datetime";

interface PollSummary {
  title: string;
  description: string | null;
  status: "open" | "confirmed";
  confirmedSlotId: string | null;
}

interface Props {
  token: string;
  poll: PollSummary;
  slots: { id: string; startsAt: string }[];
  participants: ParticipantRow[];
  availabilities: AvailabilityRow[];
}

function formatSlotLabel(startsAt: string, timeZone: string): string {
  const p = getZonedParts(new Date(startsAt), timeZone);
  return `${p.month}/${p.day} (${p.weekday}) ${String(p.hour).padStart(2, "0")}:${String(
    p.minute,
  ).padStart(2, "0")}`;
}

export function PollView({
  token,
  poll,
  slots,
  participants,
  availabilities,
}: Props) {
  const router = useRouter();

  // SSR/첫 렌더는 UTC로 시작하고, 마운트 후 뷰어 타임존으로 갱신해 hydration mismatch를 피한다(FR-12).
  const [timeZone, setTimeZone] = useState("UTC");
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmSlot, setConfirmSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const heatmap = useMemo(
    () => aggregateHeatmap(participants, availabilities),
    [participants, availabilities],
  );

  const isOpen = poll.status === "open";

  async function submitResponse() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/polls/${token}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), availableSlotIds: [...selected] }),
      });
      if (res.ok) {
        setMessage("응답이 저장되었어요.");
        router.refresh();
      } else if (res.status === 409) {
        setMessage("이미 확정된 폴이에요.");
        router.refresh();
      } else {
        setMessage("응답 저장에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!confirmSlot) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/polls/${token}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: confirmSlot }),
      });
      if (res.ok) {
        router.refresh();
      } else if (res.status === 409) {
        setMessage("방금 다른 사람이 확정했어요.");
        router.refresh();
      } else {
        setMessage("확정에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{poll.title}</h1>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              isOpen ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}
          >
            {isOpen ? "모집 중" : "확정됨"}
          </span>
          <span className="text-xs text-gray-500">
            응답 {heatmap.totalParticipants}명
          </span>
        </div>
        {poll.description && <p className="text-sm text-gray-600">{poll.description}</p>}
        {!isOpen && poll.confirmedSlotId && (
          <p className="text-sm font-medium text-blue-700">
            ✓ 확정:{" "}
            {formatSlotLabel(
              slots.find((s) => s.id === poll.confirmedSlotId)?.startsAt ?? "",
              timeZone,
            )}
          </p>
        )}
      </header>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      <div className="grid gap-8 md:grid-cols-2">
        {isOpen && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">내 가능 시간 (드래그로 칠하기)</h2>
            <input
              aria-label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="이름을 입력하면 칠할 수 있어요"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <TimeGrid
              mode="edit"
              slots={slots}
              timeZone={timeZone}
              value={selected}
              disabled={name.trim().length === 0}
              onToggle={(slotId, next) =>
                setSelected((prev) => {
                  const s = new Set(prev);
                  if (next) s.add(slotId);
                  else s.delete(slotId);
                  return s;
                })
              }
            />
            <button
              type="button"
              disabled={busy || name.trim().length === 0}
              onClick={submitResponse}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              응답 제출
            </button>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">그룹 현황 (히트맵)</h2>
          <TimeGrid
            mode="heatmap"
            slots={slots}
            timeZone={timeZone}
            tallyBySlot={heatmap.bySlot}
            totalParticipants={heatmap.totalParticipants}
            confirmedSlotId={poll.confirmedSlotId}
            onCellClick={isOpen ? (slotId) => setConfirmSlot(slotId) : undefined}
            selectedCellId={confirmSlot}
          />
          {isOpen && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                히트맵에서 칸을 고른 뒤 확정하세요 (링크 소지자 누구나).
              </p>
              <button
                type="button"
                disabled={busy || !confirmSlot}
                onClick={confirm}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {confirmSlot
                  ? `${formatSlotLabel(
                      slots.find((s) => s.id === confirmSlot)?.startsAt ?? "",
                      timeZone,
                    )}(으)로 확정`
                  : "이 시간으로 확정"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
