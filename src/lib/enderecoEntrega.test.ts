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

  it("é idempotente quando sempre composto a partir do endereço bruto (uso correto)", () => {
    // Uso correto: montarEnderecoFinal deve SEMPRE ser chamado a partir do endereço
    // bruto (state.enderecoOuUnidade original), nunca a partir de um resultado
    // anterior. Compor duas vezes a partir da mesma base bruta produz sempre o
    // mesmo resultado, mesmo que o usuário navegue entrega -> revisão -> voltar
    // -> avançar múltiplas vezes.
    const enderecoBruto = "Rua X, 100 — Centro";
    const params = { endereco: enderecoBruto, tipoLocal: "apartamento" as const, numeroUnidade: "302" };
    const primeiraComposicao = montarEnderecoFinal(params);
    const segundaComposicao = montarEnderecoFinal(params);
    expect(segundaComposicao).toBe(primeiraComposicao);
    expect(segundaComposicao).toBe("Rua X, 100 — Centro, Ap 302");
  });

  it("NÃO deve ser aplicado sobre um resultado já composto (uso incorreto, documentado)", () => {
    // Isto documenta o bug corrigido: se por engano montarEnderecoFinal for
    // aplicado sobre uma saída anterior (em vez do endereço bruto), o sufixo é
    // duplicado. A correção garante que o app SEMPRE compõe a partir do estado
    // bruto (state.enderecoOuUnidade), então este cenário não deve mais ocorrer
    // em produção — mas o comportamento da função em si permanece este.
    const jaComposto = montarEnderecoFinal({
      endereco: "Rua X, 100 — Centro",
      tipoLocal: "apartamento",
      numeroUnidade: "302",
    });
    const duploErrado = montarEnderecoFinal({
      endereco: jaComposto,
      tipoLocal: "apartamento",
      numeroUnidade: "302",
    });
    expect(duploErrado).toBe("Rua X, 100 — Centro, Ap 302, Ap 302");
    expect(duploErrado).not.toBe(jaComposto);
  });
});
