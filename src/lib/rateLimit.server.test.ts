import { describe, expect, it } from "vitest";
import { rateLimit } from "./rateLimit.server";

describe("rateLimit", () => {
  it("permite requisições dentro do limite", () => {
    const req = new Request("https://example.com/api", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const res = rateLimit(req, "test-route", { max: 3, windowMs: 60_000 });
    expect(res).toBeNull();
  });

  it("bloqueia após exceder o limite", () => {
    const req = new Request("https://example.com/api", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    for (let i = 0; i < 2; i++) {
      expect(rateLimit(req, "test-block", { max: 2, windowMs: 60_000 })).toBeNull();
    }
    const blocked = rateLimit(req, "test-block", { max: 2, windowMs: 60_000 });
    expect(blocked?.status).toBe(429);
  });
});
