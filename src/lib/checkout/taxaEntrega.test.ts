import { describe, expect, it } from "vitest";
import { taxaEntregaDoPedido } from "./taxaEntrega";
import type { CampanhaDelivery, ZonaEntrega } from "@/store/admin";

const delivery = (
  taxa: CampanhaDelivery["taxa"],
  zonas?: CampanhaDelivery["zonas"],
): CampanhaDelivery =>
  ({
    ativo: true,
    valorMinimo: 0,
    taxa,
    tempoEstimadoMin: 40,
    tempoEstimadoMax: 60,
    raioKm: 10,
    bairros: [],
    horario: {},
    upsellAtivo: false,
    upsellProdutoIds: [],
    datas: [],
    horarios: [],
    zonas,
  }) as CampanhaDelivery;

const zona = (valor: number): ZonaEntrega => ({
  id: "z1",
  nome: "Asa Sul",
  cor: "#000",
  taxa: { tipo: "fixa", valor },
  poligono: { type: "Polygon", coordinates: [] },
});

describe("taxaEntregaDoPedido", () => {
  it("retirada não tem frete", () => {
    expect(taxaEntregaDoPedido("retirada", delivery({ tipo: "fixa", valor: 25 }))).toBe(0);
  });

  it("delivery usa a taxa fixa da campanha", () => {
    expect(taxaEntregaDoPedido("delivery", delivery({ tipo: "fixa", valor: 25 }))).toBe(25);
  });

  it("delivery com zona ativa usa a taxa da zona", () => {
    expect(
      taxaEntregaDoPedido(
        "delivery",
        delivery({ tipo: "fixa", valor: 15 }, { ativo: true, zonas: [zona(35)] }),
        zona(35),
      ),
    ).toBe(35);
  });
});
