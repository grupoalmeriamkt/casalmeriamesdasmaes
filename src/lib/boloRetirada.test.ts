import { describe, expect, it } from "vitest";
import { ehItemBolo, ehNomeBolo } from "./boloRetirada";
import { defaultRegras } from "./availability/rules";
import type { CarrinhoItem } from "./availability/types";

const catalogo = {
  produtos: [
    { id: "p-especial", nome: "Receita Especial da Casa", categoriaId: "cat-tortas" },
    { id: "p-cheese", nome: "Cheesecake Lotus", categoriaId: "cat-sobremesas" },
    { id: "p-vinho", nome: "Vinho Francês Tinto Le Petit Ronan By Clinet", categoriaId: "cat-adicionais" },
  ],
  categorias: [
    { id: "cat-tortas", nome: "Tortas" },
    { id: "cat-sobremesas", nome: "Sobremesas" },
    { id: "cat-adicionais", nome: "Adicionais" },
  ],
};

describe("ehNomeBolo", () => {
  it("reconhece bolo e naked cake com sufixo de tamanho", () => {
    expect(ehNomeBolo("Bolo Dragê · Tam. M")).toBe(true);
    expect(ehNomeBolo("Naked Cake de Baunilha com Morango · Tam. G")).toBe(true);
  });

  it("não confunde cheesecake, vinho Le Petit nem cesta de café", () => {
    expect(ehNomeBolo("Cheesecake Lotus")).toBe(false);
    expect(ehNomeBolo("Vinho Francês Tinto Le Petit Ronan By Clinet")).toBe(false);
    expect(ehNomeBolo("Cesta de Café da Manhã · Tam. M")).toBe(false);
  });
});

describe("ehItemBolo", () => {
  it("usa a categoria Tortas/Bolos do catálogo pelo produtoId", () => {
    expect(ehItemBolo({ produtoId: "p-especial", nome: "Receita Especial da Casa" }, catalogo)).toBe(true);
  });

  it("acha o produto pelo nome sem tamanho quando não há produtoId", () => {
    expect(ehItemBolo({ nome: "Receita Especial da Casa · Tam. P" }, catalogo)).toBe(true);
  });

  it("aceita a categoria já renomeada para Bolos", () => {
    const renomeado = {
      ...catalogo,
      categorias: [{ id: "cat-tortas", nome: "Bolos" }],
    };
    expect(ehItemBolo({ produtoId: "p-especial", nome: "Receita Especial da Casa" }, renomeado)).toBe(true);
  });

  it("sobremesas e adicionais continuam entregáveis", () => {
    expect(ehItemBolo({ produtoId: "p-cheese", nome: "Cheesecake Lotus" }, catalogo)).toBe(false);
    expect(
      ehItemBolo({ produtoId: "p-vinho", nome: "Vinho Francês Tinto Le Petit Ronan By Clinet" }, catalogo),
    ).toBe(false);
  });
});

describe("defaultRegras: modos de entrega", () => {
  const item = (nome: string, produto_tipo: "cesta" | "sobremesa" = "cesta") =>
    ({ produto_id: "x", produto_tipo, nome }) as CarrinhoItem;

  it("bolo e naked cake só retirada", () => {
    expect(defaultRegras(item("Bolo Dragê · Tam. M")).allowed_fulfillment_modes).toEqual(["retirada"]);
    expect(defaultRegras(item("Naked Cake de Baunilha com Morango")).allowed_fulfillment_modes).toEqual([
      "retirada",
    ]);
  });

  it("sobremesa e itens com 'petit' no nome podem ser entregues", () => {
    expect(defaultRegras(item("Travessa de Morango", "sobremesa")).allowed_fulfillment_modes).toEqual([
      "delivery",
      "retirada",
    ]);
    expect(
      defaultRegras(item("Vinho Francês Tinto Le Petit Ronan By Clinet")).allowed_fulfillment_modes,
    ).toEqual(["delivery", "retirada"]);
  });
});
