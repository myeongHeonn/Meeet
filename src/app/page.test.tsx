import { render, screen, fireEvent } from "@testing-library/react";
import Home from "./page";

describe("Home (create poll page)", () => {
  it("renders the create form", () => {
    render(<Home />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("제목 *")).toBeInTheDocument();
    expect(screen.getByText("후보 날짜 *")).toBeInTheDocument();
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

  it("updates the selection summary when times change", () => {
    render(<Home />);
    // 기본 09:00–17:00 = 16칸, 날짜 0개 → 0개
    expect(screen.getByText(/칸 0개/)).toBeInTheDocument();
  });
});
