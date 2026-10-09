import { render, screen, fireEvent, act } from "@testing-library/react";
import { TimeGrid, autoScrollDelta, strokeChanges } from "./time-grid";

// jsdom에는 PointerEvent가 없어 fireEvent가 일반 Event로 대체하고 pointerType/좌표를 버린다.
// 이 파일 한정으로 최소 폴리필을 둔다(jest는 테스트 파일마다 환경을 새로 만든다).
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "";
  }
}
if (!("PointerEvent" in window)) {
  Object.defineProperty(window, "PointerEvent", { value: TestPointerEvent, configurable: true });
}

const slots = [
  { id: "s1", startsAt: "2026-07-30T09:00:00.000Z" },
  { id: "s2", startsAt: "2026-07-30T09:30:00.000Z" },
];

describe("TimeGrid (edit mode)", () => {
  it("calls onToggle with true when an unselected cell is pressed", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("slot-s1"));
    expect(onToggle).toHaveBeenCalledWith("s1", true);
  });

  it("calls onToggle with false when a selected cell is pressed", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set(["s1"])}
        onToggle={onToggle}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("slot-s1"));
    expect(onToggle).toHaveBeenCalledWith("s1", false);
  });

  it("reflects selection via aria-checked", () => {
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set(["s1"])}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByLabelText("slot-s1")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("slot-s2")).toHaveAttribute("aria-checked", "false");
  });

  it("selects every slot when the select-all corner button is pressed", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText("전체 선택"));
    expect(onToggle).toHaveBeenCalledWith("s1", true);
    expect(onToggle).toHaveBeenCalledWith("s2", true);
  });

  it("clears every slot when the select-all corner button is pressed while all are selected", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set(["s1", "s2"])}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText("전체 해제"));
    expect(onToggle).toHaveBeenCalledWith("s1", false);
    expect(onToggle).toHaveBeenCalledWith("s2", false);
  });

  it("toggles only that date's column when a date header button is pressed", () => {
    const onToggle = jest.fn();
    const twoDaySlots = [
      { id: "s1", startsAt: "2026-07-30T09:00:00.000Z" },
      { id: "s2", startsAt: "2026-07-31T09:00:00.000Z" },
    ];
    render(
      <TimeGrid
        mode="edit"
        slots={twoDaySlots}
        timeZone="UTC"
        value={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText("7/30 (목) 전체 선택"));
    expect(onToggle).toHaveBeenCalledWith("s1", true);
    expect(onToggle).not.toHaveBeenCalledWith("s2", true);
  });

  it("does not toggle when disabled", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set()}
        onToggle={onToggle}
        disabled
      />,
    );
    fireEvent.click(screen.getByLabelText("전체 선택"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("drags with the mouse within the same column", () => {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("slot-s1"), { pointerType: "mouse" });
    fireEvent.pointerEnter(screen.getByLabelText("slot-s2"), { pointerType: "mouse" });
    expect(onToggle.mock.calls).toEqual([
      ["s1", true],
      ["s2", true],
    ]);
  });

  it("shows the long-press hint in edit mode", () => {
    render(
      <TimeGrid
        mode="edit"
        slots={slots}
        timeZone="UTC"
        value={new Set()}
        onToggle={jest.fn()}
      />,
    );
    expect(screen.getByText("길게 눌러 드래그하면 여러 칸을 칠할 수 있어요")).toBeInTheDocument();
  });
});

