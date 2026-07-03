import { describe, it, expect } from "vitest";
import { montarEnderecoFinal } from "./enderecoEntrega";

describe("montarEnderecoFinal", () => {
  it("acrescenta Ap + número", () => {
    expect(montarEnderecoFinal({ endereco: "Rua X, 100 — Centro", tipoLocal: "apartamento", numeroUnidade: "302" }))
      .toBe("Rua X, 100 — Centro, Ap 302");
  });
  it("acrescenta Casa quando informado", () => {
    expect(montarEnderecoFinal({ endereco: "Rua Y, 5", tipoLocal: "casa", numeroUnidade: "5" }))
      .toBe("Rua Y, 5, Casa 5");
  });
  it("sem número não acrescenta sufixo", () => {
    expect(montarEnderecoFinal({ endereco: "Rua Z", tipoLocal: "casa", numeroUnidade: "" }))
      .toBe("Rua Z");
  });
});
