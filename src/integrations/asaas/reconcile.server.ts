import type { SupabaseClient } from "@supabase/supabase-js";
import { makeAsaasClient } from "./client.server";
import {
  ASAAS_FINAL_DONE,
  pagamentoRelevante,
  pedidoStatusFromPagamentos,
} from "@/lib/asaasStatus";

export type ConciliacaoResultado = {
  pagamentosVerificados: number;
  pagamentosAtualizados: number;
  pedidosAtualizados: number;
  detalhes: {
    pagamentoId: string;
    pedidoId: string;
    asaasPaymentId: string;
    statusAnterior: string;
    statusNovo: string;
  }[];
  erros: { pagamentoId: string; asaasPaymentId: string; erro: string }[];
};

type PagamentoRow = {
  id: string;
  pedido_id: string;
  asaas_payment_id: string;
  status: string;
  cupom_codigo: string | null;
};

async function atualizarPedidoAposConciliacao(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<boolean> {
  const [{ data: pagamentos }, { data: pedido }] = await Promise.all([
    admin
      .from("pagamentos")
      .select("id, asaas_payment_id, status, criado_em")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false }),
    admin.from("pedidos").select("status, pagamento").eq("id", pedidoId).maybeSingle(),
  ]);

  if (!pedido || pedido.status === "cancelado") return false;

  const rel = pagamentoRelevante(pagamentos ?? []);
  const novoStatus = pedidoStatusFromPagamentos(pagamentos ?? [], pedido.status);
  const existingPag = (pedido.pagamento as Record<string, unknown>) ?? {};

  const pagamentoPatch = rel
    ? {
        status: rel.status,
        asaas_payment_id: rel.asaas_payment_id,
        pagamento_id: rel.id,
      }
    : {};

  const precisaAtualizar =
    pedido.status !== novoStatus ||
    (rel && existingPag.status !== rel.status) ||
    (rel && existingPag.asaas_payment_id !== rel.asaas_payment_id);

  if (!precisaAtualizar) return false;

  const { error } = await admin
    .from("pedidos")
    .update({
      status: novoStatus,
      pagamento: { ...existingPag, ...pagamentoPatch },
    })
    .eq("id", pedidoId);

  if (error) {
    console.error("[conciliar-asaas] update pedido", pedidoId, error);
    return false;
  }
  return true;
}

export async function conciliarPagamentosAsaas(
  admin: SupabaseClient,
  asaasApiKey: string,
): Promise<ConciliacaoResultado> {
  const asaas = makeAsaasClient(asaasApiKey);
  const resultado: ConciliacaoResultado = {
    pagamentosVerificados: 0,
    pagamentosAtualizados: 0,
    pedidosAtualizados: 0,
    detalhes: [],
    erros: [],
  };

  const { data: rows, error } = await admin
    .from("pagamentos")
    .select("id, pedido_id, asaas_payment_id, status, cupom_codigo")
    .not("asaas_payment_id", "is", null)
    .order("criado_em", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar pagamentos: ${error.message}`);
  }

  const pedidosAfetados = new Set<string>();

  for (const row of (rows ?? []) as PagamentoRow[]) {
    if (!row.asaas_payment_id) continue;
    if (ASAAS_FINAL_DONE.has(row.status)) continue;

    resultado.pagamentosVerificados += 1;

    try {
      const asaasPayment = await asaas.getPayment(row.asaas_payment_id);
      if (asaasPayment.status === row.status) continue;

      const { error: updErr } = await admin
        .from("pagamentos")
        .update({
          status: asaasPayment.status,
          raw_response: asaasPayment as unknown as Record<string, unknown>,
        })
        .eq("id", row.id);

      if (updErr) {
        resultado.erros.push({
          pagamentoId: row.id,
          asaasPaymentId: row.asaas_payment_id,
          erro: updErr.message,
        });
        continue;
      }

      resultado.pagamentosAtualizados += 1;
      resultado.detalhes.push({
        pagamentoId: row.id,
        pedidoId: row.pedido_id,
        asaasPaymentId: row.asaas_payment_id,
        statusAnterior: row.status,
        statusNovo: asaasPayment.status,
      });
      pedidosAfetados.add(row.pedido_id);
    } catch (e) {
      resultado.erros.push({
        pagamentoId: row.id,
        asaasPaymentId: row.asaas_payment_id,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Reavalia pedidos com pendência no Asaas ou status local desatualizado.
  const [{ data: pedidosComPendencia }, { data: pedidosAguardando }] = await Promise.all([
    admin
      .from("pagamentos")
      .select("pedido_id")
      .in("status", ["PENDING", "AWAITING_RISK_ANALYSIS"])
      .not("asaas_payment_id", "is", null),
    admin.from("pedidos").select("id").eq("status", "aguardando_pagamento"),
  ]);

  for (const p of pedidosComPendencia ?? []) {
    if (p.pedido_id) pedidosAfetados.add(p.pedido_id as string);
  }
  for (const p of pedidosAguardando ?? []) {
    if (p.id) pedidosAfetados.add(p.id as string);
  }

  for (const pedidoId of pedidosAfetados) {
    const ok = await atualizarPedidoAposConciliacao(admin, pedidoId);
    if (ok) resultado.pedidosAtualizados += 1;
  }

  return resultado;
}
