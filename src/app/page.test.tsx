import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("Home page", () => {
  it("renders without crashing", () => {
    render(<Page />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
