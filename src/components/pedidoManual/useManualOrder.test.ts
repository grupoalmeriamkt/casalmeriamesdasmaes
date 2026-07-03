import { describe, it, expect } from "vitest";
import { validarEtapa, estadoInicial, type ManualOrderState } from "./useManualOrder";

describe("validarEtapa", () => {
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
