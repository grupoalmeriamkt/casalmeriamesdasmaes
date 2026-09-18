import { describe, expect, it } from "vitest";
import { emailFilaInterrompida, webhooksInterrompidos } from "./asaasWebhookFila";

const base = { url: "https://vendas.grupoalmeria.com.br/api/public/asaas/webhook" };

describe("webhooksInterrompidos", () => {
  it("devolve só os ativos com a fila interrompida", () => {
    const lista = [
      { ...base, id: "1", name: "Pausado", enabled: true, interrupted: true },
      { ...base, id: "2", name: "Normal", enabled: true, interrupted: false },
      { ...base, id: "3", name: "Desligado", enabled: false, interrupted: true },
    ];
    expect(webhooksInterrompidos(lista).map((w) => w.id)).toEqual(["1"]);
  });

  it("lista vazia quando nada está pausado", () => {
    expect(webhooksInterrompidos([])).toEqual([]);
  });
});

describe("emailFilaInterrompida", () => {
  it("cita o webhook e explica como reativar", () => {
    const email = emailFilaInterrompida([
      { ...base, id: "1", name: "Casa Almeria - Vendas", enabled: true, interrupted: true },
    ]);
    expect(email.subject).toContain("Asaas");
    expect(email.text).toContain('"Casa Almeria - Vendas"');
    expect(email.text).toContain("Integrações → Webhooks");
    expect(email.html).toContain("<ol>");
  });

  it("usa a URL quando o webhook não tem nome e escapa HTML", () => {
    const email = emailFilaInterrompida([
      { id: "1", name: "<b>x</b>", url: "https://a", enabled: true, interrupted: true },
      { id: "2", url: "https://b", enabled: true, interrupted: true },
    ]);
    expect(email.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(email.html).not.toContain("<b>x</b>");
    expect(email.text).toContain('"https://b"');
  });
});
