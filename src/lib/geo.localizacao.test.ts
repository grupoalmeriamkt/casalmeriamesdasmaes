import { describe, expect, it } from "vitest";
import { mensagemErroLocalizacao } from "./geo";

describe("mensagemErroLocalizacao", () => {
  it("orienta permissão no iPhone e Android", () => {
    const msg = mensagemErroLocalizacao("permissao_negada");
    expect(msg).toMatch(/iPhone|Safari/i);
    expect(msg).toMatch(/Android/i);
  });

  it("sugere digitar CEP quando não suportado", () => {
    expect(mensagemErroLocalizacao("nao_suportado")).toMatch(/CEP/i);
  });
});
