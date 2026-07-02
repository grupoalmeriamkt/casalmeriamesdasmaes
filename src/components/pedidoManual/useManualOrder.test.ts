import { describe, it, expect } from "vitest";
import { validarEtapa, estadoInicial, type ManualOrderState } from "./useManualOrder";
import type { Operator } from "@/lib/operators";

const opFake = { id: "1" } as Operator;

describe("validarEtapa", () => {
  it("bloqueia etapa operador sem operador", () => {
    expect(validarEtapa("operador", estadoInicial).length).toBeGreaterThan(0);
  });
  it("passa etapa operador com operador definido", () => {
    const s: ManualOrderState = { ...estadoInicial, operador: opFake };
    expect(validarEtapa("operador", s)).toEqual([]);
  });
  it("exige nome e whatsapp na etapa cliente", () => {
    const s: ManualOrderState = {
      ...estadoInicial, cliente: { nome: "Ab", whatsapp: "123", email: "", cpf: "" },
    };
    expect(validarEtapa("cliente", s).length).toBe(2);
  });
  it("exige unidade para retirada na etapa entrega", () => {
    const s: ManualOrderState = {
      ...estadoInicial, tipo: "retirada", unidadeId: null,
      data: "2026-07-10", horario: "Entre 12h e 17h",
    };
    expect(validarEtapa("entrega", s)).toContain("Selecione a unidade de retirada.");
  });
  it("exige data e horario na etapa entrega", () => {
    const s: ManualOrderState = {
      ...estadoInicial, tipo: "delivery", enderecoOuUnidade: "SQS 100",
      data: null, horario: null,
    };
    const erros = validarEtapa("entrega", s);
    expect(erros).toContain("Selecione a data.");
    expect(erros).toContain("Selecione o horario.");
  });
});
