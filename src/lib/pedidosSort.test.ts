import { describe, it, expect } from "vitest";
import { ordenarPorEntrega } from "./pedidosSort";

describe("ordenarPorEntrega", () => {
  it("ordena por data de entrega crescente (mais próxima primeiro)", () => {
    const r = ordenarPorEntrega([
      { data: "2026-07-10", horario: "08h" },
      { data: "2026-07-03", horario: "15h" },
      { data: "2026-07-03", horario: "08h" },
    ]);
    expect(r.map((x) => `${x.data} ${x.horario}`)).toEqual([
      "2026-07-03 08h", "2026-07-03 15h", "2026-07-10 08h",
    ]);
  });
  it("joga itens sem data para o fim", () => {
    const r = ordenarPorEntrega([{ data: null }, { data: "2026-07-03" }]);
    expect(r[0].data).toBe("2026-07-03");
    expect(r[1].data).toBeNull();
  });
});
