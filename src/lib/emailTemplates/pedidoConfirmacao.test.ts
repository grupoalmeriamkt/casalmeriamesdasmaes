import { describe, expect, it } from "vitest";
import { pedidoConfirmacaoEmail } from "@/lib/emailTemplates/pedidoConfirmacao";
import type { PedidoSalvo } from "@/store/admin";

const pedidoBase: PedidoSalvo = {
  id: "abc12345-0000-4000-8000-000000000001",
  criadoEm: "2026-07-01T12:00:00Z",
  cliente: { nome: "Maria Silva", whatsapp: "61999999999" },
  cesta: { nome: "Cesta M", quantidade: 1, preco: 250 },
  sobremesas: [{ nome: "Brownie", quantidade: 2, preco: 15 }],
  tipo: "delivery",
  enderecoOuUnidade: "Asa Sul — Bloco A",
  data: "2026-07-05",
  horario: "14:00",
  pagamento: { metodo: "PIX", status: "CONFIRMED", cupom: "NATAL10", desconto: 28 },
  total: 252,
};

describe("pedidoConfirmacaoEmail", () => {
  it("monta assunto com referência do pedido", () => {
    const { subject } = pedidoConfirmacaoEmail(pedidoBase);
    expect(subject).toContain("ABC12345");
    expect(subject).toContain("confirmado");
  });

  it("inclui itens e total no corpo", () => {
    const { html, text } = pedidoConfirmacaoEmail(pedidoBase);
    expect(html).toContain("Cesta M");
    expect(html).toContain("Brownie");
    expect(html.replace(/\u00a0/g, " ")).toContain("R$ 252,00");
    expect(text).toContain("Maria Silva");
    expect(text).toContain("Entrega");
  });
});
