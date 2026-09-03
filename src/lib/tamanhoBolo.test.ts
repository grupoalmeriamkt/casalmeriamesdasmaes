import { describe, expect, it } from "vitest";
import { aplicarTamanhosBoloPadrao, completarTamanhoBolo, resumoTamanho } from "./tamanhoBolo";

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
