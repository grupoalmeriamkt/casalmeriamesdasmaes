import { describe, expect, it } from "vitest";
import { statusKeyPedido } from "@/lib/statusPedidoTela";

describe("statusKeyPedido · defesa em profundidade (não confia na coluna crua)", () => {
  it("pedido PIX pago (pagamento RECEIVED) mapeia como aprovado mesmo com status interno defasado", () => {
    // Cenário do bug: webhook do Asaas se perdeu / conciliação diária atrasou, então
    // pedidos.status e payment_status_normalized ficaram em "aguardando", mas o
    // registro em `pagamentos` (pagamento relevante) já está RECEIVED. Não pode ir
    // pro balde "Aguardando pagamento".
    expect(statusKeyPedido("RECEIVED", "aguardando_pagamento")).toBe("aprovado");
    expect(statusKeyPedido("CONFIRMED", "aguardando_pagamento")).toBe("aprovado");
    expect(statusKeyPedido("RECEIVED_IN_CASH", "aguardando_pagamento")).toBe("aprovado");
  });

  it("pedido realmente aguardando permanece pendente", () => {
    expect(statusKeyPedido("PENDING", "aguardando_pagamento")).toBe("pendente");
    expect(statusKeyPedido("AWAITING_RISK_ANALYSIS", "aguardando_pagamento")).toBe("pendente");
  });

  it("preserva rascunho / abandonado / cancelado (status interno do pedido)", () => {
    expect(statusKeyPedido("rascunho", "rascunho")).toBe("rascunho");
    expect(statusKeyPedido("abandonado", "abandonado")).toBe("abandonado");
    // cancelado tem prioridade mesmo com pagamento pago (ex.: estorno posterior)
    expect(statusKeyPedido("RECEIVED", "cancelado")).toBe("abandonado");
  });

  it("funciona sem o status interno (call sites de badge/impressão que só têm o pagamento)", () => {
    expect(statusKeyPedido("RECEIVED")).toBe("aprovado");
    expect(statusKeyPedido("PENDING")).toBe("pendente");
    expect(statusKeyPedido("rascunho")).toBe("rascunho");
  });
});
