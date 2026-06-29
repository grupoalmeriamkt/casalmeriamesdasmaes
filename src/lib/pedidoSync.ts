import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASAAS_FINAL_PAID,
  pagamentoRelevante,
  pedidoStatusFromPagamentos,
} from "@/lib/asaasStatus";
import { normalizePaymentStatus } from "@/lib/paymentStatus";
import { computeExecutionAt } from "@/lib/executionAt";

export type PaymentPatch = {
  payment_status_raw: string;
  payment_status_normalized: string;
  payment_confirmed_at?: string | null;
  status: string;
  pagamento: Record<string, unknown>;
  conciliacao_pendente?: boolean;
};

export function buildPaymentPatch(
  pagamentos: { status: string; criado_em: string; asaas_payment_id?: string; id?: string }[],
  pedidoStatus: string,
  existingPag: Record<string, unknown>,
  confirmedAt?: string | null,
): PaymentPatch {
  const rel = pagamentoRelevante(pagamentos);
  const raw = rel?.status ?? String(existingPag.status ?? pedidoStatus);
  const novoStatus = pedidoStatusFromPagamentos(pagamentos, pedidoStatus);
  const normalized = normalizePaymentStatus(raw, novoStatus);

  const pagamentoPatch = rel
    ? {
        status: rel.status,
        asaas_payment_id: rel.asaas_payment_id,
        pagamento_id: rel.id,
      }
    : {};

  let paymentConfirmedAt = confirmedAt ?? null;
  if (ASAAS_FINAL_PAID.has(raw) && !paymentConfirmedAt) {
    paymentConfirmedAt = rel?.criado_em ?? new Date().toISOString();
  }

  return {
    payment_status_raw: raw,
    payment_status_normalized: normalized,
    payment_confirmed_at: paymentConfirmedAt,
    status: novoStatus,
    pagamento: { ...existingPag, ...pagamentoPatch, status: raw },
    conciliacao_pendente: false,
  };
}

export async function syncPedidoPaymentFields(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<boolean> {
  const [{ data: pagamentos }, { data: pedido }] = await Promise.all([
    admin
      .from("pagamentos")
      .select("id, asaas_payment_id, status, criado_em")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false }),
    admin
      .from("pedidos")
      .select("status, pagamento, payment_confirmed_at, data_entrega, horario")
      .eq("id", pedidoId)
      .maybeSingle(),
  ]);

  if (!pedido || pedido.status === "cancelado") return false;

  const existingPag = (pedido.pagamento as Record<string, unknown>) ?? {};
  const patch = buildPaymentPatch(
    pagamentos ?? [],
    pedido.status,
    existingPag,
    pedido.payment_confirmed_at,
  );

  const executionAt = computeExecutionAt(
    pedido.data_entrega as string | null,
    pedido.horario as string | null,
  );

  const { error } = await admin
    .from("pedidos")
    .update({
      ...patch,
      execution_at: executionAt,
    })
    .eq("id", pedidoId);

  if (error) {
    console.error("[syncPedidoPaymentFields]", pedidoId, error);
    return false;
  }
  return true;
}

export async function registrarConciliacaoEvento(
  admin: SupabaseClient,
  pedidoId: string,
  tipo: string,
  detalhe: Record<string, unknown>,
  pagamentoId?: string,
) {
  await admin.from("conciliacao_eventos").insert({
    pedido_id: pedidoId,
    pagamento_id: pagamentoId ?? null,
    tipo,
    detalhe,
  });
}

export async function marcarConciliacaoPendente(
  admin: SupabaseClient,
  pedidoId: string,
  motivo: string,
  detalhe: Record<string, unknown> = {},
) {
  await admin
    .from("pedidos")
    .update({ conciliacao_pendente: true })
    .eq("id", pedidoId);
  await registrarConciliacaoEvento(admin, pedidoId, "pendencia", { motivo, ...detalhe });
}
