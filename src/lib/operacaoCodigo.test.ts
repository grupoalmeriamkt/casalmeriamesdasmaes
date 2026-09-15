import { describe, expect, it } from "vitest";
import {
  codigoAcessoValido,
  cpfValido,
  formatarCpf,
  gerarCodigoAcesso,
  mensagemAcessoOperador,
} from "./operacaoCodigo";

describe("cpfValido", () => {
  it("aceita CPF com dígitos verificadores corretos, com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e dígitos repetidos", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
});

describe("formatarCpf", () => {
  it("formata 11 dígitos e devolve o resto como veio", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("codigoAcessoValido", () => {
  it("aceita de 6 a 8 dígitos, inclusive com zero à esquerda", () => {
    expect(codigoAcessoValido("102030")).toBe(true);
    expect(codigoAcessoValido("01234567")).toBe(true);
  });

  it("recusa curto, longo ou com letras", () => {
    expect(codigoAcessoValido("12345")).toBe(false);
    expect(codigoAcessoValido("123456789")).toBe(false);
    expect(codigoAcessoValido("12a456")).toBe(false);
  });
});

describe("gerarCodigoAcesso", () => {
  it("gera sempre 6 dígitos válidos", () => {
    for (let i = 0; i < 500; i++) {
      const codigo = gerarCodigoAcesso();
      expect(codigo).toHaveLength(6);
      expect(codigoAcessoValido(codigo)).toBe(true);
    }
  });
});

describe("mensagemAcessoOperador", () => {
  it("inclui nome, link e código", () => {
    const msg = mensagemAcessoOperador({
      nome: "Juliana",
      codigo: "102030",
      portalUrl: "https://vendas.grupoalmeria.com.br/operacao",
    });
    expect(msg).toContain("Juliana");
    expect(msg).toContain("https://vendas.grupoalmeria.com.br/operacao");
    expect(msg).toContain("Código: 102030");
  });
});
