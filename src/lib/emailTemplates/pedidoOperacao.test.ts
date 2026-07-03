import { describe, it, expect } from "vitest";
import { renderPedidoOperacaoEmail } from "./pedidoOperacao";

describe("renderPedidoOperacaoEmail", () => {
  it("inclui cliente, data de entrega e valor", () => {
    const { subject, html } = renderPedidoOperacaoEmail({
      id: "abc123",
      numero: "ABC123",
      criadoEm: "2026-07-02T19:35:00Z",
      clienteNome: "Marcio Mileski",
      clienteWhatsapp: "61984695396",
      tipo: "delivery",
      dataEntrega: "2026-07-07",
      horario: "Entre 08h e 09h",
      endereco: "Quadra SQN 402",
      itens: [{ nome: "Cesta Café da Manhã", quantidade: 1, preco: 330 }],
      total: 360,
      formaPagamento: "Cartão de crédito",
      quemPagou: "Marcio Mileski",
    });
    expect(subject).toContain("Marcio Mileski");
    expect(html).toContain("2026-07-07");
    expect(html).toContain("360");
    expect(html).toContain("Cesta Café da Manhã");
  });
});
