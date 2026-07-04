import { describe, expect, it } from "vitest";
import {
  agruparPorExecucao,
  filtrarPedidosOperacionais,
  isPedidoConcluido,
  rowToPedidoOperacional,
} from "@/lib/operacaoPedido";
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
  data_entrega: "2099-06-30",
  horario: "Entre 08h e 09h",
  pagamento: { metodo: "pix", status: "CONFIRMED" },
  total: 100,
  status: "pago",
  recipient_name: "Maria",
  recipient_phone: "61999999999",
  recipient_is_buyer: true,
  payment_status_normalized: "aprovado",
  is_test: false,
  execution_at: "2099-06-30T11:00:00.000Z",
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

describe("isPedidoConcluido", () => {
  it("considera finalizado ou arquivado", () => {
    expect(isPedidoConcluido({ fulfillmentStage: "finalizado", archivedAt: null })).toBe(true);
    expect(isPedidoConcluido({ fulfillmentStage: null, archivedAt: "2026-07-01" })).toBe(true);
    expect(isPedidoConcluido({ fulfillmentStage: "pronto", archivedAt: null })).toBe(false);
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

  it("filtro concluidos inclui arquivados e usa data de execução no período", () => {
    const lista = [
      rowToPedidoOperacional(
        baseRow({
          id: "arq",
          archived_at: "2026-07-03T12:00:00Z",
          criado_em: "2026-06-20T10:00:00Z",
          execution_at: "2026-07-02T11:00:00.000Z",
        }),
      ),
      rowToPedidoOperacional(baseRow({ id: "ativo" })),
    ];
    const out = filtrarPedidosOperacionais(lista, {
      concluidos: true,
      criadoInicio: "2026-07-01",
      criadoFim: "2026-07-31",
    });
    expect(out.map((p) => p.id)).toEqual(["arq"]);
  });
});

describe("agruparPorExecucao", () => {
  it("ordena grupos por data de execução ascendente (mais próxima primeiro), sem-data por último", () => {
    const pedidos = [
      rowToPedidoOperacional(
        baseRow({ id: "later", execution_at: "2099-07-05T11:00:00.000Z" }),
      ),
      rowToPedidoOperacional(baseRow({ id: "sem-data", execution_at: null })),
      rowToPedidoOperacional(
        baseRow({ id: "sooner", execution_at: "2099-07-01T11:00:00.000Z" }),
      ),
    ];
    const grupos = agruparPorExecucao(pedidos);
    const keys = grupos.map(([key]) => key);
    expect(keys).toEqual(["2099-07-01", "2099-07-05", "sem-data"]);
  });
});
