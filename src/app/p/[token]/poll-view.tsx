"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TimeGrid } from "@/app/components/time-grid";
import {
  aggregateHeatmap,
  splitParticipantsBySlot,
  type AvailabilityRow,
  type ParticipantRow,
} from "@/lib/polls/aggregate";
import { getZonedParts } from "@/lib/datetime";
import { withSetItem } from "@/lib/collections";
import { getJson, postJson } from "@/lib/api-client";

interface PollSummary {
  title: string;
  description: string | null;
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
  participants: initialParticipants,
  availabilities: initialAvailabilities,
}: Props) {
  // 그룹 현황은 다른 참가자의 응답을 반영해야 하므로 state로 두고 주기적으로 갱신한다(FR-8).
  const [participants, setParticipants] = useState(initialParticipants);
  const [availabilities, setAvailabilities] = useState(initialAvailabilities);

  // SSR/첫 렌더는 UTC로 시작하고, 마운트 후 뷰어 타임존으로 갱신해 hydration mismatch를 피한다(FR-12).
  const [timeZone, setTimeZone] = useState("UTC");
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // 최신 참가자·가용시간을 서버에서 다시 읽어 그룹 현황에 반영한다. 폴링/제출 직후 공용.
  const refetch = useCallback(async () => {
    const res = await getJson<{
      participants: ParticipantRow[];
      availabilities: AvailabilityRow[];
    }>(`/api/polls/${token}`);
    if (res.ok && res.data) {
      setParticipants(res.data.participants);
      setAvailabilities(res.data.availabilities);
    }
  }, [token]);

  // 탭이 보이는 동안 5초마다 폴링하고, 탭을 다시 볼 때 즉시 한 번 갱신한다(새로고침 없이 실시간 반영).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refetch();
    };
    const id = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refetch]);

  const [step, setStep] = useState<"edit" | "results">("edit");

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 상세를 볼 칸: hover는 미리보기, click은 고정(pin). hover가 있으면 그걸 우선한다(FR-8).
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [pinnedSlot, setPinnedSlot] = useState<string | null>(null);
  const detailSlot = hoveredSlot ?? pinnedSlot;

  // 본인 편집 토큰. 최초 제출 시 발급받아 localStorage에 저장하고, 재제출 시 동봉한다(FR-7).
  const editTokenRef = useRef<string | null>(null);
  const storageKey = `meeet:poll:${token}`;

  // 마운트 시 저장된 토큰으로 내 이전 응답(이름·선택)을 프리필한다(FR-7a). 최초 1회.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { editToken?: string; participantId?: string };
      editTokenRef.current = saved.editToken ?? null;
      const me = participants.find((p) => p.id === saved.participantId);
      if (me) {
        setName(me.name);
        setSelected(
          new Set(
            availabilities
              .filter((a) => a.participantId === saved.participantId)
              .map((a) => a.pollSlotId),
          ),
        );
      }
    } catch {
      // 손상된 값은 무시한다.
    }
    // 최초 1회만 프리필한다(이후 입력/제출은 사용자 주도).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heatmap = useMemo(
    () => aggregateHeatmap(participants, availabilities),
    [participants, availabilities],
  );

  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const slotLabel = (slotId: string | null) => {
    const slot = slotId ? slotById.get(slotId) : undefined;
    return slot ? formatSlotLabel(slot.startsAt, timeZone) : "";
  };

  const detail = useMemo(
    () =>
      detailSlot
        ? splitParticipantsBySlot(detailSlot, participants, availabilities)
        : null,
    [detailSlot, participants, availabilities],
  );

  async function submitResponse() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<{ editToken?: string; participantId?: string }>(
        `/api/polls/${token}/responses`,
        {
          name: name.trim(),
          availableSlotIds: [...selected],
          editToken: editTokenRef.current ?? undefined,
        },
      );
      if (res.ok) {
        const data = res.data;
        if (data?.editToken && data.participantId) {
          editTokenRef.current = data.editToken;
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              editToken: data.editToken,
              participantId: data.participantId,
            }),
          );
        }
        setMessage("응답이 저장되었어요.");
        setStep("results");
        await refetch();
      } else {
        setMessage("응답 저장에 실패했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{poll.title}</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
            {heatmap.totalParticipants}명 응답
          </span>
        </div>
        {poll.description && (
          <p className="text-sm text-gray-500">{poll.description}</p>
        )}
      </header>

      {/* 모바일 전용 탭 네비게이션 */}
      <div className="flex border-b border-gray-200 md:hidden">
        <button
          type="button"
          onClick={() => setStep("edit")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            step === "edit"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          내 가능 시간
        </button>
        <button
          type="button"
          onClick={() => setStep("results")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            step === "results"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          그룹 현황
        </button>
      </div>

      {message && (
        <p className="text-sm font-medium text-gray-700">{message}</p>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section className={`min-w-0 space-y-3 ${step === "results" ? "hidden md:block" : ""}`}>
          <h2 className="hidden text-sm font-semibold text-gray-700 md:block">내 가능 시간</h2>
          <input
            aria-label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="이름을 입력하면 칠할 수 있어요"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400"
          />
          <TimeGrid
            mode="edit"
            slots={slots}
            timeZone={timeZone}
            value={selected}
            disabled={name.trim().length === 0}
            onToggle={(slotId, next) =>
              setSelected((prev) => withSetItem(prev, slotId, next))
            }
          />
          <div className="sticky bottom-0 bg-white pt-2 pb-1 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={busy || name.trim().length === 0}
                onClick={submitResponse}
                className="flex items-center gap-2 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {busy ? "적용 중…" : "응답 제출"}
              </button>
              <button
                type="button"
                onClick={() => setStep("results")}
                className="text-sm text-gray-400 hover:text-gray-600 md:hidden"
              >
                그룹 현황 보기 →
              </button>
            </div>
            {busy && (
              <p className="text-sm text-gray-500">응답을 적용하는 중입니다. 잠시만 기다려주세요.</p>
            )}
          </div>
        </section>

        <section className={`min-w-0 space-y-3 ${step === "edit" ? "hidden md:block" : ""}`}>
          <div className="flex items-center justify-between md:block">
            <h2 className="text-sm font-semibold text-gray-700">그룹 현황</h2>
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="text-sm text-gray-400 hover:text-gray-600 md:hidden"
            >
              ← 내 가능 시간
            </button>
          </div>
          <TimeGrid
            mode="heatmap"
            slots={slots}
            timeZone={timeZone}
            tallyBySlot={heatmap.bySlot}
            totalParticipants={heatmap.totalParticipants}
            onSlotHover={setHoveredSlot}
            onSlotSelect={(slotId) =>
              setPinnedSlot((prev) => (prev === slotId ? null : slotId))
            }
            activeSlotId={detailSlot}
          />
          <p className="text-xs text-gray-400">
            칸을 가리키거나 클릭하면 누가 가능/불가능한지 볼 수 있어요.
          </p>
          <SlotDetail
            label={detailSlot ? slotLabel(detailSlot) : null}
            available={detail?.available ?? []}
            unavailable={detail?.unavailable ?? []}
          />
        </section>
      </div>
    </div>
  );
}

function SlotDetail({
  label,
  available,
  unavailable,
}: {
  label: string | null;
  available: ParticipantRow[];
  unavailable: ParticipantRow[];
}) {
  if (!label) {
    return (
      <p className="text-xs text-gray-400">칸을 가리키면 여기에 명단이 표시됩니다.</p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3.5 text-sm">
      <p className="font-semibold text-gray-800">{label}</p>
      <NameList
        title={`가능 ${available.length}명`}
        names={available.map((p) => p.name)}
        tone="available"
      />
      <NameList
        title={`불가능 ${unavailable.length}명`}
        names={unavailable.map((p) => p.name)}
        tone="unavailable"
      />
    </div>
  );
}

function NameList({
  title,
  names,
  tone,
}: {
  title: string;
  names: string[];
  tone: "available" | "unavailable";
}) {
  const chip =
    tone === "available"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-gray-100 text-gray-500";
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-400">{title}</p>
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {names.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}
            >
              {n}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-300">없음</p>
      )}
    </div>
  );
}
