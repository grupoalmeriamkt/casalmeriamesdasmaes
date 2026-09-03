import { describe, expect, it } from "vitest";
import {
  aplicarNomeCategoriaBolos,
  aplicarSubtituloComBolos,
  aplicarTamanhosBoloPadrao,
  completarTamanhoBolo,
  resumoTamanho,
} from "./tamanhoBolo";

describe("tamanhoBolo", () => {
  it("preenche P/M/G vazios com peso e porções", () => {
    const p = completarTamanhoBolo({ id: "1", label: "P", preco: 195 });
    expect(p.peso).toBe("1 kg");
    expect(p.serve).toBe("8 a 10 pessoas");
    expect(resumoTamanho(p)).toContain("1 kg");
    expect(resumoTamanho(p)).toContain("8 a 10 pessoas");
  });

  it("não sobrescreve o que o admin já cadastrou", () => {
    const t = completarTamanhoBolo({
      id: "1",
      label: "M",
      preco: 280,
      peso: "2 kg",
      serve: "15 pessoas",
    });
    expect(t.peso).toBe("2 kg");
    expect(t.serve).toBe("15 pessoas");
  });

  it("renomeia Tortas para Bolos", () => {
    const { categorias, mudou } = aplicarNomeCategoriaBolos([
      { id: "cat-cestas-cafe", nome: "Cestas" },
      { id: "cat-cestas", nome: "Tortas" },
    ]);
    expect(mudou).toBe(true);
    expect(categorias.find((c) => c.id === "cat-cestas")?.nome).toBe("Bolos");
    expect(aplicarNomeCategoriaBolos(categorias).mudou).toBe(false);
  });

  it("inclui bolos no subtítulo do hero", () => {
    expect(aplicarSubtituloComBolos("Cestas, sobremesas e tábuas com entrega ou retirada em Brasília")).toBe(
      "Cestas, bolos, sobremesas e tábuas com entrega ou retirada em Brasília",
    );
  });

  it("não aplica peso de bolo na cesta de café agrupada", () => {
    const { cestas, mudou } = aplicarTamanhosBoloPadrao([
      {
        id: "cesta-unica",
        nome: "Cesta de Café da Manhã",
        tamanhos: [
          { id: "p", label: "P", preco: 150 },
          { id: "m", label: "M", preco: 260 },
        ],
      },
    ]);
    expect(mudou).toBe(false);
    expect(cestas[0].tamanhos?.[0].peso).toBeUndefined();
  });
});
