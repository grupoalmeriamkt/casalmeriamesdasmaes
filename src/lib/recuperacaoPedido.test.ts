import { describe, expect, it } from "vitest";
import {
  dentroDaJanelaRecuperacao,
  linkWhatsApp,
  mensagemRecuperacaoPedido,
  resumoTempoDesde,
} from "./recuperacaoPedido";

describe("linkWhatsApp", () => {
  it("acrescenta o DDI 55 e codifica a mensagem", () => {
    expect(linkWhatsApp("(61) 99999-8888", "Oi, tudo bem?")).toBe(
      "https://wa.me/5561999998888?text=Oi%2C%20tudo%20bem%3F",
    );
  });

  it("não duplica o DDI de quem já tem", () => {
    expect(linkWhatsApp("5561999998888", "Oi")).toContain("wa.me/5561999998888?");
  });
});

describe("mensagemRecuperacaoPedido", () => {
  it("usa o primeiro nome, o número do pedido e o valor", () => {
    const msg = mensagemRecuperacaoPedido({
      nome: "Juliana Oliveira",
      pedidoId: "0a0aa2bc-2eae-4c1e-b518-ca77da9010c3",
      total: 260,
    });
    expect(msg).toContain("Oi, Juliana!");
    expect(msg).toContain("#0A0AA2BC");
    expect(msg).toContain("260");
    expect(msg).not.toContain("Oliveira");
  });

  it("não quebra quando o nome vem vazio", () => {
    expect(mensagemRecuperacaoPedido({ nome: "  ", pedidoId: "abcdefgh", total: 10 })).toContain(
      "Oi! Aqui é da Casa Almeria.",
    );
  });
});

describe("resumoTempoDesde", () => {
  const agora = new Date("2026-09-25T15:00:00Z");

  it("conta minutos, horas e dias", () => {
    expect(resumoTempoDesde("2026-09-25T14:20:00Z", agora)).toBe("há 40 min");
    expect(resumoTempoDesde("2026-09-25T12:00:00Z", agora)).toBe("há 3 h");
    expect(resumoTempoDesde("2026-09-24T15:00:00Z", agora)).toBe("há 1 dia");
    expect(resumoTempoDesde("2026-09-23T15:00:00Z", agora)).toBe("há 2 dias");
  });

  it("devolve traço para data inválida", () => {
    expect(resumoTempoDesde("", agora)).toBe("—");
  });
});

describe("dentroDaJanelaRecuperacao", () => {
  const agora = new Date("2026-09-25T15:00:00Z");

  it("mantém pedido recente e corta o antigo", () => {
    expect(dentroDaJanelaRecuperacao("2026-09-24T15:00:00Z", agora)).toBe(true);
    expect(dentroDaJanelaRecuperacao("2026-09-11T16:00:00Z", agora)).toBe(true);
    expect(dentroDaJanelaRecuperacao("2026-09-10T15:00:00Z", agora)).toBe(false);
  });

  it("aceita janela customizada e recusa data inválida", () => {
    expect(dentroDaJanelaRecuperacao("2026-09-20T15:00:00Z", agora, 3)).toBe(false);
    expect(dentroDaJanelaRecuperacao("nao-e-data", agora)).toBe(false);
  });
});
