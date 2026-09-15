// SERVIDOR APENAS — cobranças do Asaas de pedidos que não podem mais ser pagos.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsaasClient } from "@/integrations/asaas/client.server";
import { ASAAS_FINAL_PAID } from "@/lib/asaasStatus";
import { decidirAcaoCobranca } from "@/lib/cobrancaBloqueada";
import { marcarConciliacaoPendente } from "@/lib/pedidoSync";
import { expirarPedidoSeVencido } from "@/lib/prazoPagamento.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Contexto = {
  pedidoId: string;
  pedidoStatus: string | null;
  pedidoExcluido: boolean;
  expiraEm: string | null;
  jaPagoAntes: boolean;
  temPagamentoLocal: boolean;
};

/**
 * Localiza o pedido da cobrança: pelo registro em `pagamentos` ou, se o pedido foi
 * excluído (pagamentos saem em cascata), pelo externalReference em `pedidos_excluidos`.
 * Cobrança de outro sistema na mesma conta Asaas não é encontrada e fica intocada.
 */
async function carregarContexto(
  admin: SupabaseClient,
  payment: { id: string; externalReference?: string | null },
): Promise<Contexto | null> {
  const { data: pg } = await admin
    .from("pagamentos")
    .select("pedido_id, status")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  if (pg?.pedido_id) {
    const { data: pedido } = await admin
      .from("pedidos")
      .select("status, pagamento_expira_em")
      .eq("id", pg.pedido_id)
      .maybeSingle();
    if (!pedido) return null;
    return {
      pedidoId: pg.pedido_id as string,
      pedidoStatus: pedido.status as string,
      pedidoExcluido: false,
      expiraEm: (pedido.pagamento_expira_em as string | null) ?? null,
      jaPagoAntes: ASAAS_FINAL_PAID.has((pg.status as string) ?? ""),
      temPagamentoLocal: true,
    };
  }

  const ref = payment.externalReference?.trim();
  if (!ref || !UUID.test(ref)) return null;
  const { data: excluido } = await admin
    .from("pedidos_excluidos")
    .select("pedido_snapshot")
    .eq("pedido_id", ref)
    .order("excluido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!excluido) return null;

  const snapshot = (excluido.pedido_snapshot ?? {}) as {
    status?: string;
    pagamento?: { status?: string } | null;
  };
  return {
    pedidoId: ref,
    pedidoStatus: snapshot.status ?? null,
    pedidoExcluido: true,
    expiraEm: null,
    jaPagoAntes:
      snapshot.status === "pago" || ASAAS_FINAL_PAID.has(snapshot.pagamento?.status ?? ""),
    temPagamentoLocal: false,
  };
}

async function registrarEvento(
  admin: SupabaseClient,
  ctx: Contexto,
  tipo: string,
  detalhe: Record<string, unknown>,
) {
  // Pedido excluído não existe mais: o FK exige pedido_id nulo.
  await admin.from("conciliacao_eventos").insert({
    pedido_id: ctx.pedidoExcluido ? null : ctx.pedidoId,
    tipo,
    detalhe: { pedido_id: ctx.pedidoId, ...detalhe },
  });
}

/**
 * Chamado a cada evento de cobrança do webhook (inclusive "link aberto"). Se o pedido foi
 * excluído, cancelado ou passou do prazo, cancela a cobrança no Asaas antes do pagamento;
 * se o pagamento já entrou para pedido excluído/cancelado, estorna.
 * Retorna a ação tomada, ou null quando o evento segue o fluxo normal.
 */
export async function tratarCobrancaBloqueada(
  admin: SupabaseClient,
  asaas: AsaasClient | null,
  payment: { id: string; status: string; externalReference?: string | null },
): Promise<"cobranca_cancelada" | "estornado" | "pedido_expirado" | null> {
  if (!asaas) return null;
  const ctx = await carregarContexto(admin, payment);
  if (!ctx) return null;

  const acao = decidirAcaoCobranca({
    statusAsaas: payment.status,
    pedidoStatus: ctx.pedidoStatus,
    pedidoExcluido: ctx.pedidoExcluido,
    expiraEm: ctx.expiraEm,
    jaPagoAntes: ctx.jaPagoAntes,
  });
  const motivo = ctx.pedidoExcluido ? "excluido" : ctx.pedidoStatus;

  if (acao === "expirar_pedido") {
    const situacao = await expirarPedidoSeVencido(admin, asaas, ctx.pedidoId);
    return situacao?.expirado ? "pedido_expirado" : null;
  }

  if (acao === "cancelar_cobranca") {
    try {
      await asaas.deletePayment(payment.id);
    } catch (e) {
      console.error("[cobrancaBloqueada] cancelar cobrança", payment.id, e);
      return null;
    }
    if (ctx.temPagamentoLocal) {
      await admin
        .from("pagamentos")
        .update({ status: "PAYMENT_DELETED" })
        .eq("asaas_payment_id", payment.id);
    }
    await registrarEvento(admin, ctx, "cobranca_cancelada_pedido_encerrado", {
      asaas_payment_id: payment.id,
      motivo,
    });
    return "cobranca_cancelada";
  }

  if (acao === "estornar") {
    try {
      // Eventos repetidos (CONFIRMED e depois RECEIVED) não estornam duas vezes.
      const atual = await asaas.getPayment(payment.id);
      if (ASAAS_FINAL_PAID.has(atual.status)) await asaas.refundPayment(payment.id);
      await registrarEvento(admin, ctx, "pagamento_estornado_pedido_encerrado", {
        asaas_payment_id: payment.id,
        motivo,
      });
    } catch (e) {
      console.error("[cobrancaBloqueada] estorno falhou", payment.id, e);
      if (ctx.pedidoExcluido) {
        await registrarEvento(admin, ctx, "estorno_pedido_encerrado_falhou", {
          asaas_payment_id: payment.id,
          motivo,
          erro: String(e).slice(0, 300),
        });
      } else {
        await marcarConciliacaoPendente(admin, ctx.pedidoId, "estorno_pedido_cancelado_falhou", {
          asaas_payment_id: payment.id,
          erro: String(e).slice(0, 300),
        });
      }
    }
    return "estornado";
  }

  return null;
}
