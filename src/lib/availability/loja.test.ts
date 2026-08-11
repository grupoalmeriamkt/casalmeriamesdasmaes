import { describe, expect, it } from "vitest";
import { diaDaSemanaSP, novosPedidosBloqueados } from "./loja";

describe("loja — domingo sem novos pedidos", () => {
  it("bloqueia durante o domingo em SP", () => {
    // Domingo 09/08/2026, 12:00 SP
    expect(novosPedidosBloqueados(new Date("2026-08-09T15:00:00Z"))).toBe(true);
  });

  it("libera sábado e segunda", () => {
    expect(novosPedidosBloqueados(new Date("2026-08-08T15:00:00Z"))).toBe(false);
    expect(novosPedidosBloqueados(new Date("2026-08-10T15:00:00Z"))).toBe(false);
  });

  it("usa o fuso de SP na virada do dia (UTC já é domingo, SP ainda é sábado)", () => {
    // 09/08/2026 01:00 UTC = 08/08 22:00 em SP (sábado)
    expect(novosPedidosBloqueados(new Date("2026-08-09T01:00:00Z"))).toBe(false);
    expect(diaDaSemanaSP(new Date("2026-08-09T01:00:00Z"))).toBe(6);
    // 10/08/2026 02:00 UTC = 09/08 23:00 em SP (domingo)
    expect(novosPedidosBloqueados(new Date("2026-08-10T02:00:00Z"))).toBe(true);
  });
});
