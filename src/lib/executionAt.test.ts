import { describe, expect, it } from "vitest";
import { computeExecutionAt, parseHorarioInicio } from "@/lib/executionAt";

describe("parseHorarioInicio", () => {
  it("extrai hora de Entre 08h e 09h", () => {
    expect(parseHorarioInicio("Entre 08h e 09h")).toBe(8);
  });

  it("fallback meio-dia", () => {
    expect(parseHorarioInicio(null)).toBe(12);
  });
});

describe("computeExecutionAt", () => {
  it("combina data ISO e horário", () => {
    const iso = computeExecutionAt("2026-07-01", "Entre 08h e 09h");
    expect(iso).toBeTruthy();
    expect(iso!.includes("2026-07-01")).toBe(true);
  });
});
