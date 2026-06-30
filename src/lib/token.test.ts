import { generatePublicToken } from "./token";

describe("generatePublicToken", () => {
  it("produces a URL-safe base64url string (no +, /, =)", () => {
    const token = generatePublicToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("encodes 32 bytes (256bit) → 43 base64url chars", () => {
    // 32 bytes in base64url is 43 chars with no padding.
    expect(generatePublicToken()).toHaveLength(43);
  });

  it("is unique across calls (no collisions in a large sample)", () => {
    const n = 1000;
    const tokens = new Set(Array.from({ length: n }, generatePublicToken));
    expect(tokens.size).toBe(n);
  });
});
