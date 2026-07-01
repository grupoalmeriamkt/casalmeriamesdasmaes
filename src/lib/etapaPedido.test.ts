import { describe, expect, it } from "vitest";
import { proximaEtapa, indiceEtapa, STAGE_ORDER } from "@/lib/etapaPedido";

describe("proximaEtapa", () => {
  it("null/undefined → confirmado (primeiro avanço)", () => {
    expect(proximaEtapa(null)).toBe("confirmado");
    expect(proximaEtapa(undefined)).toBe("confirmado");
  });
  it("avança na ordem", () => {
    expect(proximaEtapa("confirmado")).toBe("em_preparo");
    expect(proximaEtapa("em_preparo")).toBe("pronto");
    expect(proximaEtapa("pronto")).toBe("finalizado");
  });
  it("finalizado é o fim", () => {
    expect(proximaEtapa("finalizado")).toBeNull();
  });
});

describe("indiceEtapa", () => {
  it("mapeia índice 0-based; null → -1", () => {
    expect(indiceEtapa(null)).toBe(-1);
    expect(indiceEtapa("confirmado")).toBe(0);
    expect(indiceEtapa("finalizado")).toBe(STAGE_ORDER.length - 1);
  });
});
