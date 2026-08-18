import { describe, expect, it } from "vitest";
import { buildPagamentoManualPatch, deveReabrirPedidoAoPagar } from "@/lib/pedidoSync";

describe("deveReabrirPedidoAoPagar", () => {
  it("reabre se concluiu antes do pagamento", () => {
    expect(
      deveReabrirPedidoAoPagar({
        concluidoAt: "2026-08-10T12:56:28.656Z",
        paymentConfirmedAt: null,
        pagamentoAprovado: true,
      }),
    ).toBe(true);
  });

  it("reabre se o pagamento entrou depois da conclusão", () => {
    expect(
      deveReabrirPedidoAoPagar({
        concluidoAt: "2026-08-10T12:56:28.656Z",
        paymentConfirmedAt: "2026-08-14T20:33:34.467Z",
        pagamentoAprovado: true,
      }),
    ).toBe(true);
  });

  it("não reabre se a operação concluiu depois do pagamento", () => {
    expect(
      deveReabrirPedidoAoPagar({
        concluidoAt: "2026-08-18T15:00:00.000Z",
        paymentConfirmedAt: "2026-08-14T20:33:34.467Z",
        pagamentoAprovado: true,
      }),
    ).toBe(false);
  });

  it("não reabre se não está concluído ou o pagamento não aprovou", () => {
    expect(
      deveReabrirPedidoAoPagar({
        concluidoAt: null,
        paymentConfirmedAt: null,
        pagamentoAprovado: true,
      }),
    ).toBe(false);
    expect(
      deveReabrirPedidoAoPagar({
        concluidoAt: "2026-08-10T12:56:28.656Z",
        paymentConfirmedAt: null,
        pagamentoAprovado: false,
      }),
    ).toBe(false);
  });
});


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

  it("reabre pedido concluído cedo demais ao registrar dinheiro", () => {
    const patch = buildPagamentoManualPatch({
      pagamentoAtual: {},
      metodo: "dinheiro",
      confirmedAt,
      concluidoAt: "2026-08-10T12:56:28.656Z",
      paymentConfirmedAt: null,
    });

    expect(patch.concluido_at).toBeNull();
    expect(patch.concluido_by).toBeNull();
  });

  it("não reabre se já estava concluído depois do pagamento", () => {
    const patch = buildPagamentoManualPatch({
      pagamentoAtual: {},
      metodo: "dinheiro",
      confirmedAt,
      concluidoAt: "2026-08-18T15:00:00.000Z",
      paymentConfirmedAt: "2026-08-14T20:33:34.467Z",
    });

    expect(patch.concluido_at).toBeUndefined();
    expect(patch.concluido_by).toBeUndefined();
  });
});
