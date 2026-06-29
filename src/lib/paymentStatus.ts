import { ASAAS_FINAL_FAILED, ASAAS_FINAL_PAID } from "@/lib/asaasStatus";

export type PaymentStatusNormalized =
  | "aprovado"
  | "aguardando"
  | "vencido"
  | "cancelado"
  | "rascunho"
  | "abandonado";

export function normalizePaymentStatus(
  rawStatus: string | null | undefined,
  pedidoStatus?: string | null,
): PaymentStatusNormalized {
  if (pedidoStatus === "cancelado") return "cancelado";
  if (pedidoStatus === "rascunho") return "rascunho";
  if (pedidoStatus === "abandonado") return "abandonado";

  const s = (rawStatus ?? pedidoStatus ?? "").toUpperCase();
  if (ASAAS_FINAL_PAID.has(s) || pedidoStatus === "pago") return "aprovado";
  if (s === "OVERDUE" || pedidoStatus === "vencido") return "vencido";
  if (ASAAS_FINAL_FAILED.has(s)) return "cancelado";
  if (
    s === "PENDING" ||
    s === "AWAITING_RISK_ANALYSIS" ||
    pedidoStatus === "aguardando_pagamento"
  ) {
    return "aguardando";
  }
  if (pedidoStatus === "pago") return "aprovado";
  return "aguardando";
}

export function isPagamentoAprovado(
  rawStatus: string | null | undefined,
  pedidoStatus?: string | null,
): boolean {
  return normalizePaymentStatus(rawStatus, pedidoStatus) === "aprovado";
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusNormalized, string> = {
  aprovado: "Aprovado",
  aguardando: "Aguardando pagamento",
  vencido: "Vencido",
  cancelado: "Cancelado",
  rascunho: "Em preenchimento",
  abandonado: "Abandonado",
};
