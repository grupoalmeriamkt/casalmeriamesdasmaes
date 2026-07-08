import { describe, expect, it } from "vitest";
import { buildPagamentoManualPatch } from "@/lib/pedidoSync";

describe("buildPagamentoManualPatch", () => {
  const confirmedAt = "2026-07-08T15:00:00.000Z";

  it("pagamento em dinheiro grava payment_status_normalized aprovado", () => {
    const patch = buildPagamentoManualPatch({
      pagamentoAtual: {},
      metodo: "dinheiro",
      confirmedAt,
    });

    // Bug: sem este campo o pedido pago continua no balde "Aguardando".
    expect(patch.payment_status_normalized).toBe("aprovado");
    expect(patch.status).toBe("pago");
    expect(patch.payment_confirmed_at).toBe(confirmedAt);
    expect(patch.pagamento).toMatchObject({ metodo: "dinheiro", status: "pago" });
  });

  it("pagamento em dinheiro preserva o pagamento existente", () => {
    const patch = buildPagamentoManualPatch({
      pagamentoAtual: { destinatario: { nome: "Fulano" }, metodo: "PIX" },
      metodo: "dinheiro",
      confirmedAt,
    });

    expect(patch.pagamento).toMatchObject({
      destinatario: { nome: "Fulano" },
      metodo: "dinheiro",
      status: "pago",
    });
  });

  it("pagamento POS grava aprovado e mantém os dados da maquininha", () => {
    const patch = buildPagamentoManualPatch({
      pagamentoAtual: { extras: { obs: "x" } },
      metodo: "pos",
      confirmedAt,
      pos: { bandeira: "visa", parcelas: 2 },
    });

    expect(patch.payment_status_normalized).toBe("aprovado");
    expect(patch.status).toBe("pago");
    expect(patch.pagamento).toMatchObject({
      metodo: "pos",
      status: "pago",
      extras: { obs: "x", pos: { bandeira: "visa", parcelas: 2 } },
    });
  });
});
