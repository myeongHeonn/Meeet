"use client";

import { useRef } from "react";
import { buildGridLayout, cellKey, type LayoutSlot } from "@/lib/polls/layout";
import type { SlotTally } from "@/lib/polls/aggregate";

interface CommonProps {
  slots: LayoutSlot[];
  timeZone: string;
  confirmedSlotId?: string | null;
}

interface EditProps extends CommonProps {
  mode: "edit";
  value: Set<string>;
  onToggle: (slotId: string, next: boolean) => void;
  disabled?: boolean;
}

interface HeatmapProps extends CommonProps {
  mode: "heatmap";
  tallyBySlot: Map<string, SlotTally>;
  totalParticipants: number;
  onCellClick?: (slotId: string) => void;
  selectedCellId?: string | null;
}

export type TimeGridProps = EditProps | HeatmapProps;

function formatDateLabel(dateKey: string): string {
  // 정오 기준 Date로 만들어 로컬 변환 시 요일이 밀리지 않게 한다.
  const d = new Date(`${dateKey}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(d);
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)} (${weekday})`;
}

export function TimeGrid(props: TimeGridProps) {
  const layout = buildGridLayout(props.slots, props.timeZone);
  // 드래그 페인트 상태: active(드래그 중), target(칠하는 목표 값).
  const drag = useRef<{ active: boolean; target: boolean }>({
    active: false,
    target: false,
  });

  if (layout.dateKeys.length === 0) {
    return <p className="text-sm text-gray-500">표시할 시간이 없습니다.</p>;
  }

  const endDrag = () => {
    drag.current.active = false;
  };

  function renderCell(slotId: string) {
    const isConfirmed = props.confirmedSlotId === slotId;

    if (props.mode === "edit") {
      const selected = props.value.has(slotId);
      return (
        <div
          role="checkbox"
          aria-checked={selected}
          aria-label={`slot-${slotId}`}
          data-slot-id={slotId}
          className={`h-7 w-20 border border-white ${
            selected ? "bg-green-500" : "bg-gray-200"
          } ${props.disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          onPointerDown={() => {
            const next = !selected;
            drag.current = { active: true, target: next };
            props.onToggle(slotId, next);
          }}
          onPointerEnter={() => {
            if (drag.current.active) props.onToggle(slotId, drag.current.target);
          }}
        />
      );
    }

    const tally = props.tallyBySlot.get(slotId);
    const count = tally?.count ?? 0;
    const ratio = props.totalParticipants > 0 ? count / props.totalParticipants : 0;
    const selected = props.selectedCellId === slotId;
    return (
      <div
        data-slot-id={slotId}
        title={
          count > 0
            ? `${count}/${props.totalParticipants}명: ${tally!.names.join(", ")}`
            : `0/${props.totalParticipants}명`
        }
        className={`flex h-7 w-20 items-center justify-center border border-white text-[10px] text-gray-800 ${
          props.onCellClick ? "cursor-pointer" : ""
        } ${isConfirmed ? "ring-2 ring-blue-500 ring-inset" : ""} ${
          selected ? "outline outline-2 outline-blue-400" : ""
        }`}
        style={{
          backgroundColor:
            count > 0 ? `rgba(34,197,94,${0.15 + 0.85 * ratio})` : "#f3f4f6",
        }}
        onClick={() => props.onCellClick?.(slotId)}
      >
        {count > 0 ? count : ""}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto select-none"
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="w-14" />
            {layout.dateKeys.map((dk) => (
              <th
                key={dk}
                className="px-2 py-1 font-medium whitespace-nowrap text-gray-700"
              >
                {formatDateLabel(dk)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.timeKeys.map((tk) => (
            <tr key={tk}>
              <td className="pr-2 text-right align-top text-gray-500 whitespace-nowrap">
                {tk}
              </td>
              {layout.dateKeys.map((dk) => {
                const slotId = layout.cell.get(cellKey(dk, tk));
                return (
                  <td key={dk} className="p-0">
                    {slotId ? (
                      renderCell(slotId)
                    ) : (
                      <div className="h-7 w-20 bg-gray-50" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
