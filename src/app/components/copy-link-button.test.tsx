import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyLinkButton } from "./copy-link-button";

const writeText = jest.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("CopyLinkButton", () => {
  it("copies the url and shows 복사됨 feedback", async () => {
    render(<CopyLinkButton url="https://example.com/p/tok" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "복사" }));
    });
    expect(writeText).toHaveBeenCalledWith("https://example.com/p/tok");
    expect(screen.getByRole("button", { name: "복사됨 ✓" })).toBeInTheDocument();
  });

  it("reverts to 복사 after 2 seconds", async () => {
    jest.useFakeTimers();
    try {
      render(<CopyLinkButton url="https://example.com/p/tok" />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "복사" }));
      });
      expect(screen.getByRole("button", { name: "복사됨 ✓" })).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByRole("button", { name: "복사" })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps 복사 label when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyLinkButton url="https://example.com/p/tok" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "복사" }));
    });
    expect(screen.getByRole("button", { name: "복사" })).toBeInTheDocument();
  });
});
