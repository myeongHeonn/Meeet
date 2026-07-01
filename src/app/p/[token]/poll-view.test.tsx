import { render, screen, fireEvent } from "@testing-library/react";
import { PollView } from "./poll-view";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

const slots = [
  { id: "s1", startsAt: "2026-07-30T00:00:00.000Z" },
  { id: "s2", startsAt: "2026-07-30T00:30:00.000Z" },
];

const baseProps = {
  token: "tok",
  slots,
  participants: [
    { id: "p1", name: "영희" },
    { id: "p2", name: "철수" },
  ],
  availabilities: [{ participantId: "p1", pollSlotId: "s1" }],
  poll: { title: "회식", description: "설명" },
};

describe("PollView", () => {
  it("always shows the response form and grid", () => {
    render(<PollView {...baseProps} />);
    expect(screen.getByText("회식")).toBeInTheDocument();
    expect(screen.getByLabelText("이름")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "응답 제출" })).toBeInTheDocument();
  });

  it("disables the submit button until a name is entered", () => {
    render(<PollView {...baseProps} poll={{ title: "회식", description: null }} />);
    expect(screen.getByRole("button", { name: "응답 제출" })).toBeDisabled();
  });

  it("has no confirm affordance", () => {
    render(<PollView {...baseProps} />);
    expect(screen.queryByText(/확정/)).not.toBeInTheDocument();
  });
});

describe("PollView (slot detail)", () => {
  it("shows available and unavailable names when a heatmap cell is clicked", () => {
    const { container } = render(<PollView {...baseProps} />);
    // s1은 편집 격자와 히트맵 양쪽에 있다. 히트맵 칸(마지막)이 상세를 연다.
    const cells = container.querySelectorAll("[data-slot-id='s1']");
    fireEvent.click(cells[cells.length - 1]);
    // s1: 영희 가능, 철수 불가능
    expect(screen.getByText("가능 1명")).toBeInTheDocument();
    expect(screen.getByText("불가능 1명")).toBeInTheDocument();
    expect(screen.getByText("영희")).toBeInTheDocument();
    expect(screen.getByText("철수")).toBeInTheDocument();
  });
});

describe("PollView (prefill from edit token)", () => {
  afterEach(() => window.localStorage.clear());

  it("prefills name and selection when a saved token matches a participant", () => {
    window.localStorage.setItem(
      "meeet:poll:tok",
      JSON.stringify({ editToken: "any", participantId: "p1" }),
    );
    render(<PollView {...baseProps} poll={{ title: "회식", description: null }} />);
    expect(screen.getByLabelText("이름")).toHaveValue("영희");
    expect(screen.getByLabelText("slot-s1")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("slot-s2")).toHaveAttribute("aria-checked", "false");
  });

  it("does not prefill when there is no saved token", () => {
    render(<PollView {...baseProps} poll={{ title: "회식", description: null }} />);
    expect(screen.getByLabelText("이름")).toHaveValue("");
  });
});
