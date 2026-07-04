"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePickerCalendar } from "./date-picker-calendar";
import { hhmmToMinutes, pad2 } from "@/lib/datetime";
import { toggleSetItem } from "@/lib/collections";
import { postJson } from "@/lib/api-client";
import { creatorFlagKey } from "@/lib/creator-flag";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${pad2(h)}:${m}`;
});

const END_TIME_OPTIONS = [...TIME_OPTIONS, "24:00"];

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";

const selectClass =
  "rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10";

export function CreatePollForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    title.trim().length > 0 &&
    dates.size > 0 &&
    hhmmToMinutes(endTime) > hhmmToMinutes(startTime);

  const toggleDate = (key: string) => setDates((prev) => toggleSetItem(prev, key));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await postJson<{ token: string }>("/api/polls", {
        title: title.trim(),
        dates: [...dates],
        startTime,
        endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!res.ok || !res.data) {
        setError("폴 생성에 실패했습니다. 입력을 확인해주세요.");
        setSubmitting(false);
        return;
      }
      try {
        // 이 탭에서 만든 폴임을 표시해두면 폴 페이지가 공유 링크 배너를 띄운다.
        window.sessionStorage.setItem(creatorFlagKey(res.data.token), "1");
      } catch {
        // 저장소가 막힌 환경에서는 배너 없이 진행한다.
      }
      // 별도 완료 화면 없이 폴 페이지로 바로 이동한다. 공유 링크는 폴 페이지의
      // 생성자 배너가 보여주고, URL이 히스토리에 남아 링크 유실도 줄어든다.
      // 이동이 끝날 때까지 submitting을 유지해 버튼이 다시 활성화되지 않게 한다.
      router.push(`/p/${res.data.token}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="title">
          제목 <span className="text-gray-400">*</span>
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={inputClass}
          placeholder="예: 팀 회식 일정"
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium">
          후보 날짜 <span className="text-gray-400">*</span>
        </span>
        <DatePickerCalendar selected={dates} onToggle={toggleDate} />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium">
          하루 시간 범위 <span className="text-gray-400">*</span>
        </span>
        <div className="flex items-center gap-2 text-sm">
          <select
            aria-label="시작 시각"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={selectClass}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-gray-400">–</span>
          <select
            aria-label="종료 시각"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={selectClass}
          >
            {END_TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="text-gray-400 text-xs">30분 단위</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-2">
        <button
          type="button"
          disabled={!valid || submitting}
          onClick={handleSubmit}
          className="flex items-center gap-2 rounded-full bg-gray-900 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {submitting ? "만드는 중…" : "폴 만들기"}
        </button>
        {submitting && (
          <p className="text-sm text-gray-500">이벤트를 만드는 중입니다. 잠시만 기다려주세요.</p>
        )}
      </div>
    </div>
  );
}
