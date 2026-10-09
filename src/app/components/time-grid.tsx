"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
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

// 한 번의 칠하기 동작(획). 같은 날짜 컬럼 안에서 시작 칸~현재 칸 구간을 목표 상태로 칠한다(FR-6).
interface Stroke {
  target: boolean;
  dateKey: string | null;
  columnIds: string[]; // 획이 한정된 날짜 컬럼의 슬롯 id(시간순)
  anchor: number; // 시작 칸의 columnIds 인덱스
  original: Map<string, boolean>; // 획 시작 전 컬럼 각 칸의 선택 상태
  applied: Map<string, boolean>; // 획 동안 부모에 알린 현재 상태
}

const emptyStroke = (): Stroke => ({
  target: false,
  dateKey: null,
  columnIds: [],
  anchor: -1,
  original: new Map(),
  applied: new Map(),
});

// 마우스/펜 드래그 페인트 상태.
interface DragState extends Stroke {
  active: boolean;
  lastPointerType: string;
}

// 터치 칠하기 상태(FR-16). 길게 누르면 칠하기 모드, 그 전에 움직이면 네이티브 스크롤에 맡긴다.
interface TouchPaintState extends Stroke {
  timer: ReturnType<typeof setTimeout> | null; // 롱프레스 대기 중
  painting: boolean; // 칠하기 모드(스크롤 잠금)
  startX: number;
  startY: number;
  // 칠하기 모드를 거친 제스처 뒤의 click을 무시한다. 드래그 후엔 click이 안 오는 경우가 많아
  // click에서 지우지 않고 다음 터치 pointerdown에서 초기화한다.
  suppressClick: boolean;
}

const LONG_PRESS_MS = 300;
const MOVE_TOLERANCE_PX = 8;
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_PX = 14; // 프레임당

// 획을 칸 to까지 늘이거나 줄였을 때 바뀌어야 하는 칸과 그 상태. 구간 [anchor, to] 안은 목표 상태,
// 밖은 획 시작 전 상태다. 구간으로 계산하므로 포인터가 빠르게 움직여 건너뛴 칸도 채워진다.
export function strokeChanges(
  columnIds: string[],
  anchor: number,
  to: number,
  target: boolean,
  original: Map<string, boolean>,
  applied: Map<string, boolean>,
): [string, boolean][] {
  const lo = Math.min(anchor, to);
  const hi = Math.max(anchor, to);
  const changes: [string, boolean][] = [];
  columnIds.forEach((id, i) => {
    const next = i >= lo && i <= hi ? target : (original.get(id) ?? false);
    if (applied.get(id) !== next) changes.push([id, next]);
  });
  return changes;
}

