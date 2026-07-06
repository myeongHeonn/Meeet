import { render, screen, fireEvent } from "@testing-library/react";
import { TimeGrid } from "./time-grid";

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
});

describe("TimeGrid (empty)", () => {
  it("renders a fallback message with no slots", () => {
    render(<TimeGrid mode="edit" slots={[]} timeZone="UTC" value={new Set()} onToggle={jest.fn()} />);
    expect(screen.getByText("표시할 시간이 없습니다.")).toBeInTheDocument();
  });
});
