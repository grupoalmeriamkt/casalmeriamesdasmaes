import type { SupabaseClient } from "@supabase/supabase-js";
import { makeAsaasClient, AsaasError } from "@/integrations/asaas/client.server";
import { getAppSecrets } from "@/integrations/supabase/client.server";
import { cobrancasPendentesCancelaveis } from "@/lib/asaasStatus";

type PagamentoCancelavel = {
  id: string;
  pedido_id: string;
  asaas_payment_id: string | null;
  status: string;
};

/**
 * Apaga no Asaas as cobranças ainda abertas dos pedidos (PIX/link/boleto).
 * Não mexe em pagamento já confirmado. Falha isolada não impede concluir.
 */
export async function cancelarCobrancasPendentesDosPedidos(
  admin: SupabaseClient,
  pedidoIds: string[],
): Promise<{ canceladas: number; erros: number }> {
  const resultado = { canceladas: 0, erros: 0 };
  if (pedidoIds.length === 0) return resultado;

  const { data: pagamentos, error } = await admin
    .from("pagamentos")
    .select("id, pedido_id, asaas_payment_id, status")
    .in("pedido_id", pedidoIds);
  if (error) {
    console.error("[cancelarCobrancasPendentes] listar pagamentos", error);
    return resultado;
  }

  const pendentes = cobrancasPendentesCancelaveis(
    (pagamentos ?? []) as PagamentoCancelavel[],
  );
  if (pendentes.length === 0) return resultado;

  const secrets = await getAppSecrets();
  if (!secrets.asaasApiKey) {
    console.warn("[cancelarCobrancasPendentes] Asaas não configurado; cobranças locais não foram apagadas");
    return resultado;
  }
  const asaas = makeAsaasClient(secrets.asaasApiKey);

  for (const pag of pendentes) {
    const asaasId = pag.asaas_payment_id;
    if (!asaasId) continue;
    try {
      await asaas.deletePayment(asaasId);
      const { error: updErr } = await admin
        .from("pagamentos")
        .update({ status: "PAYMENT_DELETED" })
        .eq("id", pag.id);
      if (updErr) {
        console.error("[cancelarCobrancasPendentes] update pagamento", pag.id, updErr);
        resultado.erros += 1;
        continue;
      }
      resultado.canceladas += 1;
    } catch (e) {
      if (e instanceof AsaasError && (e.status === 400 || e.status === 404)) {
        // Já paga, já excluída ou inexistente — segue.
        continue;
      }
      console.error("[cancelarCobrancasPendentes] Asaas", asaasId, e);
      resultado.erros += 1;
    }
  }

  return resultado;
}
