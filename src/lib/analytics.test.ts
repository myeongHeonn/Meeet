import { redactPollToken } from "./analytics";

describe("redactPollToken", () => {
  it("replaces the poll token in the path", () => {
    expect(redactPollToken("https://meeet.kr/p/AbC-123_xyz")).toBe("https://meeet.kr/p/[token]");
  });

  it("keeps anything after the token segment", () => {
    expect(redactPollToken("https://meeet.kr/p/AbC-123_xyz/edit?tab=group")).toBe(
      "https://meeet.kr/p/[token]/edit?tab=group",
    );
  });

  it("leaves other paths untouched", () => {
    expect(redactPollToken("https://meeet.kr/")).toBe("https://meeet.kr/");
    expect(redactPollToken("https://meeet.kr/pricing/p/abc")).toBe("https://meeet.kr/pricing/p/abc");
  });
});
