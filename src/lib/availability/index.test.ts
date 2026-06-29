import { describe, expect, it } from "vitest";
import { validateDisponibilidade } from "@/lib/availability";
import { defaultRegras } from "@/lib/availability/rules";

describe("defaultRegras", () => {
  it("sobremesa CPD exige 24h e sem same-day", () => {
    const r = defaultRegras({ produto_id: "x", produto_tipo: "sobremesa", nome: "Bolo de cenoura" });
    expect(r.minimum_lead_time_hours).toBe(24);
    expect(r.same_day_allowed).toBe(false);
  });

  it("cesta cozinha permite same-day com 4h", () => {
    const r = defaultRegras({ produto_id: "x", produto_tipo: "cesta", nome: "Cesta Aconchego" });
    expect(r.minimum_lead_time_hours).toBe(4);
    expect(r.same_day_allowed).toBe(true);
  });
});

describe("validateDisponibilidade", () => {
  it("bloqueia delivery para produto só retirada", () => {
    const r = defaultRegras({ produto_id: "b", produto_tipo: "sobremesa", nome: "Bolo" });
    const db = new Map([["sobremesa:b", r]]);
    const res = validateDisponibilidade(
      {
        itens: [{ produto_id: "b", produto_tipo: "sobremesa", nome: "Bolo" }],
        fulfillmentMode: "delivery",
        candidateDate: "2026-07-05",
        candidateHorario: "Entre 14h e 16h",
      },
      db,
    );
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Modo de entrega/);
  });
});
