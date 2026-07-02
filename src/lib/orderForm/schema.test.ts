import { describe, it, expect } from "vitest";
import { manualOrderSchema, cpfParaLinkSchema } from "./schema";

const base = {
  cliente: { nome: "Maria Silva", whatsapp: "61999998888" },
  itens: [
    { produto_id: "aconchego", produto_tipo: "cesta", nome: "Cesta", preco: 255, quantidade: 1 },
  ],
  tipo: "retirada",
  enderecoOuUnidade: "Asa Sul",
  unidadeId: "asa-sul",
};

describe("manualOrderSchema", () => {
  it("aceita um pedido de retirada valido", () => {
    expect(manualOrderSchema.safeParse(base).success).toBe(true);
  });
  it("rejeita pedido sem produtos", () => {
    expect(manualOrderSchema.safeParse({ ...base, itens: [] }).success).toBe(false);
  });
  it("exige unidadeId quando tipo e retirada", () => {
    expect(manualOrderSchema.safeParse({ ...base, unidadeId: null }).success).toBe(false);
  });
  it("nao exige unidadeId para delivery", () => {
    const r = manualOrderSchema.safeParse({
      ...base, tipo: "delivery", unidadeId: null, enderecoOuUnidade: "SQS 100",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita nome curto", () => {
    const r = manualOrderSchema.safeParse({
      ...base, cliente: { nome: "Ma", whatsapp: "61999998888" },
    });
    expect(r.success).toBe(false);
  });
});

describe("cpfParaLinkSchema", () => {
  it("aceita 11 digitos", () => {
    expect(cpfParaLinkSchema.safeParse("12345678901").success).toBe(true);
  });
  it("rejeita vazio", () => {
    expect(cpfParaLinkSchema.safeParse("").success).toBe(false);
  });
});
