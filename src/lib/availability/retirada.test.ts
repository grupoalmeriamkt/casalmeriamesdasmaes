import { describe, expect, it } from "vitest";
import {
  REGRA_RETIRADA_PADRAO,
  dataRetiradaBloqueada,
  horarioRetiradaBloqueado,
} from "@/lib/availability/retirada";

const HOJE = "2026-06-29";
const AMANHA = "2026-06-30";
const DEPOIS = "2026-07-01";
const regra = REGRA_RETIRADA_PADRAO; // corte 17h, tarde a partir de 12h

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
  it("sem regra não bloqueia nada", () => {
    expect(dataRetiradaBloqueada(HOJE, HOJE, undefined)).toBe(false);
  });
});

describe("horarioRetiradaBloqueado (corte 17h)", () => {
  const ctx = (min: number) => ({ minutosAgoraSP: min, amanhaISO: AMANHA });

  it("pedido às 16h50 → manhã de amanhã liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", AMANHA, ctx(16 * 60 + 50), regra)).toBe(false);
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
  it("após o corte, janela da tarde (12h) de amanhã continua liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 12h e 14h", AMANHA, ctx(22 * 60), regra)).toBe(false);
  });
  it("corte só afeta o dia seguinte: depois de amanhã a manhã fica liberada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", DEPOIS, ctx(20 * 60), regra)).toBe(false);
  });
  it("sem regra não bloqueia nada", () => {
    expect(horarioRetiradaBloqueado("Entre 08h e 10h", AMANHA, ctx(22 * 60), undefined)).toBe(false);
  });
});
