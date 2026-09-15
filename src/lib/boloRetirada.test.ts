import { describe, expect, it } from "vitest";
import {
  catalogoDoPayload,
  ehItemBolo,
  ehNomeBolo,
  motivoBoloSemEntrega,
  MSG_BOLO_PEDIDO_SEPARADO,
  MSG_BOLO_SO_RETIRADA,
} from "./boloRetirada";
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
    const renomeado = { ...catalogo, categorias: [{ id: "cat-tortas", nome: "Bolos" }] };
    expect(ehItemBolo({ produtoId: "p-especial", nome: "Receita Especial da Casa" }, renomeado)).toBe(true);
  });

  it("sobremesas e adicionais continuam entregáveis", () => {
    expect(ehItemBolo({ produtoId: "p-cheese", nome: "Cheesecake Lotus" }, catalogo)).toBe(false);
    expect(
      ehItemBolo({ produtoId: "p-vinho", nome: "Vinho Francês Tinto Le Petit Ronan By Clinet" }, catalogo),
    ).toBe(false);
  });
});

describe("motivoBoloSemEntrega", () => {
  const cat = catalogoDoPayload({ cestas: catalogo.produtos, categorias: catalogo.categorias });
  const bolo = { nome: "Bolo Dragê · Tam. M", preco: 280, quantidade: 1 };
  const cesta = { nome: "Cesta de Café da Manhã · Tam. M", preco: 290, quantidade: 1 };

  it("retirada com bolo segue", () => {
    expect(motivoBoloSemEntrega({ tipo: "retirada", cesta: bolo, sobremesas: [] }, cat)).toBeNull();
  });

  it("entrega só com bolos pede retirada", () => {
    expect(
      motivoBoloSemEntrega(
        { tipo: "delivery", cesta: bolo, sobremesas: [{ nome: "Receita Especial da Casa", preco: 1, quantidade: 1 }] },
        cat,
      ),
    ).toBe(MSG_BOLO_SO_RETIRADA);
  });

  it("entrega com bolo e outros itens pede pedidos separados", () => {
    expect(motivoBoloSemEntrega({ tipo: "delivery", cesta, sobremesas: [bolo] }, cat)).toBe(
      MSG_BOLO_PEDIDO_SEPARADO,
    );
  });

  it("entrega sem bolo segue", () => {
    expect(
      motivoBoloSemEntrega({ tipo: "delivery", cesta, sobremesas: [{ nome: "Quiches Bacon" }] }, cat),
    ).toBeNull();
  });
});

describe("defaultRegras", () => {
  const item = (nome: string, produto_tipo: "cesta" | "sobremesa" = "cesta") =>
    ({ produto_id: "x", produto_tipo, nome }) as CarrinhoItem;

  it("bolo e naked cake: só retirada e 24h de antecedência", () => {
    for (const nome of ["Bolo Dragê · Tam. M", "Naked Cake de Baunilha com Morango"]) {
      const r = defaultRegras(item(nome));
      expect(r.allowed_fulfillment_modes).toEqual(["retirada"]);
      expect(r.minimum_lead_time_hours).toBe(24);
    }
  });

  it("sobremesa e o vinho Le Petit podem ser entregues; o vinho não pega a regra de confeitaria", () => {
    expect(defaultRegras(item("Travessa de Morango", "sobremesa")).allowed_fulfillment_modes).toEqual([
      "delivery",
      "retirada",
    ]);
    const vinho = defaultRegras(item("Vinho Francês Tinto Le Petit Ronan By Clinet"));
    expect(vinho.allowed_fulfillment_modes).toEqual(["delivery", "retirada"]);
    expect(vinho.minimum_lead_time_hours).toBe(4);
  });
});
