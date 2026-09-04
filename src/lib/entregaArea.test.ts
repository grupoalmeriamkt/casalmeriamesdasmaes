import { describe, it, expect } from "vitest";
import { atendeAreaEntrega, atendeAreaEntregaFromTexto } from "./entregaArea";

describe("atendeAreaEntrega", () => {
  it("aceita Asa Sul / Asa Norte / Noroeste", () => {
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Asa Sul", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Asa Norte", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Noroeste", state: "DF" })).toBe(true);
  });

  it("aceita localidades do Plano Piloto", () => {
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Vila Planalto", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Setor Militar Urbano", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Esplanada dos Ministérios", state: "DF" })).toBe(true);
  });

  it("aceita Lago Sul, Lago Norte, Sudoeste e Cruzeiro", () => {
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Lago Sul", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Lago Norte", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Sudoeste", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Cruzeiro", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", neighborhood: "Cruzeiro Novo", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", street: "SHIS QI 17", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", street: "SQSW 304", state: "DF" })).toBe(true);
  });

  it("aceita logradouro SQS/SCLS mesmo sem bairro", () => {
    expect(atendeAreaEntrega({ city: "Brasília", street: "SCLS 104 Bloco D", state: "DF" })).toBe(true);
    expect(atendeAreaEntrega({ city: "Brasília", street: "SQN 212", state: "DF" })).toBe(true);
  });

  it("rejeita outras RAs e entorno", () => {
    expect(atendeAreaEntrega({ city: "Taguatinga", neighborhood: "Centro", state: "DF" })).toBe(false);
    expect(atendeAreaEntrega({ city: "Águas Claras", neighborhood: "Águas Claras", state: "DF" })).toBe(false);
    expect(atendeAreaEntrega({ city: "Valparaíso de Goiás", neighborhood: "Parque Esplanada", state: "GO" })).toBe(false);
  });
});

describe("atendeAreaEntregaFromTexto", () => {
  it("reconhece endereço montado do checkout", () => {
    expect(atendeAreaEntregaFromTexto("SCLS 104, Asa Sul, Brasília/DF")).toBe(true);
    expect(atendeAreaEntregaFromTexto("QNM 36, Taguatinga Norte, Taguatinga/DF")).toBe(false);
  });
});
