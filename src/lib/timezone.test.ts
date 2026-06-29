import { describe, expect, it } from "vitest";
import { isBeforeTodaySP } from "@/lib/timezone";

describe("isBeforeTodaySP", () => {
  it("identifica execução no passado", () => {
    expect(isBeforeTodaySP("2020-01-01T12:00:00-03:00")).toBe(true);
  });

  it("futuro não é passado", () => {
    expect(isBeforeTodaySP("2099-12-31T12:00:00-03:00")).toBe(false);
  });
});
