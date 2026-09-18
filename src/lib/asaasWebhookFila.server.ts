import type { AsaasClient } from "@/integrations/asaas/client.server";
import { sendEmail } from "@/lib/email";
import { OPS_EMAILS } from "@/lib/opsNotify.server";
import { emailFilaInterrompida, webhooksInterrompidos } from "@/lib/asaasWebhookFila";

/**
 * Confere a fila de webhooks no Asaas e avisa a operação por e-mail se ela estiver
 * pausada: sem ela, pagamentos novos só dão baixa pela conciliação.
 */
export async function alertarSeFilaWebhookInterrompida(
  asaas: AsaasClient,
): Promise<{ interrompidos: string[]; avisado: boolean } | { erro: string }> {
  try {
    const interrompidos = webhooksInterrompidos(await asaas.listWebhooks());
    if (interrompidos.length === 0) return { interrompidos: [], avisado: false };

    const email = emailFilaInterrompida(interrompidos);
    const res = await sendEmail({ to: OPS_EMAILS, ...email });
    if (!res.ok) console.error("[asaasWebhookFila] falha ao avisar a operação", res.error);
    return { interrompidos: interrompidos.map((w) => w.name || w.url), avisado: res.ok };
  } catch (e) {
    console.error("[asaasWebhookFila] erro ao consultar webhooks do Asaas", e);
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
