// SERVIDOR APENAS — cronômetro de pagamento (ver src/lib/prazoPagamento.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsaasClient } from "@/integrations/asaas/client.server";
import { ASAAS_FINAL_PAID, isCobrancaAsaasCancelavel } from "@/lib/asaasStatus";
import { marcarConciliacaoPendente, registrarConciliacaoEvento } from "@/lib/pedidoSync";
import {
  calcularPrazoPagamento,
  decidirConfirmacao,
  MSG_PRAZO_EXPIRADO,
  PEDIDO_EXPIRADO,
  prazoEsgotado,
} from "@/lib/prazoPagamento";

/** Pedido nesses status não tem mais cronômetro correndo. */
const STATUS_ENCERRADOS = new Set(["pago", "cancelado", PEDIDO_EXPIRADO]);

export type PrazoPedido = { status: string; expiraEm: string | null };
export type SituacaoPrazo = PrazoPedido & { expirado: boolean; pago: boolean };

export function prazoExpiradoResponse(): Response {
  return Response.json({ error: "expirado", motivo: MSG_PRAZO_EXPIRADO }, { status: 410 });
}

function situacao(p: PrazoPedido): SituacaoPrazo {
  return { ...p, expirado: p.status === PEDIDO_EXPIRADO, pago: p.status === "pago" };
}

export async function lerPrazoPedido(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<PrazoPedido | null> {
  const { data, error } = await admin
    .from("pedidos")
    .select("status, pagamento_expira_em")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) console.error("[prazoPagamento] ler", pedidoId, error);
  if (!data) return null;
  return {
    status: data.status as string,
    expiraEm: (data.pagamento_expira_em as string | null) ?? null,
  };
}

