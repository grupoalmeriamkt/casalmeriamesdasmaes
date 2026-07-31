import { describe, expect, it } from "vitest";
import {
  REGRA_RETIRADA_PADRAO,
  dataRetiradaBloqueada,
  horarioRetiradaBloqueado,
} from "@/lib/availability/retirada";

const HOJE = "2026-06-29"; // segunda
const AMANHA = "2026-06-30";
const DEPOIS = "2026-07-01";
const regra = REGRA_RETIRADA_PADRAO; // corte 17h, tarde a partir de 14h

// Sexta 2026-07-31 → sábado 2026-08-01
const SEXTA = "2026-07-31";
const SABADO = "2026-08-01";

describe("dataRetiradaBloqueada", () => {
  it("bloqueia o mesmo dia", () => {
    expect(dataRetiradaBloqueada(HOJE, HOJE, regra)).toBe(true);
  });
  it("bloqueia data no passado", () => {
    expect(dataRetiradaBloqueada("2026-06-28", HOJE, regra)).toBe(true);
  });
  it("libera o dia seguinte", () => {
    expect(dataRetiradaBloqueada(AMANHA, HOJE, regra)).toBe(false);
  });

  it("sexta às 12h00 → sábado ainda liberado", () => {
    expect(
      dataRetiradaBloqueada(SABADO, SEXTA, regra, {
        minutosAgoraSP: 12 * 60,
        amanhaISO: SABADO,
      }),
    ).toBe(false);
  });

  it("sexta às 12h01 → sábado bloqueado", () => {
    expect(
      dataRetiradaBloqueada(SABADO, SEXTA, regra, {
        minutosAgoraSP: 12 * 60 + 1,
        amanhaISO: SABADO,
      }),
    ).toBe(true);
  });

  it("sexta à tarde → domingo (depois de amanhã) continua liberado", () => {
    expect(
      dataRetiradaBloqueada("2026-08-02", SEXTA, regra, {
        minutosAgoraSP: 15 * 60,
        amanhaISO: SABADO,
      }),
    ).toBe(false);
  });

  it("quinta à tarde → sexta seguinte não usa o corte de sábado", () => {
    expect(
      dataRetiradaBloqueada("2026-07-31", "2026-07-30", regra, {
        minutosAgoraSP: 18 * 60,
        amanhaISO: "2026-07-31",
      }),
    ).toBe(false);
  });
});

describe("horarioRetiradaBloqueado (corte 17h, tarde 14h)", () => {
  const ctx = (min: number) => ({ minutosAgoraSP: min, amanhaISO: AMANHA });

  it("pedido às 16h00 → manhã de amanhã liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", AMANHA, ctx(16 * 60), regra)).toBe(false);
  });
  it("pedido às 16h59 → manhã de amanhã liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", AMANHA, ctx(16 * 60 + 59), regra)).toBe(false);
  });
  it("pedido às 17h00 exatas → manhã de amanhã ainda liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 10h e 12h", AMANHA, ctx(17 * 60), regra)).toBe(false);
  });
  it("pedido às 17h01 → manhã de amanhã bloqueada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", AMANHA, ctx(17 * 60 + 1), regra)).toBe(true);
  });
  it("pedido às 20h → manhã de amanhã bloqueada", () => {
    expect(horarioRetiradaBloqueado("Entre 10h e 12h", AMANHA, ctx(20 * 60), regra)).toBe(true);
  });
  it("após o corte, janela antes das 14h de amanhã continua bloqueada", () => {
    expect(horarioRetiradaBloqueado("Entre 12h e 14h", AMANHA, ctx(22 * 60), regra)).toBe(true);
  });
  it("após o corte, janela a partir das 14h de amanhã continua liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 14h e 16h", AMANHA, ctx(22 * 60), regra)).toBe(false);
  });
  it("corte só afeta o dia seguinte: depois de amanhã a manhã fica liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", DEPOIS, ctx(20 * 60), regra)).toBe(false);
  });
});