describe("TimeGrid (touch paint, FR-16)", () => {
  // s1·s2는 7/30, s3는 7/31. 좌표 y로 칸을 가리킨다: 10→s1, 40→s2, 70→s3, 95→s2(가장자리 구간).
  const touchSlots = [
    { id: "s1", startsAt: "2026-07-30T09:00:00.000Z" },
    { id: "s2", startsAt: "2026-07-30T09:30:00.000Z" },
    { id: "s3", startsAt: "2026-07-31T09:00:00.000Z" },
  ];
  const cellAtY: Record<number, string> = {
    10: "slot-s1",
    40: "slot-s2",
    70: "slot-s3",
    95: "slot-s2",
  };
  const touchAt = (y: number) => ({ pointerType: "touch", clientX: 10, clientY: y });

  beforeEach(() => {
    jest.useFakeTimers();
    document.elementFromPoint = jest.fn((_x: number, y: number) =>
      cellAtY[y] ? screen.getByLabelText(cellAtY[y]) : null,
    );
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 300,
      bottom: 100,
    } as DOMRect);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  });

  function renderGrid(props: { value?: Set<string>; disabled?: boolean } = {}) {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={touchSlots}
        timeZone="UTC"
        value={props.value ?? new Set()}
        onToggle={onToggle}
        disabled={props.disabled}
      />,
    );
    return onToggle;
  }

  const cell = (id: string) => screen.getByLabelText(`slot-${id}`);

  function longPress(id: string, y: number) {
    fireEvent.pointerDown(cell(id), touchAt(y));
    act(() => {
      jest.advanceTimersByTime(300);
    });
  }

  it("toggles the pressed cell and enters paint mode after a long press", () => {
    const onToggle = renderGrid();
    fireEvent.pointerDown(cell("s1"), touchAt(10));
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(onToggle).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onToggle).toHaveBeenCalledWith("s1", true);
  });

  it("paints cells in the same column toward the first cell's new state", () => {
    const onToggle = renderGrid({ value: new Set(["s1", "s2"]) });
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    expect(onToggle.mock.calls).toEqual([
      ["s1", false],
      ["s2", false],
    ]);
  });

  it("does not paint cells in another date column", () => {
    const onToggle = renderGrid();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(70));
    expect(onToggle).not.toHaveBeenCalledWith("s3", expect.anything());
  });

  it("leaves the gesture to scrolling when the finger moves before the long press", () => {
    const onToggle = renderGrid();
    fireEvent.pointerDown(cell("s1"), touchAt(10));
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("toggles a single cell on a short tap", () => {
    const onToggle = renderGrid();
    fireEvent.pointerDown(cell("s1"), touchAt(10));
    fireEvent.pointerUp(cell("s1"), touchAt(10));
    fireEvent.click(cell("s1"));
    expect(onToggle.mock.calls).toEqual([["s1", true]]);
  });

  it("ignores the click that follows a long press", () => {
    const onToggle = renderGrid();
    longPress("s1", 10);
    fireEvent.pointerUp(cell("s1"), touchAt(10));
    fireEvent.click(cell("s1"));
    expect(onToggle.mock.calls).toEqual([["s1", true]]);
  });

  it("still toggles on the next tap after a drag that ended without a click", () => {
    const onToggle = renderGrid();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    fireEvent.pointerUp(cell("s1"), touchAt(40));
    onToggle.mockClear();

    fireEvent.pointerDown(cell("s3"), touchAt(70));
    fireEvent.pointerUp(cell("s3"), touchAt(70));
    fireEvent.click(cell("s3"));
    expect(onToggle.mock.calls).toEqual([["s3", true]]);
  });

  it("restores cells when the finger moves back toward the start", () => {
    const onToggle = renderGrid();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    fireEvent.pointerMove(cell("s1"), touchAt(10));
    expect(onToggle.mock.calls).toEqual([
      ["s1", true],
      ["s2", true],
      ["s2", false],
    ]);
  });

  it("keeps paint mode when the finger leaves the grid and paints again on return", () => {
    const onToggle = renderGrid();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(150));
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    expect(onToggle.mock.calls).toEqual([
      ["s1", true],
      ["s2", true],
    ]);
  });

  // jsdom의 scrollTop은 항상 0이라 값이 저장되는 가짜 속성으로 바꾼다.
  function fakeScrollTop() {
    const box = cell("s1").closest<HTMLElement>(".overflow-auto")!;
    let top = 0;
    Object.defineProperty(box, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    return () => top;
  }

  it("auto-scrolls the grid near the bottom edge and paints the cell that comes under the finger", () => {
    const onToggle = renderGrid();
    const scrollTop = fakeScrollTop();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(95));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(scrollTop()).toBeGreaterThan(0);
    expect(onToggle.mock.calls).toEqual([
      ["s1", true],
      ["s2", true],
    ]);
  });

  it("stops auto-scrolling once the finger is lifted", () => {
    renderGrid();
    const scrollTop = fakeScrollTop();
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(95));
    fireEvent.pointerUp(cell("s1"), touchAt(95));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(scrollTop()).toBe(0);
  });

  it("blocks the context menu while painting", () => {
    renderGrid();
    longPress("s1", 10);
    const notPrevented = fireEvent.contextMenu(cell("s1"));
    expect(notPrevented).toBe(false);
  });

  it("blocks native scrolling only while painting", () => {
    renderGrid();
    const scrollBox = cell("s1").closest(".overflow-auto")!;
    const move = () =>
      scrollBox.dispatchEvent(new Event("touchmove", { bubbles: true, cancelable: true }));
    expect(move()).toBe(true);
    longPress("s1", 10);
    expect(move()).toBe(false);
    fireEvent.pointerUp(cell("s1"), touchAt(10));
    expect(move()).toBe(true);
  });

  it("does nothing on a long press when disabled", () => {
    const onToggle = renderGrid({ disabled: true });
    longPress("s1", 10);
    fireEvent.pointerMove(cell("s1"), touchAt(40));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("TimeGrid (heatmap mode)", () => {
  it("shows availability counts and names in the title", () => {
    render(
      <TimeGrid
        mode="heatmap"
        slots={slots}
        timeZone="UTC"
        totalParticipants={2}
        tallyBySlot={
          new Map([["s1", { count: 2, names: ["민수", "영희"] }]])
        }
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTitle("2/2명: 민수, 영희")).toBeInTheDocument();
  });

  it("invokes onSlotSelect when a cell is clicked", () => {
    const onSlotSelect = jest.fn();
    const { container } = render(
      <TimeGrid
        mode="heatmap"
        slots={slots}
        timeZone="UTC"
        totalParticipants={0}
        tallyBySlot={new Map()}
        onSlotSelect={onSlotSelect}
      />,
    );
    fireEvent.click(container.querySelector("[data-slot-id='s1']")!);
    expect(onSlotSelect).toHaveBeenCalledWith("s1");
  });

  it("invokes onSlotHover with the slot id on pointer enter", () => {
    const onSlotHover = jest.fn();
    const { container } = render(
      <TimeGrid
        mode="heatmap"
        slots={slots}
        timeZone="UTC"
        totalParticipants={0}
        tallyBySlot={new Map()}
        onSlotHover={onSlotHover}
      />,
    );
    fireEvent.pointerEnter(container.querySelector("[data-slot-id='s1']")!);
    expect(onSlotHover).toHaveBeenCalledWith("s1");
  });

  it("does not render select-all controls in heatmap mode", () => {
    render(
      <TimeGrid
        mode="heatmap"
        slots={slots}
        timeZone="UTC"
        totalParticipants={0}
        tallyBySlot={new Map()}
      />,
    );
    expect(screen.queryByLabelText("전체 선택")).not.toBeInTheDocument();
    expect(screen.getByText("7/30 (목)")).toBeInTheDocument();
  });

  it("does not render the long-press hint in heatmap mode", () => {
    render(
      <TimeGrid
        mode="heatmap"
        slots={slots}
        timeZone="UTC"
        totalParticipants={0}
        tallyBySlot={new Map()}
      />,
    );
    expect(
      screen.queryByText("길게 눌러 드래그하면 여러 칸을 칠할 수 있어요"),
    ).not.toBeInTheDocument();
  });
});

describe("TimeGrid (empty)", () => {
  it("renders a fallback message with no slots", () => {
    render(<TimeGrid mode="edit" slots={[]} timeZone="UTC" value={new Set()} onToggle={jest.fn()} />);
    expect(screen.getByText("표시할 시간이 없습니다.")).toBeInTheDocument();
  });
});

describe("autoScrollDelta", () => {
  it("is zero in the middle of the visible grid", () => {
    expect(autoScrollDelta(150, 0, 300)).toBe(0);
  });

  it("scrolls up/down proportionally to the depth into the edge zone", () => {
    expect(autoScrollDelta(24, 0, 300)).toBeCloseTo(-7);
    expect(autoScrollDelta(276, 0, 300)).toBeCloseTo(7);
  });

  it("scrolls at full speed outside the grid", () => {
    expect(autoScrollDelta(-50, 0, 300)).toBe(-14);
    expect(autoScrollDelta(400, 0, 300)).toBe(14);
  });
});

describe("TimeGrid (range painting, FR-6)", () => {
  // 한 날짜 컬럼에 연속된 4칸 s1~s4.
  const columnSlots = ["s1", "s2", "s3", "s4"].map((id, i) => ({
    id,
    startsAt: new Date(Date.UTC(2026, 6, 30, 9, i * 30)).toISOString(),
  }));

  function renderGrid(value: Set<string> = new Set()) {
    const onToggle = jest.fn();
    render(
      <TimeGrid
        mode="edit"
        slots={columnSlots}
        timeZone="UTC"
        value={value}
        onToggle={onToggle}
      />,
    );
    return onToggle;
  }

  const cell = (id: string) => screen.getByLabelText(`slot-${id}`);

  it("fills the cells skipped by a fast mouse drag", () => {
    const onToggle = renderGrid();
    fireEvent.pointerDown(cell("s1"), { pointerType: "mouse" });
    fireEvent.pointerEnter(cell("s4"), { pointerType: "mouse" });
    expect(onToggle.mock.calls).toEqual([
      ["s1", true],
      ["s2", true],
      ["s3", true],
      ["s4", true],
    ]);
  });

  it("restores cells to their pre-drag state when the mouse drag shrinks back", () => {
    // s3는 원래 선택돼 있었다 — 구간에서 빠지면 지워지는 게 아니라 원래대로(선택) 돌아와야 한다.
    const onToggle = renderGrid(new Set(["s3"]));
    fireEvent.pointerDown(cell("s1"), { pointerType: "mouse" });
    fireEvent.pointerEnter(cell("s4"), { pointerType: "mouse" });
    onToggle.mockClear();
    fireEvent.pointerEnter(cell("s2"), { pointerType: "mouse" });
    expect(onToggle.mock.calls).toEqual([["s4", false]]);
  });

  it("paints upward from the start cell", () => {
    const onToggle = renderGrid();
    fireEvent.pointerDown(cell("s3"), { pointerType: "mouse" });
    fireEvent.pointerEnter(cell("s1"), { pointerType: "mouse" });
    expect(onToggle.mock.calls).toEqual([
      ["s3", true],
      ["s1", true],
      ["s2", true],
    ]);
  });
});

describe("strokeChanges", () => {
  const ids = ["a", "b", "c", "d"];
  const none = new Map(ids.map((id) => [id, false]));

  it("sets every cell between the anchor and the target cell", () => {
    expect(strokeChanges(ids, 0, 2, true, none, none)).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
    ]);
  });

  it("reverts cells that fall out of the range to their original state", () => {
    const applied = new Map([
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
    expect(strokeChanges(ids, 0, 0, true, none, applied)).toEqual([
      ["b", false],
      ["c", false],
    ]);
  });

  it("flips the range across the anchor", () => {
    const applied = new Map([
      ["a", false],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
    // anchor b, 아래(c)로 칠하다가 위(a)로 넘어감 → c는 원래대로, a는 칠함
    expect(strokeChanges(ids, 1, 0, true, none, applied)).toEqual([
      ["a", true],
      ["c", false],
    ]);
  });
});
