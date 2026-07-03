import { describe, it, expect } from "vitest";
import { grupoDaCesta, particionarCestas } from "./produtoGrupos";

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