// 손가락 y가 보이는 격자 구간 [top, bottom]의 가장자리에 가까울수록 빠르게, 밖이면 최대 속도로
// 스크롤할 양(위 음수/아래 양수). 가운데면 0.
export function autoScrollDelta(y: number, top: number, bottom: number): number {
  const ratio = (depth: number) => Math.min(1, depth / AUTO_SCROLL_EDGE_PX);
  if (y < top + AUTO_SCROLL_EDGE_PX) return -AUTO_SCROLL_MAX_PX * ratio(top + AUTO_SCROLL_EDGE_PX - y);
  if (y > bottom - AUTO_SCROLL_EDGE_PX) return AUTO_SCROLL_MAX_PX * ratio(y - (bottom - AUTO_SCROLL_EDGE_PX));
  return 0;
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
    ...emptyStroke(),
    active: false,
    lastPointerType: "mouse",
  });
  const touch = useRef<TouchPaintState>({
    ...emptyStroke(),
    timer: null,
    painting: false,
    startX: 0,
    startY: 0,
    suppressClick: false,
  });
  // 칠하는 중 마지막 포인터 좌표와 가장자리 자동 스크롤 rAF 루프. 마우스·터치 공용. 루프는 포인터가
  // 멈춰 있어도 스크롤로 그 아래 들어온 칸을 칠해야 하므로 마지막 좌표를 기억한다.
  const pointer = useRef<{ x: number; y: number; raf: number | null }>({ x: 0, y: 0, raf: null });
  // 마우스 드래그 동안 window에 단 pointermove/pointerup 리스너 해제 함수.
  const releaseMouse = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isEmpty = layout.dateKeys.length === 0;

  // touch-action은 이미 시작된 제스처에 적용되지 않으므로, 칠하기 모드 동안에만 non-passive
  // touchmove에서 스크롤을 막는다(React의 onTouchMove는 passive라 preventDefault가 안 먹는다).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const t = touch.current;
    const onTouchMove = (e: TouchEvent) => {
      if (t.painting) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    const p = pointer.current;
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      if (t.timer) clearTimeout(t.timer);
      if (p.raf !== null) cancelAnimationFrame(p.raf);
      releaseMouse.current?.();
    };
  }, [isEmpty]);

  if (isEmpty) {
    return <p className="text-sm text-gray-500">표시할 시간이 없습니다.</p>;
  }

  // 획을 칸 slotId까지 늘이거나 줄인다. 같은 날짜 컬럼일 때만(가로 드래그 차단). 마우스·터치 공용.
  // props.value 대신 획 스냅샷으로 계산해, 자동 스크롤 루프처럼 옛 렌더의 클로저에서 불려도 맞게 동작한다.
  const paint = (stroke: Stroke, slotId: string, dateKey: string) => {
    if (props.mode !== "edit" || stroke.dateKey !== dateKey || stroke.anchor < 0) return;
    const to = stroke.columnIds.indexOf(slotId);
    if (to < 0) return;
    const changes = strokeChanges(
      stroke.columnIds,
      stroke.anchor,
      to,
      stroke.target,
      stroke.original,
      stroke.applied,
    );
    for (const [id, next] of changes) {
      stroke.applied.set(id, next);
      props.onToggle(id, next);
    }
  };

  // 시작 칸과 그 날짜 컬럼의 현재 상태를 스냅샷하고 시작 칸을 칠한다.
  const beginStroke = (
    stroke: Stroke,
    slotId: string,
    dateKey: string,
    target: boolean,
    value: Set<string>,
  ) => {
    stroke.target = target;
    stroke.dateKey = dateKey;
    stroke.columnIds = columnSlotIds(dateKey);
    stroke.anchor = stroke.columnIds.indexOf(slotId);
    stroke.original = new Map(stroke.columnIds.map((id) => [id, value.has(id)]));
    stroke.applied = new Map(stroke.original);
    paint(stroke, slotId, dateKey);
  };

  const stopAutoScroll = () => {
    const p = pointer.current;
    if (p.raf !== null) cancelAnimationFrame(p.raf);
    p.raf = null;
  };

  const endDrag = () => {
    drag.current.active = false;
    stopAutoScroll();
    releaseMouse.current?.();
    releaseMouse.current = null;
  };

  // 마우스 드래그는 격자 밖으로 나가도 버튼을 놓을 때까지 이어진다. 격자 밖에선 칸의 pointerenter가 오지
  // 않으므로 window에서 좌표를 받아 칠하기·자동 스크롤을 이어 간다.
  const trackMouseDrag = () => {
    releaseMouse.current?.();
    const onMove = (e: PointerEvent) => {
      // 창 밖에서 버튼을 놓아 pointerup을 놓친 경우.
      if (e.buttons === 0) return endDrag();
      trackPointer(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    releaseMouse.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  };

  // 롱프레스 대기/칠하기 모드를 끝내고 스크롤을 돌려준다. suppressClick은 뒤따르는 click을 위해 남긴다.
  const endTouch = () => {
    const t = touch.current;
    if (t.timer) clearTimeout(t.timer);
    t.timer = null;
    t.painting = false;
    stopAutoScroll();
  };

  const startTouchPress = (
    e: ReactPointerEvent,
    slotId: string,
    dateKey: string,
    selected: boolean,
  ) => {
    const t = touch.current;
    endTouch();
    t.suppressClick = false;
    if (props.mode !== "edit" || props.disabled) return;
    const value = props.value;
    t.startX = e.clientX;
    t.startY = e.clientY;
    t.timer = setTimeout(() => {
      t.timer = null;
      t.painting = true;
      t.suppressClick = true;
      beginStroke(t, slotId, dateKey, !selected, value);
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };

  // 터치는 첫 칸이 포인터를 암묵 캡처해 다른 칸의 pointerenter가 오지 않으므로, 컨테이너로 버블된
  // pointermove 좌표로 손가락 아래 칸을 찾는다.
  const onContainerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const t = touch.current;
    if (t.timer) {
      // 롱프레스 전에 움직였다 → 스크롤 의도. 칠하기 모드로 들어가지 않는다.
      if (Math.hypot(e.clientX - t.startX, e.clientY - t.startY) > MOVE_TOLERANCE_PX) endTouch();
      return;
    }
    if (!t.painting) return;
    // 격자 밖으로 나가도 모드는 유지한다 — 칸이 아닌 곳에선 칠하지 않을 뿐이고, 위/아래로 나가면 자동 스크롤된다.
    trackPointer(e.clientX, e.clientY);
  };

  // 지금 진행 중인 획(마우스 드래그 또는 터치 칠하기 모드).
  const activeStroke = (): Stroke | null =>
    drag.current.active ? drag.current : touch.current.painting ? touch.current : null;

  // 칠하는 중 포인터가 움직였다: 좌표를 기억하고, 그 아래 칸까지 칠하고, 필요하면 자동 스크롤을 시작한다.
  const trackPointer = (x: number, y: number) => {
    const p = pointer.current;
    p.x = x;
    p.y = y;
    paintAt(x, y);
    if (p.raf === null) p.raf = requestAnimationFrame(autoScrollStep);
  };

  // 좌표 아래가 이 격자의 칸이면 진행 중인 획을 그 칸까지 늘이거나 줄인다.
  const paintAt = (x: number, y: number) => {
    const stroke = activeStroke();
    const el = containerRef.current;
    const cellEl = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-slot-id][data-date-key]");
    if (!stroke || !el || !cellEl || !el.contains(cellEl)) return;
    const { slotId, dateKey } = cellEl.dataset;
    if (slotId && dateKey) paint(stroke, slotId, dateKey);
  };

  // 칠하는 중 포인터가 보이는 격자의 위/아래 가장자리 근처면 그 방향으로 스크롤하고, 새로 포인터 아래
  // 들어온 칸을 칠한다. 격자가 끝까지 스크롤됐는데 화면 밖으로 이어져 있으면 페이지를 스크롤한다.
  const autoScrollStep = () => {
    const p = pointer.current;
    const el = containerRef.current;
    p.raf = null;
    if (!activeStroke() || !el) return;
    const rect = el.getBoundingClientRect();
    const dy = autoScrollDelta(
      p.y,
      Math.max(rect.top, 0),
      Math.min(rect.bottom, window.innerHeight),
    );
    if (dy === 0) return;
    const before = el.scrollTop;
    el.scrollTop = before + dy;
    if (el.scrollTop === before) {
      if ((dy > 0 && rect.bottom > window.innerHeight) || (dy < 0 && rect.top < 0)) {
        window.scrollBy(0, dy);
      }
    }
    paintAt(p.x, p.y);
    p.raf = requestAnimationFrame(autoScrollStep);
  };

  // 마우스 드래그는 격자를 벗어나도 끝내지 않는다(버튼을 놓을 때 window pointerup에서 끝난다).
  const onContainerLeave = () => {
    if (props.mode === "heatmap") props.onSlotHover?.(null);
  };

  const columnSlotIds = (dateKey: string): string[] =>
    layout.timeKeys
      .map((tk) => layout.cell.get(cellKey(dateKey, tk)))
      .filter((id): id is string => Boolean(id));

  const allSlotIds = (): string[] => layout.dateKeys.flatMap(columnSlotIds);

  // 대상 슬롯 중 하나라도 선택되어 있지 않으면 전체 채움, 전부 선택돼 있으면 전체 해제(FR-14/15).
  function toggleAll(slotIds: string[]) {
    if (props.mode !== "edit") return;
    const next = !slotIds.every((id) => props.value.has(id));
    for (const id of slotIds) props.onToggle(id, next);
  }

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
          className={`h-7 border border-white [-webkit-touch-callout:none] ${
            selected ? "bg-gray-900" : "bg-gray-100"
          } ${props.disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          onPointerDown={(e) => {
            drag.current.lastPointerType = e.pointerType;
            // 터치: 바로 칠하지 않고 롱프레스를 기다린다(FR-16). 짧은 탭은 onClick이 토글한다.
            if (e.pointerType === "touch") {
              startTouchPress(e, slotId, dateKey, selected);
              return;
            }
            // 마우스: 즉시 토글하고 드래그 시작.
            drag.current.active = true;
            beginStroke(drag.current, slotId, dateKey, !selected, props.value);
            trackMouseDrag();
          }}
          onPointerEnter={() => {
            // 마우스 드래그: 같은 열(날짜)일 때만 토글한다(가로 드래그 차단).
            if (drag.current.active) paint(drag.current, slotId, dateKey);
          }}
          onClick={() => {
            // 터치 탭만 여기서 토글한다(마우스는 pointerdown에서 이미 처리).
            // 칠하기 모드를 거친 제스처의 click은 마지막 칸을 되뒤집지 않도록 무시한다.
            if (drag.current.lastPointerType === "touch" && !touch.current.suppressClick) {
              props.onToggle(slotId, !selected);
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
        className={`flex h-7 cursor-pointer items-center justify-center border border-white text-[10px] ${ratio > 0.5 ? "text-white" : "text-gray-900"} ${
          active ? "outline outline-2 -outline-offset-2 outline-amber-500" : ""
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
    <>
      {props.mode === "edit" && (
        <p className="hidden text-xs text-gray-500 pointer-coarse:block">
          길게 눌러 드래그하면 여러 칸을 칠할 수 있어요
        </p>
      )}
      <div
        ref={containerRef}
        // isolate: 내부 sticky 헤더/라벨의 z-index가 격자 밖으로 새어 하단 고정 제출 바 위로 올라오지 않게 한다.
        className="isolate overflow-auto select-none max-w-full max-h-[55vh] touch-manipulation"
        onPointerMove={onContainerPointerMove}
        onPointerUp={() => {
          endDrag();
          endTouch();
        }}
        onPointerCancel={() => {
          endDrag();
          endTouch();
        }}
        onPointerLeave={onContainerLeave}
        onContextMenu={(e) => {
          // 길게 누르는 동안 Android 컨텍스트 메뉴가 끼어들지 않게 한다.
          const t = touch.current;
          if (t.timer || t.painting) e.preventDefault();
        }}
      >
        {/* 날짜가 적을 때 좁은 격자가 남는 공간에 조금 차오르도록, 열당 5rem(최소)~7.5rem(최대)
            사이에서 늘어난다. 최소를 넘는 날짜 수는 지금처럼 가로 스크롤. */}
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-xs"
          style={{
            minWidth: `calc(3.5rem + ${layout.dateKeys.length * 5}rem)`,
            maxWidth: `calc(3.5rem + ${layout.dateKeys.length * 7.5}rem)`,
          }}
        >
          <colgroup>
            <col className="w-14" />
            {layout.dateKeys.map((dk) => (
              <col key={dk} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="w-14 sticky top-0 left-0 z-20 bg-white">
                {props.mode === "edit" &&
                  (() => {
                    const ids = allSlotIds();
                    const allSelected = ids.length > 0 && ids.every((id) => props.value.has(id));
                    return (
                      <button
                        type="button"
                        disabled={props.disabled}
                        aria-pressed={allSelected}
                        aria-label={allSelected ? "전체 해제" : "전체 선택"}
                        onClick={() => toggleAll(ids)}
                        className="w-full text-[10px] font-medium text-gray-400 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {allSelected ? "전체 해제" : "전체 선택"}
                      </button>
                    );
                  })()}
              </th>
              {layout.dateKeys.map((dk) => {
                const label = formatDateLabel(dk);
                if (props.mode !== "edit") {
                  return (
                    <th
                      key={dk}
                      className="px-2 py-1 text-sm font-medium whitespace-nowrap text-gray-700 sticky top-0 z-10 bg-white"
                    >
                      {label}
                    </th>
                  );
                }
                const ids = columnSlotIds(dk);
                const allSelected = ids.length > 0 && ids.every((id) => props.value.has(id));
                return (
                  <th
                    key={dk}
                    className="px-0 py-0 sticky top-0 z-10 bg-white"
                  >
                    <button
                      type="button"
                      disabled={props.disabled}
                      aria-pressed={allSelected}
                      aria-label={`${label} 전체 ${allSelected ? "해제" : "선택"}`}
                      onClick={() => toggleAll(ids)}
                      className="w-full px-2 py-1 text-sm font-medium whitespace-nowrap text-gray-700 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {label}
                    </button>
                  </th>
                );
              })}
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
                        <div className="h-7 bg-gray-50" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
