import { describe, expect, it } from "vitest";
import {
  labelPagamentoDetalhado,
  pagamentoRelevante,
  pedidoStatusFromPagamentos,
} from "@/lib/asaasStatus";
import { normalizePaymentStatus } from "@/lib/paymentStatus";

describe("labelPagamentoDetalhado", () => {
  it("descreve PIX pendente com expiração", () => {
    const label = labelPagamentoDetalhado({
      status: "PENDING",
      metodo: "PIX",
      pixExpiraEm: "2026-07-05T12:00:00.000Z",
      now: new Date("2026-07-04T12:00:00.000Z"),
    });
    expect(label).toMatch(/^PIX gerado — aguardando pagamento \(expira /);
  });

  it("descreve PIX expirado", () => {
    expect(
      labelPagamentoDetalhado({
        status: "OVERDUE",
        metodo: "PIX",
      }),
    ).toBe("PIX expirado — não pago");
  });

  it("descreve cartão em análise", () => {
    expect(
      labelPagamentoDetalhado({
        status: "AWAITING_RISK_ANALYSIS",
        metodo: "CREDIT_CARD",
      }),
    ).toBe("Cartão em análise antifraude");
  });

  it("descreve cartão sem cobrança concluída", () => {
    expect(
      labelPagamentoDetalhado({
        metodo: "credit_card",
        pedidoStatus: "aguardando_pagamento",
      }),
    ).toBe("Cartão selecionado — pagamento não concluído");
  });

  it("descreve cartão recusado com motivo gravado", () => {
    expect(
      labelPagamentoDetalhado({
        metodo: "CREDIT_CARD",
        pedidoStatus: "aguardando_pagamento",
        falhaPagamento: {
          motivo: "Transação não autorizada. Verifique os dados do cartão.",
          em: "2026-07-04T20:00:00.000Z",
          metodo: "CREDIT_CARD",
        },
      }),
    ).toBe(
      "Cartão recusado — Transação não autorizada. Verifique os dados do cartão.",
    );
  });
});

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