/** Grava o fim do prazo uma única vez por pedido; chamadas seguintes mantêm o prazo original. */
export async function iniciarPrazoPagamento(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<PrazoPedido | null> {
  const atual = await lerPrazoPedido(admin, pedidoId);
  if (!atual || atual.expiraEm || STATUS_ENCERRADOS.has(atual.status)) return atual;

  const { data, error } = await admin
    .from("pedidos")
    .update({ pagamento_expira_em: calcularPrazoPagamento() })
    .eq("id", pedidoId)
    .is("pagamento_expira_em", null)
    .select("status, pagamento_expira_em")
    .maybeSingle();
  if (error) console.error("[prazoPagamento] iniciar", pedidoId, error);
  // Outra requisição iniciou antes: vale o prazo que ela gravou.
  if (!data) return lerPrazoPedido(admin, pedidoId);
  return { status: data.status as string, expiraEm: data.pagamento_expira_em as string };
}

/** Cancela a cobrança no Asaas. Retorna true se ela já estava paga (e por isso não foi cancelada). */
async function cancelarCobrancaAberta(asaas: AsaasClient, paymentId: string): Promise<boolean> {
  try {
    const p = await asaas.getPayment(paymentId);
    if (ASAAS_FINAL_PAID.has(p.status)) return true;
    if (!isCobrancaAsaasCancelavel(p.status)) return false;
  } catch (e) {
    console.error("[prazoPagamento] getPayment", paymentId, e);
  }
  try {
    await asaas.deletePayment(paymentId);
    return false;
  } catch (e) {
    // A exclusão falha se a cobrança acabou de ser paga — confere antes de desistir.
    const p = await asaas.getPayment(paymentId).catch(() => null);
    if (p && ASAAS_FINAL_PAID.has(p.status)) return true;
    // Se ela for paga depois, o webhook estorna (pedido já expirado).
    console.error("[prazoPagamento] deletePayment", paymentId, e);
    return false;
  }
}

/**
 * Prazo vencido: cancela as cobranças abertas no Asaas (QR, copia-e-cola e link param de
 * funcionar) e marca o pedido como expirado. Cobrança que o Asaas já deu como paga não é
 * cancelada — o pedido segue para pago pelo webhook/polling.
 */
export async function expirarPedidoSeVencido(
  admin: SupabaseClient,
  asaas: AsaasClient | null,
  pedidoId: string,
  now: Date = new Date(),
): Promise<SituacaoPrazo | null> {
  const atual = await lerPrazoPedido(admin, pedidoId);
  if (!atual) return null;
  if (STATUS_ENCERRADOS.has(atual.status) || !prazoEsgotado(atual.expiraEm, now)) {
    return situacao(atual);
  }

  const { data: pagamentos } = await admin
    .from("pagamentos")
    .select("id, asaas_payment_id, status")
    .eq("pedido_id", pedidoId);
  const lista = (pagamentos ?? []) as {
    id: string;
    asaas_payment_id: string | null;
    status: string;
  }[];
  if (lista.some((p) => ASAAS_FINAL_PAID.has(p.status))) return { ...situacao(atual), pago: true };

  const abertas = lista.filter((p) => !!p.asaas_payment_id && isCobrancaAsaasCancelavel(p.status));
  if (asaas) {
    for (const pg of abertas) {
      if (await cancelarCobrancaAberta(asaas, pg.asaas_payment_id as string)) {
        return { ...situacao(atual), pago: true };
      }
      await admin.from("pagamentos").update({ status: "PAYMENT_DELETED" }).eq("id", pg.id);
    }
  }

  const { data: pedido } = await admin
    .from("pedidos")
    .select("pagamento")
    .eq("id", pedidoId)
    .maybeSingle();
  const { data: atualizado } = await admin
    .from("pedidos")
    .update({
      status: PEDIDO_EXPIRADO,
      payment_status_normalized: "cancelado",
      pagamento: {
        ...((pedido?.pagamento as Record<string, unknown>) ?? {}),
        expirado_em: now.toISOString(),
      },
    })
    .eq("id", pedidoId)
    .eq("status", atual.status)
    .select("id")
    .maybeSingle();
  if (!atualizado) {
    // O status mudou no meio do caminho (ex.: webhook marcou pago).
    const depois = await lerPrazoPedido(admin, pedidoId);
    return depois ? situacao(depois) : null;
  }

  await registrarConciliacaoEvento(admin, pedidoId, "prazo_pagamento_expirado", {
    expira_em: atual.expiraEm,
    cobrancas_canceladas: abertas.map((p) => p.asaas_payment_id),
  });
  return { status: PEDIDO_EXPIRADO, expiraEm: atual.expiraEm, expirado: true, pago: false };
}

/**
 * O prazo pode acabar enquanto a cobrança é criada no Asaas. Cobrança ainda não paga é
 * cancelada na hora e o pedido expira; cartão aprovado nesse limite segue (cabe na tolerância).
 */
export async function cobrancaCriadaForaDoPrazo(
  admin: SupabaseClient,
  asaas: AsaasClient,
  pedidoId: string,
  payment: { id: string; status: string },
): Promise<boolean> {
  if (ASAAS_FINAL_PAID.has(payment.status)) return false;
  const prazo = await lerPrazoPedido(admin, pedidoId);
  if (!prazo || (prazo.status !== PEDIDO_EXPIRADO && !prazoEsgotado(prazo.expiraEm))) {
    return false;
  }
  await asaas
    .deletePayment(payment.id)
    .catch((e) =>
      console.error("[prazoPagamento] cancelar cobrança criada fora do prazo", payment.id, e),
    );
  await expirarPedidoSeVencido(admin, asaas, pedidoId);
  return true;
}

/**
 * O Asaas confirmou um pagamento. Dentro do prazo (+ tolerância) ele vale; fora dele é
 * estornado automaticamente e o pedido fica expirado.
 */
export async function aplicarPrazoNaConfirmacao(
  admin: SupabaseClient,
  asaas: AsaasClient | null,
  pedidoId: string,
  asaasPaymentId: string,
  opts: { statusAsaas?: string; confirmadoEm?: Date | null } = {},
): Promise<"aceito" | "estornado"> {
  const atual = await lerPrazoPedido(admin, pedidoId);
  if (!atual) return "aceito";

  // Baixa manual no Asaas é decisão da equipe: nunca estorna.
  const decisao =
    opts.statusAsaas === "RECEIVED_IN_CASH"
      ? "aceitar"
      : decidirConfirmacao({
          pedidoStatus: atual.status,
          expiraEm: atual.expiraEm,
          confirmadoEm: opts.confirmadoEm,
        });

  if (decisao === "aceitar") {
    if (atual.status === PEDIDO_EXPIRADO) {
      // Expirou no limite, mas o pagamento entrou na tolerância: reabre para a
      // sincronização marcar como pago.
      await admin
        .from("pedidos")
        .update({ status: "aguardando_pagamento" })
        .eq("id", pedidoId)
        .eq("status", PEDIDO_EXPIRADO);
      await registrarConciliacaoEvento(admin, pedidoId, "pagamento_aceito_na_tolerancia", {
        asaas_payment_id: asaasPaymentId,
        expira_em: atual.expiraEm,
      });
    }
    return "aceito";
  }

  if (atual.status !== PEDIDO_EXPIRADO) {
    await admin
      .from("pedidos")
      .update({ status: PEDIDO_EXPIRADO, payment_status_normalized: "cancelado" })
      .eq("id", pedidoId);
  }
  if (!asaas) {
    await marcarConciliacaoPendente(admin, pedidoId, "estorno_fora_do_prazo_pendente", {
      asaas_payment_id: asaasPaymentId,
    });
    return "estornado";
  }
  try {
    // Eventos repetidos (CONFIRMED e depois RECEIVED) não podem estornar duas vezes.
    const p = await asaas.getPayment(asaasPaymentId);
    if (!ASAAS_FINAL_PAID.has(p.status)) return "estornado";
    await asaas.refundPayment(asaasPaymentId);
    await registrarConciliacaoEvento(admin, pedidoId, "pagamento_estornado_fora_do_prazo", {
      asaas_payment_id: asaasPaymentId,
      expira_em: atual.expiraEm,
      confirmado_em: opts.confirmadoEm?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("[prazoPagamento] estorno fora do prazo falhou", asaasPaymentId, e);
    await marcarConciliacaoPendente(admin, pedidoId, "estorno_fora_do_prazo_falhou", {
      asaas_payment_id: asaasPaymentId,
      erro: String(e).slice(0, 300),
    });
  }
  return "estornado";
}
