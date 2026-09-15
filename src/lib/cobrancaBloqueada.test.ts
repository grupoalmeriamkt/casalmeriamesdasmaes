import { describe, expect, it } from "vitest";
import { decidirAcaoCobranca } from "@/lib/cobrancaBloqueada";

const base = {
  pedidoStatus: "aguardando_pagamento",
  pedidoExcluido: false,
  expiraEm: null,
  jaPagoAntes: false,
  now: new Date("2026-09-15T17:00:00.000Z"),
};

describe("decidirAcaoCobranca", () => {
  it("cancela cobrança aberta de pedido excluído ou cancelado (cliente abriu o link)", () => {
    expect(decidirAcaoCobranca({ ...base, statusAsaas: "PENDING", pedidoExcluido: true })).toBe(
      "cancelar_cobranca",
    );
    expect(
      decidirAcaoCobranca({ ...base, statusAsaas: "OVERDUE", pedidoStatus: "cancelado" }),
    ).toBe("cancelar_cobranca");
  });

  it("estorna pagamento novo de pedido excluído ou cancelado", () => {
    expect(decidirAcaoCobranca({ ...base, statusAsaas: "RECEIVED", pedidoExcluido: true })).toBe(
      "estornar",
    );
    expect(
      decidirAcaoCobranca({ ...base, statusAsaas: "CONFIRMED", pedidoStatus: "cancelado" }),
    ).toBe("estornar");
  });

  it("não estorna pagamento que já estava pago nem baixa manual", () => {
    expect(
      decidirAcaoCobranca({
        ...base,
        statusAsaas: "RECEIVED",
        pedidoStatus: "cancelado",
        jaPagoAntes: true,
      }),
    ).toBeNull();
    expect(
      decidirAcaoCobranca({ ...base, statusAsaas: "RECEIVED_IN_CASH", pedidoExcluido: true }),
    ).toBeNull();
  });

  it("expira pedido com prazo vencido e cobrança aberta", () => {
    expect(
      decidirAcaoCobranca({
        ...base,
        statusAsaas: "PENDING",
        expiraEm: "2026-09-15T16:58:00.000Z",
      }),
    ).toBe("expirar_pedido");
    expect(decidirAcaoCobranca({ ...base, statusAsaas: "PENDING", pedidoStatus: "expirado" })).toBe(
      "expirar_pedido",
    );
  });

  it("deixa em paz pedido em dia, pedido pago e cobrança já encerrada", () => {
    expect(
      decidirAcaoCobranca({
        ...base,
        statusAsaas: "PENDING",
        expiraEm: "2026-09-15T17:01:00.000Z",
      }),
    ).toBeNull();
    expect(
      decidirAcaoCobranca({ ...base, statusAsaas: "RECEIVED", pedidoStatus: "pago" }),
    ).toBeNull();
    expect(
      decidirAcaoCobranca({ ...base, statusAsaas: "REFUNDED", pedidoExcluido: true }),
    ).toBeNull();
    expect(decidirAcaoCobranca({ ...base, statusAsaas: "", pedidoExcluido: true })).toBeNull();
  });
});
