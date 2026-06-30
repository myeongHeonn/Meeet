"use client";

import { useState } from "react";

interface Props {
  selected: Set<string>; // "YYYY-MM-DD" (브라우저 로컬 날짜)
  onToggle: (dateKey: string) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toKey(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

export function DatePickerCalendar({ selected, onToggle }: Props) {
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const now = new Date();
  const todayKey = toKey(now.getFullYear(), now.getMonth(), now.getDate());

  const startWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const m = v.month + delta;
      return {
        year: v.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      };
    });

  return (
    <div className="inline-block rounded border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="px-2 py-1 text-gray-600 hover:bg-gray-100"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {view.year}년 {view.month + 1}월
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="px-2 py-1 text-gray-600 hover:bg-gray-100"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium text-gray-500">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const key = toKey(view.year, view.month, day);
          const isPast = key < todayKey;
          const isSelected = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              aria-pressed={isSelected}
              onClick={() => onToggle(key)}
              className={`h-8 w-8 rounded text-sm ${
                isPast
                  ? "cursor-not-allowed text-gray-300"
                  : isSelected
                    ? "bg-green-500 text-white"
                    : "hover:bg-green-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
