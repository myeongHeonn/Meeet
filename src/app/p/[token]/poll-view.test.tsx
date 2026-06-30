import { render, screen } from "@testing-library/react";
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
  participants: [{ id: "p1", name: "영희" }],
  availabilities: [{ participantId: "p1", pollSlotId: "s1" }],
};

describe("PollView (open)", () => {
  it("shows the response form and grid for an open poll", () => {
    render(
      <PollView
        {...baseProps}
        poll={{ title: "회식", description: "설명", status: "open", confirmedSlotId: null }}
      />,
    );
    expect(screen.getByText("회식")).toBeInTheDocument();
    expect(screen.getByText("모집 중")).toBeInTheDocument();
    expect(screen.getByLabelText("이름")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "응답 제출" })).toBeInTheDocument();
  });

  it("disables the submit button until a name is entered", () => {
    render(
      <PollView
        {...baseProps}
        poll={{ title: "회식", description: null, status: "open", confirmedSlotId: null }}
      />,
    );
    expect(screen.getByRole("button", { name: "응답 제출" })).toBeDisabled();
  });
});

describe("PollView (confirmed)", () => {
  it("hides the response form and shows the confirmed slot", () => {
    render(
      <PollView
        {...baseProps}
        poll={{ title: "회식", description: null, status: "confirmed", confirmedSlotId: "s1" }}
      />,
    );
    expect(screen.getByText("확정됨")).toBeInTheDocument();
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "응답 제출" })).not.toBeInTheDocument();
    expect(screen.getByText(/✓ 확정:/)).toBeInTheDocument();
  });
});
