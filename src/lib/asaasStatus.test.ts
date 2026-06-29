import { describe, expect, it } from "vitest";
import { pagamentoRelevante, pedidoStatusFromPagamentos } from "@/lib/asaasStatus";
import { normalizePaymentStatus } from "@/lib/paymentStatus";

describe("pagamentoRelevante", () => {
  it("prioriza PIX pago sobre tentativa pendente mais nova", () => {
    const lista = [
      { id: "1", status: "PENDING", criado_em: "2026-06-29T12:00:00Z", asaas_payment_id: "a" },
      { id: "2", status: "CONFIRMED", criado_em: "2026-06-29T11:00:00Z", asaas_payment_id: "b" },
    ];
    expect(pagamentoRelevante(lista)?.status).toBe("CONFIRMED");
  });
});

describe("normalizePaymentStatus", () => {
  it("mapeia CONFIRMED para aprovado", () => {
    expect(normalizePaymentStatus("CONFIRMED")).toBe("aprovado");
  });

  it("mapeia PENDING para aguardando", () => {
    expect(normalizePaymentStatus("PENDING")).toBe("aguardando");
  });
});

describe("pedidoStatusFromPagamentos", () => {
  it("retorna pago quando há pagamento confirmado", () => {
    const status = pedidoStatusFromPagamentos([
      { status: "CONFIRMED", criado_em: "2026-06-29T10:00:00Z" },
    ]);
    expect(status).toBe("pago");
  });
});
