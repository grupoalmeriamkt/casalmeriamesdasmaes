import { describe, expect, it } from "vitest";
import { validateDisponibilidade } from "@/lib/availability";
import type { CarrinhoItem } from "@/lib/availability";
import { nowSP, todayISOSP } from "@/lib/timezone";

// Data ~30 dias à frente (sempre futura) para evitar bloqueios de lead/same-day.
const futuro = nowSP();
futuro.setDate(futuro.getDate() + 30);
const dataFutura = todayISOSP(futuro);

const itens: CarrinhoItem[] = [
  { produto_id: "cesta", produto_tipo: "cesta", nome: "Cesta de Café da Manhã" },
];

describe("validateDisponibilidade — janelas da campanha", () => {
  it("rejeita horário custom quando NÃO recebe os horários da campanha (cai em DEFAULT_WINDOWS)", () => {
    const r = validateDisponibilidade({
      itens,
      fulfillmentMode: "retirada",
      candidateDate: dataFutura,
      candidateHorario: "Entre 12h e 17h",
    });
    expect(r.valid).toBe(false);
  });

  it("aceita horário custom quando recebe os horários configurados da campanha", () => {
    const r = validateDisponibilidade(
      {
        itens,
        fulfillmentMode: "retirada",
        candidateDate: dataFutura,
        candidateHorario: "Entre 12h e 17h",
      },
      undefined,
      ["Entre 08h e 12h", "Entre 12h e 17h"],
    );
    expect(r.valid).toBe(true);
  });
});
