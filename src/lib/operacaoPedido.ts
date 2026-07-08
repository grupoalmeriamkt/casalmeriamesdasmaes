import type { PedidoRow } from "@/lib/pedidos";
import type { PedidoSalvo } from "@/store/admin";
import { pagamentoRelevante, labelPagamentoDetalhado } from "@/lib/asaasStatus";
import { parseFalhaPagamento } from "@/lib/pagamentoFalha";
import {
  normalizePaymentStatus,
  type PaymentStatusNormalized,
} from "@/lib/paymentStatus";
import { todayISOSP } from "@/lib/timezone";
import { prazoStatus } from "@/lib/pedidoPrazo";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import type { ProductionSector } from "@/lib/availability/types";
import type { FulfillmentStage } from "@/lib/etapaPedido";

export type PedidoOperacional = PedidoSalvo & {
  recipientName: string;
  recipientPhone: string;
  recipientIsBuyer: boolean;
  unidadeId?: string | null;
  productionSector?: SetorOperacional | null;
  executionAt?: string | null;
  paymentStatusRaw?: string | null;
  paymentStatusNormalized?: PaymentStatusNormalized;
  paymentConfirmedAt?: string | null;
  isTest: boolean;
  archivedAt?: string | null;
  concluidoAt: string | null;
  conciliacaoPendente: boolean;
  fulfillmentStage?: FulfillmentStage | null;
  fulfillmentStageAt?: string | null;
};

export function rowToPedidoOperacional(r: PedidoRow): PedidoOperacional {
  const rel = pagamentoRelevante(r.pagamentos ?? []);
  const falhaPagamento = parseFalhaPagamento(r.pagamento as Record<string, unknown>);
  const base = {
    id: r.id,
    criadoEm: r.criado_em,
    cliente: { nome: r.cliente_nome, whatsapp: r.cliente_whatsapp },
    destinatario: r.pagamento?.destinatario ?? null,
    cesta: r.cesta ?? undefined,
    sobremesas: r.sobremesas ?? [],
    tipo: r.tipo,
    enderecoOuUnidade: r.endereco_ou_unidade,
    data: r.data_entrega ?? undefined,
    horario: r.horario ?? undefined,
    pagamento: {
      ...r.pagamento,
      status: rel?.status ?? r.pagamento?.status ?? r.status ?? "",
      statusDetalhado: labelPagamentoDetalhado({
        status: rel?.status ?? r.pagamento?.status,
        metodo: rel?.metodo ?? r.pagamento?.metodo,
        pixExpiraEm: rel?.pix_expira_em,
        pedidoStatus: r.status,
        falhaPagamento,
      }),
    },
    total: Number(r.total),
  } satisfies PedidoSalvo;

  const raw = rel?.status ?? r.payment_status_raw ?? r.pagamento?.status ?? r.status;
  // Defesa em profundidade: recomputa sempre a partir do pagamento relevante + status
  // do pedido (fonte da verdade). Não confia numa coluna payment_status_normalized
  // desatualizada — assim um conserto manual incompleto não joga um pedido pago no
  // balde "Aguardando".
  const normalized = normalizePaymentStatus(raw, r.status);

  const recipientName =
    r.recipient_name ?? r.pagamento?.destinatario?.nome ?? r.cliente_nome;
  const recipientPhone =
    r.recipient_phone ?? r.pagamento?.destinatario?.whatsapp ?? r.cliente_whatsapp;

  return {
    ...base,
    destinatario:
      r.recipient_is_buyer === false && r.pagamento?.destinatario
        ? r.pagamento.destinatario
        : { nome: recipientName, whatsapp: recipientPhone },
    recipientName,
    recipientPhone,
    recipientIsBuyer: r.recipient_is_buyer ?? !r.pagamento?.destinatario,
    unidadeId: r.unidade_id ?? null,
    productionSector: (r.production_sector as SetorOperacional | null) ?? null,
    executionAt: r.execution_at ?? null,
    paymentStatusRaw: raw,
    paymentStatusNormalized: normalized,
    paymentConfirmedAt: r.payment_confirmed_at ?? null,
    isTest: r.is_test ?? false,
    archivedAt: r.archived_at ?? null,
    concluidoAt: r.concluido_at ?? null,
    conciliacaoPendente: r.conciliacao_pendente ?? false,
    fulfillmentStage: (r.fulfillment_stage as FulfillmentStage | null) ?? null,
    fulfillmentStageAt: r.fulfillment_stage_at ?? null,
  };
}

export type FiltrosOperacionais = {
  status?: PaymentStatusNormalized[];
  tipo?: "" | "delivery" | "retirada";
  setor?: SetorOperacional | "";
  unidadeId?: string;
  dataExecucao?: string;
  criadoInicio?: string;
  criadoFim?: string;
  busca?: string;
  mostrarArquivados?: boolean;
  verConcluidos?: boolean;
  mostrarTestes?: boolean;
  /** Exibe pedidos concluídos (finalizado ou arquivado), incluindo arquivados. */
  concluidos?: boolean;
  ordenacao?: "execution_asc" | "execution_desc" | "criado_desc" | "criado_asc";
  filtroPrazo?: string[];
  hojeIso?: string;
};

