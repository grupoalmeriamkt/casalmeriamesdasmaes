import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateDisponibilidade, type CarrinhoItem } from "@/lib/availability";
import { horariosAceitos, regraDoCarrinho } from "./janelasCarrinho";

const LABELS = [
  "Entre 08h e 09h",
  "Entre 09h e 10h",
  "Entre 10h e 12h",
  "Entre 12h e 14h",
  "Entre 14h e 16h",
  "Entre 16h e 18h",
];

// Terça 15/09/2026 11:24 em São Paulo.
const AGORA = new Date("2026-09-15T11:24:00-03:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
});

type ItemSite = { produtoId: string; nome: string };

const CARRINHOS: Record<string, { itens: ItemSite[]; modo: "delivery" | "retirada" }> = {
  bolo: { itens: [{ produtoId: "p1", nome: "Bolo Dragê" }], modo: "retirada" },
  nakedCake: {
    itens: [{ produtoId: "p2", nome: "Naked Cake de Baunilha com Morango" }],
    modo: "retirada",
  },
  cestaComQuiche: {
    itens: [
      { produtoId: "p3", nome: "Cesta de Café da Manhã" },
      { produtoId: "p5", nome: "Quiches Bacon" },
    ],
    modo: "delivery",
  },
  cestaComVinhoLePetit: {
    itens: [
      { produtoId: "p3", nome: "Cesta de Café da Manhã" },
      { produtoId: "p4", nome: "Vinho Francês Tinto Le Petit Ronan By Clinet" },
    ],
    modo: "delivery",
  },
};

/** Como a cobrança (/api/public/asaas/charge) valida o pedido gravado. */
function servidorAceita(itens: ItemSite[], modo: "delivery" | "retirada", data: string, horario: string) {
  const carrinho: CarrinhoItem[] = itens.map((it, i) => ({
    produto_id: i === 0 ? "cesta" : it.nome,
    produto_tipo: "cesta",
    nome: it.nome,
  }));
  return validateDisponibilidade(
    { itens: carrinho, fulfillmentMode: modo, candidateDate: data, candidateHorario: horario },
    undefined,
    LABELS,
  ).valid;
}

function proximosDias(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(AGORA.getTime() + i * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    }),
  );
}

describe("horariosAceitos (checkout) × cobrança", () => {
  it("o checkout oferece exatamente os horários que a cobrança aceita", () => {
    for (const [nome, { itens, modo }] of Object.entries(CARRINHOS)) {
      const regra = regraDoCarrinho(itens);
      for (const data of proximosDias(9)) {
        const aceitos = horariosAceitos(regra, data, new Date(), LABELS);
        for (const horario of LABELS) {
          expect({ nome, data, horario, aceito: aceitos.has(horario) }).toEqual({
            nome,
            data,
            horario,
            aceito: servidorAceita(itens, modo, data, horario),
          });
        }
      }
    }
  });

  it("bolo para amanhã cedo não é oferecido; depois de amanhã é", () => {
    const regra = regraDoCarrinho(CARRINHOS.bolo.itens);
    expect(horariosAceitos(regra, "2026-09-16", new Date(), LABELS).has("Entre 08h e 09h")).toBe(false);
    expect(horariosAceitos(regra, "2026-09-17", new Date(), LABELS).has("Entre 08h e 09h")).toBe(true);
  });

  it("bolo na segunda só a partir das 12h", () => {
    const aceitos = horariosAceitos(regraDoCarrinho(CARRINHOS.bolo.itens), "2026-09-21", new Date(), LABELS);
    expect(aceitos.has("Entre 08h e 09h")).toBe(false);
    expect(aceitos.has("Entre 12h e 14h")).toBe(true);
  });

  it("naked cake segue a mesma regra dos bolos", () => {
    const regra = regraDoCarrinho(CARRINHOS.nakedCake.itens);
    expect(horariosAceitos(regra, "2026-09-16", new Date(), LABELS).has("Entre 08h e 09h")).toBe(false);
  });

  it("cesta com quiche ou com o vinho Le Petit pode ser entregue amanhã de manhã", () => {
    for (const c of [CARRINHOS.cestaComQuiche, CARRINHOS.cestaComVinhoLePetit]) {
      const aceitos = horariosAceitos(regraDoCarrinho(c.itens), "2026-09-16", new Date(), LABELS);
      expect(aceitos.has("Entre 08h e 09h")).toBe(true);
      expect(servidorAceita(c.itens, "delivery", "2026-09-16", "Entre 08h e 09h")).toBe(true);
    }
  });
});

describe("validateDisponibilidade: corte de sábado", () => {
  it("usa 'Entrega' na mensagem de pedido de entrega", () => {
    vi.setSystemTime(new Date("2026-09-18T13:00:00-03:00"));
    const r = validateDisponibilidade({
      itens: [{ produto_id: "cesta", produto_tipo: "cesta", nome: "Cesta de Café da Manhã" }],
      fulfillmentMode: "delivery",
      candidateDate: "2026-09-19",
    });
    expect(r.errors).toContain("Entrega no sábado só é possível até sexta às 12h.");
  });
});
