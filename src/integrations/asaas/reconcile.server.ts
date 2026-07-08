import type { SupabaseClient } from "@supabase/supabase-js";
import { makeAsaasClient } from "./client.server";
import {
  ASAAS_FINAL_DONE,
  ASAAS_FINAL_PAID,
  pagamentoRelevante,
} from "@/lib/asaasStatus";
import { isPagamentoAprovado, normalizePaymentStatus } from "@/lib/paymentStatus";
import {
  marcarConciliacaoPendente,
  registrarConciliacaoEvento,
  syncPedidoPaymentFields,
} from "@/lib/pedidoSync";

export type ConciliacaoResultado = {
  pagamentosVerificados: number;
  pagamentosAtualizados: number;
  pedidosAtualizados: number;
  pendenciasCriadas: number;
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

async function reavaliarPedido(
  admin: SupabaseClient,
  pedidoId: string,
  resultado: ConciliacaoResultado,
): Promise<void> {
  const ok = await syncPedidoPaymentFields(admin, pedidoId);
  if (ok) resultado.pedidosAtualizados += 1;

  const [{ data: pagamentos }, { data: pedido }] = await Promise.all([
    admin
      .from("pagamentos")
      .select("id, asaas_payment_id, status, criado_em")
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: false }),
    admin
      .from("pedidos")
      .select("status, payment_status_normalized, conciliacao_pendente")
      .eq("id", pedidoId)
      .maybeSingle(),
  ]);

  if (!pedido) return;
  const rel = pagamentoRelevante(pagamentos ?? []);
  const asaasPago = rel && ASAAS_FINAL_PAID.has(rel.status);
  const localAprovado = isPagamentoAprovado(
    rel?.status,
    pedido.payment_status_normalized ?? pedido.status,
  );

  if (asaasPago && !localAprovado) {
    await marcarConciliacaoPendente(admin, pedidoId, "pagamento_confirmado_status_local_divergente", {
      asaas_status: rel?.status,
      local_status: pedido.payment_status_normalized ?? pedido.status,
    });
    resultado.pendenciasCriadas += 1;
  } else if (pedido.conciliacao_pendente && localAprovado) {
    await admin.from("pedidos").update({ conciliacao_pendente: false }).eq("id", pedidoId);
    await registrarConciliacaoEvento(admin, pedidoId, "pendencia_resolvida", {});
  }
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
    pendenciasCriadas: 0,
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

  const [{ data: pedidosComPendencia }, { data: pedidosAguardando }, { data: pedidosDivergentes }] =
    await Promise.all([
      admin
        .from("pagamentos")
        .select("pedido_id")
        .in("status", ["PENDING", "AWAITING_RISK_ANALYSIS"])
        .not("asaas_payment_id", "is", null),
      admin.from("pedidos").select("id").eq("status", "aguardando_pagamento"),
      admin
        .from("pedidos")
        .select("id")
        .eq("conciliacao_pendente", true),
    ]);

  for (const p of pedidosComPendencia ?? []) {
    if (p.pedido_id) pedidosAfetados.add(p.pedido_id as string);
  }
  for (const p of pedidosAguardando ?? []) {
    if (p.id) pedidosAfetados.add(p.id as string);
  }
  for (const p of pedidosDivergentes ?? []) {
    if (p.id) pedidosAfetados.add(p.id as string);
  }

  // Pedidos com pagamento pago no banco mas status local não aprovado
  const { data: pagosConfirmados } = await admin
    .from("pagamentos")
    .select("pedido_id, status")
    .in("status", [...ASAAS_FINAL_PAID]);

  for (const pg of pagosConfirmados ?? []) {
    if (pg.pedido_id) pedidosAfetados.add(pg.pedido_id as string);
  }

  for (const pedidoId of pedidosAfetados) {
    await reavaliarPedido(admin, pedidoId, resultado);
  }

  return resultado;
}

export async function detectarDivergenciasPagamento(
  admin: SupabaseClient,
): Promise<number> {
  const { data: pedidos } = await admin
    .from("pedidos")
    .select("id, status, payment_status_normalized")
    .neq("status", "cancelado")
    .limit(500);

  let count = 0;
  for (const pedido of pedidos ?? []) {
    const { data: pagamentos } = await admin
      .from("pagamentos")
      .select("status, criado_em")
      .eq("pedido_id", pedido.id);
    const rel = pagamentoRelevante(pagamentos ?? []);
    if (!rel || !ASAAS_FINAL_PAID.has(rel.status)) continue;
    const normalized = normalizePaymentStatus(
      rel.status,
      pedido.payment_status_normalized ?? pedido.status,
    );
    if (!isPagamentoAprovado(rel.status, normalized)) {
      await marcarConciliacaoPendente(admin, pedido.id, "divergencia_detectada", {
        asaas_status: rel.status,
        normalized,
      });
      count += 1;
    }
  }
  return count;
}
