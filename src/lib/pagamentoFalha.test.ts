import { describe, expect, it } from "vitest";
import {
  limparFalhaPagamento,
  mergeFalhaPagamento,
  parseFalhaPagamento,
} from "@/lib/pagamentoFalha";

describe("parseFalhaPagamento", () => {
  it("retorna null quando não há falha", () => {
    expect(parseFalhaPagamento({ metodo: "pix" })).toBeNull();
  });

  it("extrai falha válida", () => {
    expect(
      parseFalhaPagamento({
        falha_pagamento: {
          motivo: "Transação não autorizada.",
          em: "2026-07-04T20:00:00.000Z",
          metodo: "CREDIT_CARD",
        },
      }),
    ).toEqual({
      motivo: "Transação não autorizada.",
      em: "2026-07-04T20:00:00.000Z",
      metodo: "CREDIT_CARD",
    });
  });
});

describe("mergeFalhaPagamento", () => {
  it("grava falha e metodo cartão", () => {
    const merged = mergeFalhaPagamento(
      { metodo: "pix", extras: { cartoes: [] } },
      {
        motivo: "Cartão recusado",
        em: "2026-07-04T20:00:00.000Z",
        metodo: "CREDIT_CARD",
      },
    );
    expect(merged.metodo).toBe("credit_card");
    expect(merged.status).toBe("aguardando_pagamento");
    expect(merged.falha_pagamento).toMatchObject({ motivo: "Cartão recusado" });
    expect(merged.extras).toEqual({ cartoes: [] });
  });
});

describe("limparFalhaPagamento", () => {
  it("remove falha_pagamento", () => {
    const next = limparFalhaPagamento({
      metodo: "credit_card",
      falha_pagamento: { motivo: "x", em: "y", metodo: "CREDIT_CARD" },
    });
    expect(next.falha_pagamento).toBeUndefined();
    expect(next.metodo).toBe("credit_card");
  });
});
