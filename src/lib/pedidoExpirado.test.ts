import { describe, expect, it } from "vitest";
import {
  LABEL_PAGAMENTO_EXPIRADO,
  labelPagamentoDetalhado,
  pedidoStatusFromPagamentos,
} from "@/lib/asaasStatus";
import { normalizePaymentStatus } from "@/lib/paymentStatus";
import { statusKeyPedido } from "@/lib/statusPedidoTela";

describe("pedido expirado (prazo de pagamento esgotado)", () => {
  it("fica junto dos cancelados, mesmo com pagamento confirmado a caminho do estorno", () => {
    expect(normalizePaymentStatus("RECEIVED", "expirado")).toBe("cancelado");
    expect(normalizePaymentStatus("PAYMENT_DELETED", "expirado")).toBe("cancelado");
    expect(statusKeyPedido("RECEIVED", "expirado")).toBe("abandonado");
  });

  it("a sincronização de pagamentos não reabre o pedido", () => {
    expect(
      pedidoStatusFromPagamentos(
        [{ status: "RECEIVED", criado_em: "2026-09-15T17:00:00.000Z" }],
        "expirado",
      ),
    ).toBe("expirado");
  });

  it("mostra o motivo no painel", () => {
    expect(
      labelPagamentoDetalhado({
        status: "PAYMENT_DELETED",
        metodo: "PIX",
        pedidoStatus: "expirado",
      }),
    ).toBe(LABEL_PAGAMENTO_EXPIRADO);
  });
});
