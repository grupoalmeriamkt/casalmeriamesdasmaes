import { describe, it, expect } from "vitest";
import { grupoDaCesta, particionarCestas, expandirTamanhos } from "./produtoGrupos";

describe("grupoDaCesta", () => {
  it("classifica cestas de campanha como especial", () => {
    expect(grupoDaCesta("Cesta Especial - Dia dos Namorados")).toBe("especial");
    expect(grupoDaCesta("Cesta de Natal")).toBe("especial");
    expect(grupoDaCesta("Cesta Café da Manhã Tamanho M")).toBe("padrao");
  });
  it("particiona mantendo ordem", () => {
    const r = particionarCestas([
      { nome: "Cesta Café da Manhã Tamanho M" },
      { nome: "Cesta Especial - Dia dos Namorados" },
    ]);
    expect(r.padrao).toHaveLength(1);
    expect(r.especiais).toHaveLength(1);
  });
});

describe("expandirTamanhos", () => {
  it("expande P/M/G em linhas separadas com preço do tamanho", () => {
    const linhas = expandirTamanhos([
      {
        id: "bolo-choco",
        nome: "Bolo de Chocolate",
        preco: 195,
        tamanhos: [
          { id: "tam-p", label: "P", preco: 195 },
          { id: "tam-m", label: "M", preco: 280 },
          { id: "tam-g", label: "G", preco: 360 },
        ],
      },
    ]);
    expect(linhas).toHaveLength(3);
    expect(linhas.map((l) => l.tamanho)).toEqual(["P", "M", "G"]);
    expect(linhas[1]).toMatchObject({
      produtoId: "bolo-choco",
      preco: 280,
      nome: "Bolo de Chocolate · Tam. M",
    });
  });

  it("mantém produto sem tamanhos como linha única", () => {
    const linhas = expandirTamanhos([{ id: "vinho", nome: "Vinho", preco: 144 }]);
    expect(linhas).toEqual([
      { lineId: "vinho", produtoId: "vinho", nome: "Vinho", preco: 144 },
    ]);
  });
});
