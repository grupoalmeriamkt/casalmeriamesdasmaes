import { describe, expect, it } from "vitest";
import { filtrarPedidosOperacionais, rowToPedidoOperacional } from "@/lib/operacaoPedido";
import type { PedidoRow } from "@/lib/pedidos";

const baseRow = (patch: Partial<PedidoRow> = {}): PedidoRow => ({
  id: "abc-123",
  criado_em: "2026-06-29T10:00:00Z",
  cliente_nome: "Maria",
  cliente_whatsapp: "61999999999",
  cesta: { nome: "Cesta", quantidade: 1, preco: 100 },
  sobremesas: [],
  tipo: "retirada",
  endereco_ou_unidade: "Unidade X",
  data_entrega: "2026-06-30",
  horario: "Entre 08h e 09h",
  pagamento: { metodo: "pix", status: "CONFIRMED" },
  total: 100,
  status: "pago",
  recipient_name: "Maria",
  recipient_phone: "61999999999",
  recipient_is_buyer: true,
  payment_status_normalized: "aprovado",
  is_test: false,
  execution_at: "2026-06-30T11:00:00.000Z",
  pagamentos: [{ id: "p1", asaas_payment_id: "pay1", metodo: "PIX", status: "CONFIRMED", valor: 100, cupom_codigo: null, cupom_desconto: null, cartao_brand: null, cartao_last4: null, criado_em: "2026-06-29T10:00:00Z" }],
  ...patch,
});

describe("rowToPedidoOperacional", () => {
  it("usa comprador como destinatário quando recipient_is_buyer", () => {
    const op = rowToPedidoOperacional(baseRow());
    expect(op.recipientName).toBe("Maria");
    expect(op.recipientIsBuyer).toBe(true);
  });

  it("usa destinatário distinto quando informado", () => {
    const op = rowToPedidoOperacional(
      baseRow({
        recipient_is_buyer: false,
        recipient_name: "João",
        recipient_phone: "61888888888",
        pagamento: {
          metodo: "pix",
          status: "CONFIRMED",
          destinatario: { nome: "João", whatsapp: "61888888888" },
        },
      }),
    );
    expect(op.recipientName).toBe("João");
  });
});

describe("filtrarPedidosOperacionais", () => {
  it("oculta testes por padrão", () => {
    const lista = [
      rowToPedidoOperacional(baseRow()),
      rowToPedidoOperacional(baseRow({ id: "test-1", is_test: true })),
    ];
    const out = filtrarPedidosOperacionais(lista, { status: ["aprovado"] });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("abc-123");
  });
});
