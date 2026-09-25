import { describe, expect, it } from "vitest";
import {
  motivoRecuperacaoPedido,
  pedidoNaFilaAprovados,
  statusKeyPedido,
} from "@/lib/statusPedidoTela";

describe("pedidoNaFilaAprovados · fila do portal de operação", () => {
  it("mantém pedido aprovado ainda não concluído nem arquivado", () => {
    expect(pedidoNaFilaAprovados({ pagamento: { status: "RECEIVED" } }, "pago")).toBe(true);
    // pago no balcão: sem registro em `pagamentos`, status do pagamento cai no do pedido
    expect(pedidoNaFilaAprovados({ pagamento: { status: "pago" } }, "pago")).toBe(true);
  });

  it("tira da fila pedido concluído na central mesmo sem arquivar", () => {
    expect(
      pedidoNaFilaAprovados(
        {
          pagamento: { status: "RECEIVED" },
          concluidoAt: "2026-09-09T16:49:31Z",
          archivedAt: null,
        },
        "pago",
      ),
    ).toBe(false);
  });

  it("tira da fila pedido arquivado", () => {
    expect(
      pedidoNaFilaAprovados(
        { pagamento: { status: "RECEIVED" }, archivedAt: "2026-09-09T16:49:31Z" },
        "pago",
      ),
    ).toBe(false);
  });

  it("não inclui rascunho nem pedido aguardando pagamento", () => {
    expect(pedidoNaFilaAprovados({ pagamento: { status: "rascunho" } }, "rascunho")).toBe(false);
    expect(pedidoNaFilaAprovados({ pagamento: { status: "pendente" } }, "pendente")).toBe(false);
  });
});

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

describe("motivoRecuperacaoPedido · lista de recuperação", () => {
  it("pega quem tentou pagar e não conseguiu", () => {
    expect(motivoRecuperacaoPedido({ pagamento: { status: "PENDING" } }, "pendente")).toBe(
      "aguardando",
    );
    expect(motivoRecuperacaoPedido({ pagamento: { status: "OVERDUE" } }, "vencido")).toBe(
      "vencido",
    );
    expect(motivoRecuperacaoPedido({ pagamento: { status: "PENDING" } }, "expirado")).toBe(
      "expirado",
    );
    expect(motivoRecuperacaoPedido({}, "aguardando_pagamento")).toBe("aguardando");
  });

  it("deixa de fora aprovado, rascunho, cancelado e abandonado", () => {
    expect(motivoRecuperacaoPedido({ pagamento: { status: "RECEIVED" } }, "pago")).toBeNull();
    expect(motivoRecuperacaoPedido({}, "rascunho")).toBeNull();
    expect(motivoRecuperacaoPedido({}, "cancelado")).toBeNull();
    expect(motivoRecuperacaoPedido({}, "abandonado")).toBeNull();
  });

  it("deixa de fora quem já foi arquivado ou concluído", () => {
    const pendente = { pagamento: { status: "PENDING" } };
    expect(
      motivoRecuperacaoPedido({ ...pendente, archivedAt: "2026-09-20T10:00:00Z" }, "pendente"),
    ).toBeNull();
    expect(
      motivoRecuperacaoPedido({ ...pendente, concluidoAt: "2026-09-20T10:00:00Z" }, "pendente"),
    ).toBeNull();
  });
});
