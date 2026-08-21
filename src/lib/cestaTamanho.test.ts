import { describe, expect, it } from "vitest";
import {
  appendTamanhoAoNome,
  buildCestaPayloadFromState,
  formatItemPedidoLabel,
  parseTamanhoDoNome,
  resolveCestaItem,
} from "./cestaTamanho";

describe("parseTamanhoDoNome", () => {
  it("extrai tamanho do sufixo padrão", () => {
    expect(parseTamanhoDoNome("Bolo de Pistache · Tam. M")).toEqual({
      nomeBase: "Bolo de Pistache",
      tamanho: "M",
    });
  });

  it("aceita hífen como separador", () => {
    expect(parseTamanhoDoNome("Cesta Café - Tam. G")).toEqual({
      nomeBase: "Cesta Café",
      tamanho: "G",
    });
  });

  it("retorna null quando não há tamanho", () => {
    expect(parseTamanhoDoNome("Bolo de Cenoura")).toEqual({
      nomeBase: "Bolo de Cenoura",
      tamanho: null,
    });
  });
});

describe("resolveCestaItem", () => {
  it("prioriza campo tamanho explícito", () => {
    expect(
      resolveCestaItem({
        nome: "Cesta Café da Manhã",
        quantidade: 1,
        preco: 100,
        tamanho: "P",
      }),
    ).toEqual({ nomeBase: "Cesta Café da Manhã", tamanho: "P", quantidade: 1 });
  });
});

describe("buildCestaPayloadFromState", () => {
  it("monta nome e campo tamanho", () => {
    const payload = buildCestaPayloadFromState(
      {
        cesta: {
          nome: "Cesta Café",
          tamanhos: [{ id: "t1", label: "M", preco: 200 }],
        },
        quantidade: 2,
      },
      "t1",
      200,
    );
    expect(payload).toEqual({
      nome: "Cesta Café · Tam. M",
      quantidade: 2,
      preco: 200,
      tamanho: "M",
    });
  });
});

describe("appendTamanhoAoNome", () => {
  it("substitui tamanho existente", () => {
    expect(appendTamanhoAoNome("Cesta · Tam. P", "G")).toBe("Cesta · Tam. G");
  });
});

describe("formatItemPedidoLabel", () => {
  it("mostra tamanho gravado mesmo se o nome não tiver sufixo", () => {
    expect(
      formatItemPedidoLabel({ nome: "Cesta de Café da Manhã", tamanho: "G" }),
    ).toBe("Cesta de Café da Manhã · Tam. G");
  });

  it("reaproveita o sufixo do nome", () => {
    expect(formatItemPedidoLabel({ nome: "Bolo Dragê · Tam. P" })).toBe("Bolo Dragê · Tam. P");
  });

  it("não inventa tamanho quando não há", () => {
    expect(formatItemPedidoLabel({ nome: "Cesta de Café da Manhã" })).toBe("Cesta de Café da Manhã");
  });
});
