"use client";

import { useRef } from "react";
import { buildGridLayout, cellKey, type LayoutSlot } from "@/lib/polls/layout";
import type { SlotTally } from "@/lib/polls/aggregate";

interface CommonProps {
  slots: LayoutSlot[];
  timeZone: string;
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
  // 칸을 가리키면(hover) 상세 미리보기, 클릭하면 고정(pin)해 상세를 연다(FR-8).
  onSlotHover?: (slotId: string | null) => void;
  onSlotSelect?: (slotId: string) => void;
  activeSlotId?: string | null; // 현재 상세를 보고 있는 칸(강조 표시).
}

export type TimeGridProps = EditProps | HeatmapProps;

// 드래그 페인트 상태.
// pending: 터치 시작 후 방향이 확정되기 전(가로이면 취소, 세로이면 커밋).
interface DragState {
  active: boolean;
  target: boolean;
  dateKey: string | null;
  pending: boolean;
  startX: number;
  startY: number;
  pendingSlotId: string | null;
}

function formatDateLabel(dateKey: string): string {
  // 정오 기준 Date로 만들어 로컬 변환 시 요일이 밀리지 않게 한다.
  const d = new Date(`${dateKey}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(d);
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)} (${weekday})`;
}

export function TimeGrid(props: TimeGridProps) {
  const layout = buildGridLayout(props.slots, props.timeZone);
  const drag = useRef<DragState>({
    active: false,
    target: false,
    dateKey: null,
    pending: false,
    startX: 0,
    startY: 0,
    pendingSlotId: null,
  });

  if (layout.dateKeys.length === 0) {
    return <p className="text-sm text-gray-500">표시할 시간이 없습니다.</p>;
  }

  const endDrag = () => {
    drag.current.active = false;
    drag.current.pending = false;
  };

  const onContainerLeave = () => {
    endDrag();
    if (props.mode === "heatmap") props.onSlotHover?.(null);
  };

  function renderCell(slotId: string, dateKey: string) {
    if (props.mode === "edit") {
      const selected = props.value.has(slotId);
      return (
        <div
          role="checkbox"
          aria-checked={selected}
          aria-label={`slot-${slotId}`}
          data-slot-id={slotId}
          data-date-key={dateKey}
          className={`h-7 w-20 border border-white ${
            selected ? "bg-gray-900" : "bg-gray-100"
          } ${props.disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          onPointerDown={(e) => {
            const next = !selected;
            if (e.pointerType === "touch") {
              // 터치: 방향 확정 전까지 선택을 보류한다.
              drag.current = {
                active: false,
                target: next,
                dateKey,
                pending: true,
                startX: e.clientX,
                startY: e.clientY,
                pendingSlotId: slotId,
              };
              // capture 해제 → pointermove가 이동한 요소로 버블링된다.
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } else {
              // 마우스: 즉시 토글하고 드래그 시작.
              drag.current = {
                active: true,
                target: next,
                dateKey,
                pending: false,
                startX: 0,
                startY: 0,
                pendingSlotId: null,
              };
              props.onToggle(slotId, next);
            }
          }}
          onPointerEnter={() => {
            // 마우스 드래그: 같은 열(날짜)일 때만 토글한다(가로 드래그 차단).
            if (drag.current.active && drag.current.dateKey === dateKey) {
              props.onToggle(slotId, drag.current.target);
            }
          }}
        />
      );
    }

    const tally = props.tallyBySlot.get(slotId);
    const count = tally?.count ?? 0;
    const ratio = props.totalParticipants > 0 ? count / props.totalParticipants : 0;
    const active = props.activeSlotId === slotId;
    return (
      <div
        data-slot-id={slotId}
        title={
          count > 0
            ? `${count}/${props.totalParticipants}명: ${tally!.names.join(", ")}`
            : `0/${props.totalParticipants}명`
        }
        className={`flex h-7 w-20 cursor-pointer items-center justify-center border border-white text-[10px] ${ratio > 0.5 ? "text-white" : "text-gray-900"} ${
          active ? "outline outline-2 -outline-offset-2 outline-violet-500" : ""
        }`}
        style={{
          backgroundColor:
            count > 0 ? `rgba(0,0,0,${0.08 + 0.87 * ratio})` : "#f3f4f6",
        }}
        onPointerEnter={() => props.onSlotHover?.(slotId)}
        onClick={() => props.onSlotSelect?.(slotId)}
      >
        {count > 0 ? count : ""}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto select-none max-h-[55vh] w-fit max-w-full"
      style={props.mode === "edit" ? { touchAction: "pan-x" } : undefined}
      onPointerUp={() => {
        // 터치 탭: 방향 판정 전 손가락을 뗐으면 단순 탭으로 처리해 선택한다.
        if (drag.current.pending && props.mode === "edit" && drag.current.pendingSlotId) {
          props.onToggle(drag.current.pendingSlotId, drag.current.target);
        }
        endDrag();
      }}
      onPointerCancel={endDrag}
      onPointerLeave={onContainerLeave}
      onPointerMove={(e) => {
        if (props.mode !== "edit" || e.pointerType !== "touch") return;

        if (drag.current.pending) {
          const dx = Math.abs(e.clientX - drag.current.startX);
          const dy = Math.abs(e.clientY - drag.current.startY);
          // 충분히 움직이지 않으면 아직 방향 판정 보류.
          if (dx < 5 && dy < 5) return;

          if (dx >= dy) {
            // 가로 방향: 선택 취소, 브라우저 스크롤에 맡긴다.
            drag.current.pending = false;
            return;
          }
          // 세로 방향: 첫 셀 선택을 커밋하고 드래그 모드로 전환.
          drag.current.pending = false;
          drag.current.active = true;
          if (drag.current.pendingSlotId) {
            props.onToggle(drag.current.pendingSlotId, drag.current.target);
          }
        }

        if (!drag.current.active) return;

        // 세로 드래그: 같은 날짜 열의 셀만 토글한다.
        const cell = (e.target as HTMLElement).closest("[data-slot-id]") as HTMLElement | null;
        if (!cell) return;
        const { slotId, dateKey } = cell.dataset;
        if (slotId && dateKey === drag.current.dateKey) {
          props.onToggle(slotId, drag.current.target);
        }
      }}
    >
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="w-14 sticky top-0 left-0 z-20 bg-white" />
            {layout.dateKeys.map((dk) => (
              <th
                key={dk}
                className="px-2 py-1 text-sm font-medium whitespace-nowrap text-gray-700 sticky top-0 z-10 bg-white"
              >
                {formatDateLabel(dk)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.timeKeys.map((tk) => (
            <tr key={tk}>
              <td className="pr-2 text-right align-top text-gray-500 whitespace-nowrap sticky left-0 z-[1] bg-white text-sm">
                {tk}
              </td>
              {layout.dateKeys.map((dk) => {
                const slotId = layout.cell.get(cellKey(dk, tk));
                return (
                  <td key={dk} className="p-0">
                    {slotId ? (
                      renderCell(slotId, dk)
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
