import { describe, expect, it } from "vitest";
import { prazoStatus } from "@/lib/pedidoPrazo";

describe("prazoStatus", () => {
  const hojeIso = "2026-07-03";

  it("retorna concluido quando concluidoAt está definido, mesmo com data futura ou passada", () => {
    expect(prazoStatus({ data: "2026-07-01", concluidoAt: "2026-07-02T10:00:00Z" }, hojeIso)).toBe(
      "concluido",
    );
    expect(prazoStatus({ data: "2026-07-10", concluidoAt: "2026-07-02T10:00:00Z" }, hojeIso)).toBe(
      "concluido",
    );
  });

  it("retorna null quando não há data de entrega e não está concluído", () => {
    expect(prazoStatus({ data: null, concluidoAt: null }, hojeIso)).toBeNull();
    expect(prazoStatus({ concluidoAt: null }, hojeIso)).toBeNull();
  });

  it("retorna atrasado quando a data de entrega é anterior a hoje", () => {
    expect(prazoStatus({ data: "2026-07-02", concluidoAt: null }, hojeIso)).toBe("atrasado");
  });

  it("retorna hoje quando a data de entrega é igual a hoje", () => {
    expect(prazoStatus({ data: "2026-07-03", concluidoAt: null }, hojeIso)).toBe("hoje");
  });

  it("retorna no_prazo quando a data de entrega é futura", () => {
    expect(prazoStatus({ data: "2026-07-04", concluidoAt: null }, hojeIso)).toBe("no_prazo");
  });
});
