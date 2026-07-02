import { describe, it, expect } from "vitest";
import { buildPedidoManualPayload, calcularTotal } from "./buildPayload";
import type { ManualOrderInput } from "./types";

const input: ManualOrderInput = {
  cliente: { nome: "Maria Silva", whatsapp: "61999998888", email: "m@x.com", cpf: "12345678901" },
  itens: [
    { produto_id: "aconchego", produto_tipo: "cesta", nome: "Cesta Aconchego", preco: 255, quantidade: 2 },
    { produto_id: "travessa-morango", produto_tipo: "sobremesa", nome: "Travessa", preco: 65, quantidade: 1 },
  ],
  tipo: "retirada",
  enderecoOuUnidade: "Asa Sul",
  unidadeId: "asa-sul",
  data: "2026-07-10",
  horario: "Entre 12h e 17h",
};

describe("calcularTotal", () => {
  it("soma preco*quantidade", () => {
    expect(calcularTotal(input.itens)).toBe(255 * 2 + 65);
  });
});

describe("buildPedidoManualPayload", () => {
  it("marca origin manual e operador", () => {
    const p = buildPedidoManualPayload(input, "op-1");
    expect(p.origin).toBe("manual");
    expect(p.operator_id).toBe("op-1");
    expect(p.status).toBe("aguardando_pagamento");
  });
  it("separa cesta e sobremesas e soma total", () => {
    const p = buildPedidoManualPayload(input, null);
    expect(p.cesta?.nome).toBe("Cesta Aconchego");
    expect(p.sobremesas).toHaveLength(1);
    expect(p.total).toBe(575);
  });
  it("calcula execution_at a partir de data + horario", () => {
    const p = buildPedidoManualPayload(input, null);
    expect(p.execution_at).toBeTruthy();
  });
  it("normaliza cpf/email vazios para null", () => {
    const p = buildPedidoManualPayload(
      { ...input, cliente: { nome: "Ana Paula", whatsapp: "61988887777" } },
      null,
    );
    expect(p.cliente_cpf).toBeNull();
    expect(p.cliente_email).toBeNull();
  });
});
