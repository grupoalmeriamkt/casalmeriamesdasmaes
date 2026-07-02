import { describe, it, expect } from "vitest";
import { mapBillingTypeToMetodo } from "./asaasBillingType";

describe("mapBillingTypeToMetodo", () => {
  it("mapeia tipos concretos", () => {
    expect(mapBillingTypeToMetodo("PIX")).toBe("PIX");
    expect(mapBillingTypeToMetodo("CREDIT_CARD")).toBe("CREDIT_CARD");
    expect(mapBillingTypeToMetodo("BOLETO")).toBe("BOLETO");
  });
  it("retorna null para UNDEFINED/desconhecido/vazio", () => {
    expect(mapBillingTypeToMetodo("UNDEFINED")).toBeNull();
    expect(mapBillingTypeToMetodo(undefined)).toBeNull();
    expect(mapBillingTypeToMetodo(null)).toBeNull();
    expect(mapBillingTypeToMetodo("FOO")).toBeNull();
  });
});
