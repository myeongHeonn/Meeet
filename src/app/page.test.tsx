import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";
import { postJson } from "@/lib/api-client";
import { creatorFlagKey } from "@/lib/creator-flag";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/lib/api-client", () => ({
  postJson: jest.fn(),
}));

afterEach(() => {
  push.mockReset();
  (postJson as jest.Mock).mockReset();
  window.sessionStorage.clear();
});

describe("Home (create poll page)", () => {
  it("renders the create form", () => {
    render(<Home />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("제목 *")).toBeInTheDocument();
    expect(screen.getByText("후보 날짜", { exact: false })).toBeInTheDocument();
  });

  it("disables 폴 만들기 until title and a date are provided", () => {
    render(<Home />);
    const button = screen.getByRole("button", { name: "폴 만들기" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("제목 *"), {
      target: { value: "팀 회식" },
    });
    // 제목만으로는 아직 비활성(날짜 필요)
    expect(button).toBeDisabled();
  });

  it("redirects to the poll page and sets the creator flag on success", async () => {
    (postJson as jest.Mock).mockResolvedValue({
      ok: true,
      data: { token: "tok123" },
    });
    const { container } = render(<Home />);

    fireEvent.change(screen.getByLabelText("제목 *"), {
      target: { value: "팀 회식" },
    });
    // 캘린더에서 선택 가능한(과거 아님) 날짜 하나 클릭
    const day = container.querySelector(
      "button[aria-pressed='false']:not([disabled])",
    )!;
    fireEvent.click(day);
    fireEvent.click(screen.getByRole("button", { name: "폴 만들기" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/p/tok123"));
    expect(window.sessionStorage.getItem(creatorFlagKey("tok123"))).toBe("1");
  });

  it("shows an error and stays on the form when creation fails", async () => {
    (postJson as jest.Mock).mockResolvedValue({ ok: false });
    const { container } = render(<Home />);

    fireEvent.change(screen.getByLabelText("제목 *"), {
      target: { value: "팀 회식" },
    });
    const day = container.querySelector(
      "button[aria-pressed='false']:not([disabled])",
    )!;
    fireEvent.click(day);
    fireEvent.click(screen.getByRole("button", { name: "폴 만들기" }));

    expect(
      await screen.findByText("폴 생성에 실패했습니다. 입력을 확인해주세요."),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "폴 만들기" }),
    ).not.toBeDisabled();
  });
});
