import type { AsaasWebhookConfig } from "@/integrations/asaas/types";

/** Webhooks ativos que o Asaas pausou depois de falhas seguidas (fila interrompida). */
export function webhooksInterrompidos(webhooks: AsaasWebhookConfig[]): AsaasWebhookConfig[] {
  return webhooks.filter((w) => w.enabled && w.interrupted);
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** E-mail para a operação quando a fila de webhooks do Asaas está pausada. */
export function emailFilaInterrompida(webhooks: AsaasWebhookConfig[]): {
  subject: string;
  html: string;
  text: string;
} {
  const nomes = webhooks.map((w) => w.name || w.url);
  const lista = nomes.map((n) => `"${n}"`).join(", ");
  const subject = "Atenção: o Asaas pausou os avisos de pagamento do site";
  const passos = [
    `No Asaas, abra Integrações → Webhooks e reative a fila ${lista}.`,
    "Os avisos que ficaram na fila são reenviados sozinhos depois da reativação.",
    "Se o site estiver fora do ar, resolva isso antes: com o site falhando, o Asaas pausa a fila de novo.",
  ];
  const intro = `O Asaas interrompeu a fila de webhooks ${lista}. Enquanto ela estiver pausada, pagamentos novos não dão baixa sozinhos nos pedidos do site.`;
  const rodape = "Este aviso sai na conferência diária até a fila voltar ao normal.";

  const text = [
    intro,
    "",
    "O que fazer:",
    ...passos.map((p, i) => `${i + 1}. ${p}`),
    "",
    rodape,
  ].join("\n");
  const html = [
    `<p>${escaparHtml(intro)}</p>`,
    "<p><strong>O que fazer:</strong></p>",
    `<ol>${passos.map((p) => `<li>${escaparHtml(p)}</li>`).join("")}</ol>`,
    `<p style="color:#666">${escaparHtml(rodape)}</p>`,
  ].join("\n");

  return { subject, html, text };
}
