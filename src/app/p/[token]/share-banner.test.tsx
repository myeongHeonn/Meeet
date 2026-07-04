import { render, screen, fireEvent } from "@testing-library/react";
import { ShareBanner } from "./share-banner";
import { creatorFlagKey } from "@/lib/creator-flag";

afterEach(() => window.sessionStorage.clear());

describe("ShareBanner", () => {
  it("shows the share link when the creator flag is set", () => {
    window.sessionStorage.setItem(creatorFlagKey("tok"), "1");
    render(<ShareBanner token="tok" />);
    expect(screen.getByLabelText("공유 링크")).toHaveValue(
      `${window.location.origin}/p/tok`,
    );
    expect(screen.getByRole("button", { name: "복사" })).toBeInTheDocument();
  });

  it("renders nothing without the creator flag (participant via link)", () => {
    const { container } = render(<ShareBanner token="tok" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismisses and clears the flag so it does not reappear", () => {
    window.sessionStorage.setItem(creatorFlagKey("tok"), "1");
    const { container } = render(<ShareBanner token="tok" />);
    fireEvent.click(screen.getByLabelText("공유 안내 닫기"));
    expect(container).toBeEmptyDOMElement();
    expect(window.sessionStorage.getItem(creatorFlagKey("tok"))).toBeNull();
  });
});
