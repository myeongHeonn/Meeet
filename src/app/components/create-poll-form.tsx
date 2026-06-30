"use client";

import { useMemo, useState } from "react";
import { DatePickerCalendar } from "./date-picker-calendar";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function CreatePollForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const cellsPerDay = useMemo(() => {
    const diff = minutesOf(endTime) - minutesOf(startTime);
    return diff > 0 ? diff / 30 : 0;
  }, [startTime, endTime]);
  const totalCells = dates.size * cellsPerDay;

  const valid =
    title.trim().length > 0 && dates.size > 0 && minutesOf(endTime) > minutesOf(startTime);

  const toggleDate = (key: string) =>
    setDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dates: [...dates],
          startTime,
          endTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        setError("폴 생성에 실패했습니다. 입력을 확인해주세요.");
        return;
      }
      const data = (await res.json()) as { token: string };
      setToken(data.token);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/p/${token}` : `/p/${token}`;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">✓ 폴이 만들어졌어요</h2>
        <p className="text-sm text-gray-600">이 링크를 참가자에게 공유하세요.</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            aria-label="공유 링크"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            복사
          </button>
        </div>
        <a href={`/p/${token}`} className="inline-block text-sm text-blue-600 hover:underline">
          폴로 이동 →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">
          제목 *
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="예: 팀 회식 일정"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="description">
          설명 (선택)
        </label>
        <input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">후보 날짜 *</span>
        <DatePickerCalendar selected={dates} onToggle={toggleDate} />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">하루 시간 범위 *</span>
        <div className="flex items-center gap-2 text-sm">
          <select
            aria-label="시작 시각"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span>부터</span>
          <select
            aria-label="종료 시각"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-gray-500">(30분 단위)</span>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        선택 요약: {dates.size}일 × {startTime}–{endTime} = 칸 {totalCells}개
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={!valid || submitting}
        onClick={handleSubmit}
        className="rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "만드는 중…" : "폴 만들기"}
      </button>
    </div>
  );
}
