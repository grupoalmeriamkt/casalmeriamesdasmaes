import type { FalhaPagamento } from "@/lib/pagamentoFalha";

// RECEIVED_IN_CASH: baixa manual no Asaas ("Confirmar recebimento em dinheiro"),
// usada quando o cliente paga por fora do QR dinâmico. Conta como pago.
export const ASAAS_FINAL_PAID = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);
export const ASAAS_FINAL_FAILED = new Set([
  "REFUNDED",
  "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "PAYMENT_DELETED",
]);
export const ASAAS_FINAL_DONE = new Set([
  ...ASAAS_FINAL_PAID,
  ...ASAAS_FINAL_FAILED,
  "OVERDUE",
]);

export type PagamentoLike = {
  id?: string;
  asaas_payment_id?: string;
  status: string;
  criado_em: string;
};

const STATUS_PRIORITY: Record<string, number> = {
  CONFIRMED: 100,
  RECEIVED: 100,
  RECEIVED_IN_CASH: 100,
  PENDING: 20,
  AWAITING_RISK_ANALYSIS: 15,
  OVERDUE: 10,
  REFUND_REQUESTED: 5,
  REFUNDED: 1,
  PAYMENT_DELETED: 1,
};

/** Escolhe o pagamento mais relevante: pago tem prioridade sobre tentativas pendentes mais novas. */
export function pagamentoRelevante<T extends PagamentoLike>(lista: T[]): T | undefined {
  if (lista.length === 0) return undefined;
  return [...lista].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 0;
    const pb = STATUS_PRIORITY[b.status] ?? 0;
    if (pb !== pa) return pb - pa;
    return b.criado_em.localeCompare(a.criado_em);
  })[0];
}

export function pedidoStatusFromAsaas(status: string): string {
  if (ASAAS_FINAL_PAID.has(status)) return "pago";
  if (status === "OVERDUE") return "vencido";
  if (ASAAS_FINAL_FAILED.has(status)) return "cancelado";
  return "aguardando_pagamento";
}

export function pedidoStatusFromPagamentos(
  pagamentos: PagamentoLike[],
  pedidoStatus?: string,
): string {
  if (pedidoStatus === "cancelado") return "cancelado";
  const rel = pagamentoRelevante(pagamentos);
  if (rel) return pedidoStatusFromAsaas(rel.status);
  return pedidoStatus ?? "aguardando_pagamento";
}

export const ASAAS_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Pago",
  RECEIVED: "Recebido",
  RECEIVED_IN_CASH: "Recebido (baixa manual)",
  PENDING: "Aguardando pagamento",
  OVERDUE: "Vencido",
  REFUNDED: "Estornado",
  REFUND_REQUESTED: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Chargeback",
  CHARGEBACK_DISPUTE: "Chargeback",
  PAYMENT_DELETED: "Cancelado",
  AWAITING_RISK_ANALYSIS: "Em análise",
  pago: "Pago",
  credit_card: "Cartão de crédito",
  CREDIT_CARD: "Cartão de crédito",
  pix: "PIX",
  PIX: "PIX",
  boleto: "Boleto",
  BOLETO: "Boleto",
  aguardando_pagamento: "Aguardando pagamento",
  vencido: "Vencido",
  cancelado: "Cancelado",
  aprovado: "Aprovado",
  pendente: "Aguardando pagamento",
  rascunho: "Em preenchimento",
  abandonado: "Abandonado",
};

export const TIPO_PEDIDO_LABEL: Record<string, string> = {
  delivery: "Entrega",
  retirada: "Retirada",
};

export function labelStatusPagamento(status?: string): string {
  if (!status) return "—";
  return ASAAS_STATUS_LABEL[status] ?? ASAAS_STATUS_LABEL[status.toLowerCase()] ?? status;
}

export type PagamentoDetalheInput = {
  status?: string | null;
  metodo?: string | null;
  pixExpiraEm?: string | null;
  pedidoStatus?: string | null;
  falhaPagamento?: FalhaPagamento | null;
  /** Apenas para testes — fixa o "agora" ao comparar expiração do PIX. */
  now?: Date;
};

function normalizarMetodo(metodo?: string | null): string {
  return (metodo ?? "").trim().toUpperCase();
}

function pixExpirado(pixExpiraEm: string, now: Date): boolean {
  const exp = new Date(pixExpiraEm);
  return !Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime();
}

function formatPixExpiraEm(pixExpiraEm: string): string {
  const exp = new Date(pixExpiraEm);
  if (Number.isNaN(exp.getTime())) return "";
  return exp.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Label operacional mais descritivo para pedidos aguardando pagamento. */
export function labelPagamentoDetalhado(input: PagamentoDetalheInput): string {
  const now = input.now ?? new Date();
  const status = (input.status ?? "").trim().toUpperCase();
  const pedidoStatus = (input.pedidoStatus ?? "").trim().toLowerCase();
  const metodo = normalizarMetodo(input.metodo);

  if (pedidoStatus === "cancelado") return "Cancelado";
  if (ASAAS_FINAL_PAID.has(status) || pedidoStatus === "pago") {
    return labelStatusPagamento(status || "pago");
  }
  if (ASAAS_FINAL_FAILED.has(status)) return labelStatusPagamento(status);

  if (status === "OVERDUE" || pedidoStatus === "vencido") {
    if (metodo === "PIX") return "PIX expirado — não pago";
    if (metodo === "BOLETO") return "Boleto vencido — não pago";
    return "Cobrança vencida";
  }

  if (status === "AWAITING_RISK_ANALYSIS") {
    if (metodo === "CREDIT_CARD") return "Cartão em análise antifraude";
    return "Pagamento em análise de risco";
  }

  const aguardando =
    status === "PENDING" ||
    pedidoStatus === "aguardando_pagamento" ||
    !status;

  if (aguardando) {
    if (metodo === "PIX") {
      if (input.pixExpiraEm) {
        if (pixExpirado(input.pixExpiraEm, now)) return "PIX expirado — não pago";
        const expira = formatPixExpiraEm(input.pixExpiraEm);
        if (expira) return `PIX gerado — aguardando pagamento (expira ${expira})`;
      }
      return input.pixExpiraEm || status === "PENDING"
        ? "PIX gerado — aguardando pagamento"
        : "PIX selecionado — QR Code ainda não gerado";
    }
    if (metodo === "CREDIT_CARD") {
      const falha = input.falhaPagamento;
      if (falha?.motivo && normalizarMetodo(falha.metodo) === "CREDIT_CARD") {
        return `Cartão recusado — ${falha.motivo}`;
      }
      return status === "PENDING"
        ? "Cartão — aguardando confirmação"
        : "Cartão selecionado — pagamento não concluído";
    }
    if (metodo === "BOLETO") return "Boleto gerado — aguardando pagamento";
    return "Aguardando pagamento";
  }

  return labelStatusPagamento(status || input.status || pedidoStatus);
}

export function labelTipoPedido(tipo?: string): string {
  if (!tipo) return "—";
  return TIPO_PEDIDO_LABEL[tipo] ?? tipo;
}
