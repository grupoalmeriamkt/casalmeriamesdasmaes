import { describe, expect, it } from "vitest";
import {
  aplicarCestasCafePorTamanho,
  CESTA_CAFE_IDS,
  ehCestaCafeAgrupada,
} from "./cestasCafe";

const agrupada = {
  id: "cesta-unica",
  nome: "Cesta de Café da Manhã",
  preco: 150,
  descricao: "Cesta de café da manhã em tamanhos P, M e G. Slice Cake disponível nos tamanhos M e G.",
  itens: [],
  imagem: "https://example.com/old.jpg",
  ativo: true,
  arquivado: false,
  tamanhos: [
    { label: "P", preco: 150 },
    { label: "M", preco: 260 },
    { label: "G", preco: 330 },
  ],
};

describe("cestasCafe", () => {
  it("reconhece a cesta única com P/M/G", () => {
    expect(ehCestaCafeAgrupada(agrupada)).toBe(true);
    expect(ehCestaCafeAgrupada({ ...agrupada, id: CESTA_CAFE_IDS.p, tamanhos: [] })).toBe(false);
  });

  it("não trata bolo/torta com selo TAMANHOS P, M E G como cesta", () => {
    const bolo = {
      id: "bolo-choco",
      nome: "Bolo de Chocolate com Café",
      badge: "TAMANHOS P, M E G",
      descricao: "Bolo de chocolate, com brigadeiro...",
      preco: 195,
      tamanhos: [
        { label: "P", preco: 195 },
        { label: "M", preco: 280 },
        { label: "G", preco: 360 },
      ],
    };
    expect(ehCestaCafeAgrupada(bolo)).toBe(false);
    const { cestas } = aplicarCestasCafePorTamanho(
      [{ ...bolo, ativo: false, arquivado: true }, agrupada],
      [],
    );
    expect(cestas.find((c) => c.id === "bolo-choco")?.arquivado).toBe(false);
    expect(cestas.find((c) => c.id === "bolo-choco")?.ativo).toBe(true);
    expect(cestas.find((c) => c.id === "cesta-unica")?.arquivado).toBe(true);
  });

  it("reconhece variação de nome e labels com espaço", () => {
    expect(
      ehCestaCafeAgrupada({
        id: "x",
        nome: "Cesta Café da Manhã",
        preco: 150,
        tamanhos: [
          { label: "P ", preco: 150 },
          { label: "M", preco: 260 },
          { label: "G", preco: 330 },
        ],
      }),
    ).toBe(true);
  });

  it("separa em três produtos e troca na campanha cestas-cafe", () => {
    const { cestas, campanhas, mudou } = aplicarCestasCafePorTamanho(
      [agrupada],
      [{ slug: "cestas-cafe", produtosPrincipaisIds: ["cesta-unica"] }],
    );
    expect(mudou).toBe(true);
    expect(cestas.find((c) => c.id === "cesta-unica")?.arquivado).toBe(true);
    expect(cestas.find((c) => c.id === CESTA_CAFE_IDS.p)?.preco).toBe(150);
    expect(cestas.find((c) => c.id === CESTA_CAFE_IDS.m)?.preco).toBe(260);
    expect(cestas.find((c) => c.id === CESTA_CAFE_IDS.g)?.preco).toBe(330);
    expect(cestas.find((c) => c.id === CESTA_CAFE_IDS.p)?.itens?.length).toBeGreaterThan(3);
    expect(campanhas[0].produtosPrincipaisIds).toEqual([
      CESTA_CAFE_IDS.p,
      CESTA_CAFE_IDS.m,
      CESTA_CAFE_IDS.g,
    ]);
  });

  it("é idempotente depois da separação", () => {
    const once = aplicarCestasCafePorTamanho(
      [agrupada],
      [{ slug: "cestas-cafe", produtosPrincipaisIds: ["cesta-unica"] }],
    );
    const twice = aplicarCestasCafePorTamanho(once.cestas, once.campanhas);
    expect(twice.mudou).toBe(false);
  });

  it("os três produtos não têm tamanhos e têm descrições próprias", () => {
    const { cestas } = aplicarCestasCafePorTamanho([agrupada], []);
    const p = cestas.find((c) => c.id === CESTA_CAFE_IDS.p);
    const m = cestas.find((c) => c.id === CESTA_CAFE_IDS.m);
    const g = cestas.find((c) => c.id === CESTA_CAFE_IDS.g);
    expect(p?.tamanhos).toBeUndefined();
    expect(m?.tamanhos).toBeUndefined();
    expect(g?.tamanhos).toBeUndefined();
    expect(p?.descricao).not.toBe(m?.descricao);
    expect(m?.descricao).not.toBe(g?.descricao);
    expect(cestas.filter((c) => c.ativo && !c.arquivado)).toHaveLength(3);
  });
});
