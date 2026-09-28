import { describe, expect, it } from "vitest";
import { normalizePaymentStatus } from "./paymentStatus";

describe("normalizePaymentStatus", () => {
  it("trata como aprovado quando o pagamento foi confirmado, mesmo com status velho", () => {
    // O autosave do checkout devolvia o pedido pago para "rascunho"; a fila perdia a venda.
    expect(normalizePaymentStatus("CONFIRMED", "rascunho")).toBe("aprovado");
    expect(normalizePaymentStatus("RECEIVED", "aguardando_pagamento")).toBe("aprovado");
    expect(normalizePaymentStatus("RECEIVED", "abandonado")).toBe("aprovado");
    expect(normalizePaymentStatus(null, "pago")).toBe("aprovado");
  });

  it("mantém cancelado e expirado acima do pagamento (têm estorno)", () => {
    expect(normalizePaymentStatus("CONFIRMED", "cancelado")).toBe("cancelado");
    expect(normalizePaymentStatus("CONFIRMED", "expirado")).toBe("cancelado");
  });

  it("segue classificando rascunho, abandonado, vencido e aguardando", () => {
    expect(normalizePaymentStatus(null, "rascunho")).toBe("rascunho");
    expect(normalizePaymentStatus(null, "abandonado")).toBe("abandonado");
    expect(normalizePaymentStatus("OVERDUE", "vencido")).toBe("vencido");
    expect(normalizePaymentStatus("PENDING", "aguardando_pagamento")).toBe("aguardando");
  });
});
