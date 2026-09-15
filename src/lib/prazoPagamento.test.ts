import { describe, expect, it } from "vitest";
import {
  calcularPrazoPagamento,
  confirmacaoForaDoPrazo,
  decidirConfirmacao,
  formatarContagem,
  parseDataHoraAsaas,
  prazoEsgotado,
  segundosRestantes,
} from "@/lib/prazoPagamento";

const INICIO = new Date("2026-09-15T17:00:00.000Z");
const PRAZO = "2026-09-15T17:02:00.000Z";

describe("prazo de pagamento", () => {
  it("dá 2 minutos a partir do início", () => {
    expect(calcularPrazoPagamento(INICIO)).toBe(PRAZO);
  });

  it("esgota exatamente no fim do prazo", () => {
    expect(prazoEsgotado(PRAZO, new Date("2026-09-15T17:01:59.999Z"))).toBe(false);
    expect(prazoEsgotado(PRAZO, new Date("2026-09-15T17:02:00.000Z"))).toBe(true);
  });

  it("pedido sem prazo nunca esgota", () => {
    expect(prazoEsgotado(null, INICIO)).toBe(false);
    expect(prazoEsgotado("lixo", INICIO)).toBe(false);
  });

  it("conta os segundos restantes e formata m:ss", () => {
    expect(segundosRestantes(PRAZO, INICIO)).toBe(120);
    expect(segundosRestantes(PRAZO, new Date("2026-09-15T17:01:50.500Z"))).toBe(10);
    expect(segundosRestantes(PRAZO, new Date("2026-09-15T17:05:00.000Z"))).toBe(0);
    expect(formatarContagem(120)).toBe("2:00");
    expect(formatarContagem(9)).toBe("0:09");
  });

  it("aceita confirmação até 1 minuto depois do prazo", () => {
    expect(confirmacaoForaDoPrazo(PRAZO, new Date("2026-09-15T17:03:00.000Z"))).toBe(false);
    expect(confirmacaoForaDoPrazo(PRAZO, new Date("2026-09-15T17:03:00.001Z"))).toBe(true);
  });
});

describe("decidirConfirmacao", () => {
  const tarde = new Date("2026-09-15T17:10:00.000Z");
  const noPrazo = new Date("2026-09-15T17:01:30.000Z");

  it("estorna pagamento que chegou depois do prazo + tolerância", () => {
    expect(
      decidirConfirmacao({
        pedidoStatus: "aguardando_pagamento",
        expiraEm: PRAZO,
        confirmadoEm: tarde,
      }),
    ).toBe("estornar");
    expect(
      decidirConfirmacao({ pedidoStatus: "expirado", expiraEm: PRAZO, confirmadoEm: tarde }),
    ).toBe("estornar");
  });

  it("aceita pagamento dentro do prazo, mesmo se o pedido já foi expirado no limite", () => {
    expect(
      decidirConfirmacao({
        pedidoStatus: "aguardando_pagamento",
        expiraEm: PRAZO,
        confirmadoEm: noPrazo,
      }),
    ).toBe("aceitar");
    expect(
      decidirConfirmacao({ pedidoStatus: "expirado", expiraEm: PRAZO, confirmadoEm: noPrazo }),
    ).toBe("aceitar");
  });

  it("não mexe em pedido já pago nem em pedido antigo sem prazo", () => {
    expect(decidirConfirmacao({ pedidoStatus: "pago", expiraEm: PRAZO, confirmadoEm: tarde })).toBe(
      "aceitar",
    );
    expect(
      decidirConfirmacao({
        pedidoStatus: "aguardando_pagamento",
        expiraEm: null,
        confirmadoEm: tarde,
      }),
    ).toBe("aceitar");
  });

  it("sem horário da confirmação, só estorna pedido já expirado", () => {
    expect(decidirConfirmacao({ pedidoStatus: "expirado", expiraEm: PRAZO })).toBe("estornar");
    expect(decidirConfirmacao({ pedidoStatus: "aguardando_pagamento", expiraEm: PRAZO })).toBe(
      "aceitar",
    );
  });
});

describe("parseDataHoraAsaas", () => {
  it("interpreta o horário de Brasília dos eventos do Asaas", () => {
    expect(parseDataHoraAsaas("2026-09-15 14:03:22")?.toISOString()).toBe(
      "2026-09-15T17:03:22.000Z",
    );
  });

  it("ignora formatos desconhecidos", () => {
    expect(parseDataHoraAsaas("2026-09-15")).toBeNull();
    expect(parseDataHoraAsaas(undefined)).toBeNull();
  });
});