/** Pedido tratado como concluído: etapa finalizada ou arquivado (manual/auto). */
export function isPedidoConcluido(p: Pick<PedidoOperacional, "fulfillmentStage" | "archivedAt">): boolean {
  return p.fulfillmentStage === "finalizado" || !!p.archivedAt;
}

export function filtrarPedidosOperacionais(
  pedidos: PedidoOperacional[],
  f: FiltrosOperacionais,
): PedidoOperacional[] {
  let list = [...pedidos];

  if (!f.mostrarTestes) list = list.filter((p) => !p.isTest);

  if (f.concluidos) {
    list = list.filter((p) => isPedidoConcluido(p));
  } else if (!f.mostrarArquivados) {
    list = list.filter((p) => !p.archivedAt);
  }

  if (f.concluidos && f.criadoInicio) {
    const t = f.criadoInicio;
    list = list.filter((p) => {
      const ref = p.executionAt?.slice(0, 10) ?? p.criadoEm.slice(0, 10);
      return ref >= t;
    });
  }
  if (f.concluidos && f.criadoFim) {
    const t = f.criadoFim;
    list = list.filter((p) => {
      const ref = p.executionAt?.slice(0, 10) ?? p.criadoEm.slice(0, 10);
      return ref <= t;
    });
  }

  if (f.verConcluidos) {
    list = list.filter((p) => !!p.concluidoAt);
  } else {
    list = list.filter((p) => !p.concluidoAt);
  }

  if (f.filtroPrazo?.length && f.hojeIso) {
    const hojeIso = f.hojeIso;
    list = list.filter((p) =>
      f.filtroPrazo!.includes(prazoStatus({ data: p.data, concluidoAt: p.concluidoAt }, hojeIso) as any),
    );
  }

  if (f.status?.length) {
    list = list.filter((p) => f.status!.includes(p.paymentStatusNormalized ?? "aguardando"));
  }

  if (f.tipo) list = list.filter((p) => p.tipo === f.tipo);
  if (f.setor) list = list.filter((p) => p.productionSector === f.setor);
  if (f.unidadeId) list = list.filter((p) => p.unidadeId === f.unidadeId);

  if (f.dataExecucao) {
    list = list.filter((p) => {
      if (!p.executionAt) return false;
      const day = p.executionAt.slice(0, 10);
      return day === f.dataExecucao;
    });
  }

  if (f.criadoInicio && !f.concluidos) {
    const t = new Date(f.criadoInicio).getTime();
    list = list.filter((p) => new Date(p.criadoEm).getTime() >= t);
  }
  if (f.criadoFim && !f.concluidos) {
    const t = new Date(f.criadoFim).getTime() + 86400000;
    list = list.filter((p) => new Date(p.criadoEm).getTime() < t);
  }

  if (f.busca?.trim()) {
    const q = f.busca.toLowerCase();
    list = list.filter((p) => {
      const hay = [
        p.id,
        p.cliente.nome,
        p.cliente.whatsapp,
        p.recipientName,
        p.recipientPhone,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const ord = f.ordenacao ?? "criado_desc";
  list.sort((a, b) => {
    if (ord === "execution_asc" || ord === "execution_desc") {
      const ta = a.executionAt ? new Date(a.executionAt).getTime() : Infinity;
      const tb = b.executionAt ? new Date(b.executionAt).getTime() : Infinity;
      return ord === "execution_asc" ? ta - tb : tb - ta;
    }
    const ta = new Date(a.criadoEm).getTime();
    const tb = new Date(b.criadoEm).getTime();
    return ord === "criado_desc" ? tb - ta : ta - tb;
  });

  return list;
}

export function contarAprovadosOperacionais(pedidos: PedidoOperacional[]): number {
  const hoje = todayISOSP();
  return pedidos.filter(
    (p) =>
      !p.isTest &&
      !p.archivedAt &&
      p.paymentStatusNormalized === "aprovado" &&
      (!p.executionAt || p.executionAt.slice(0, 10) >= hoje),
  ).length;
}

export function sortPedidosPorCriadoDesc<T extends { criadoEm: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  );
}

export function agruparPorExecucao(pedidos: PedidoOperacional[]) {
  const grupos = new Map<string, PedidoOperacional[]>();
  for (const p of pedidos) {
    const key = p.executionAt?.slice(0, 10) ?? "sem-data";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(p);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => [key, sortPedidosPorCriadoDesc(items)] as const);
}

export const SETOR_LABEL: Record<ProductionSector, string> = {
  CONFEITARIA: "Confeitaria",
  PADARIA: "Padaria",
  COZINHA: "Cozinha",
};

export const SETOR_BADGE: Record<ProductionSector, string> = {
  CONFEITARIA: "bg-pink-100 text-pink-800",
  PADARIA: "bg-amber-100 text-amber-900",
  COZINHA: "bg-olive/20 text-olive",
};
