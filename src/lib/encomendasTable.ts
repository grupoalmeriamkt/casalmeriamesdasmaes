import type { PedidoRow } from "@/lib/pedidos";
import { rowToPedidoOperacional, SETOR_LABEL } from "@/lib/operacaoPedido";
import { parseHorarioInicio } from "@/lib/executionAt";
import { TZ_SP } from "@/lib/timezone";
import type { PedidoSalvo } from "@/store/admin";
import type { UnidadeCadastrada } from "@/store/admin";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type ProductionSector,
} from "@/lib/availability";

export type EncomendaLinha = {
  linhaId: string;
  pedidoId: string;
  dataRetirada: string;
  horarioRetirada: string;
  diaSemana: string;
  nomeCliente: string;
  setor: string;
  setorKey: string;
  productionSector: ProductionSector | null;
  produto: string;
  qtd: number;
  localRetirada: string;
  localKey: string;
  unidadeId: string | null;
};

export const LOCAIS_RETIRADA_OPCOES = [
  { id: "asa-sul", label: "Asa Sul", key: "asa sul" },
  { id: "noroeste", label: "Noroeste", key: "noroeste" },
  { id: "saan", label: "SAAN", key: "saan" },
  { id: "beira-lago", label: "Beira Lago", key: "beira lago" },
  { id: "wine-garden", label: "Wine Garden", key: "wine garden" },
] as const;

const LOCAIS_CONHECIDOS = LOCAIS_RETIRADA_OPCOES.map((l) => ({
  keys: [l.key, l.id],
  label: l.label,
}));

export const LOCAL_BADGE: Record<string, string> = {
  "asa sul": "bg-blue-600 text-white",
  noroeste: "bg-amber-400 text-charcoal",
  saan: "bg-red-600 text-white",
  "beira lago": "bg-green-600 text-white",
  "wine garden": "bg-purple-600 text-white",
  outro: "bg-charcoal/10 text-charcoal",
};

export const SETOR_BADGE_PLANILHA: Record<string, string> = {
  confeitaria: "bg-pink-100 text-pink-800 border border-pink-300",
  padaria: "bg-green-100 text-green-800 border border-green-500",
  cozinha: "bg-violet-100 text-violet-900 border border-violet-400",
  outro: "bg-white text-charcoal border border-border",
};

export const SETORES_OPCOES: { value: ProductionSector; label: string; key: string }[] = [
  { value: "CONFEITARIA", label: "Confeitaria", key: "confeitaria" },
  { value: "PADARIA", label: "Padaria", key: "padaria" },
  { value: "COZINHA", label: "Cozinha", key: "cozinha" },
];

function isoToPartsSP(iso: string): { date: string; time: string; weekday: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    weekday: "long",
  }).format(d);
  return { date, time, weekday };
}

function dataEntregaParaIso(data?: string | null): string | null {
  if (!data) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const m = data.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function execucaoFromPedido(p: PedidoSalvo, raw?: PedidoRow) {
  if (raw?.execution_at) return isoToPartsSP(raw.execution_at);
  const iso = dataEntregaParaIso(p.data ?? raw?.data_entrega);
  if (!iso) return null;
  const hora = parseHorarioInicio(p.horario ?? raw?.horario);
  const execIso = new Date(
    `${iso}T${String(hora).padStart(2, "0")}:00:00-03:00`,
  ).toISOString();
  return isoToPartsSP(execIso);
}

function resolveLocal(
  p: PedidoSalvo,
  raw: PedidoRow | undefined,
  unidades: UnidadeCadastrada[],
): { label: string; key: string } {
  const unidadeId = raw?.unidade_id;
  if (unidadeId) {
    const u = unidades.find((x) => x.id === unidadeId);
    if (u) return { label: u.nome, key: u.nome.toLowerCase() };
  }

  const texto = (p.enderecoOuUnidade ?? raw?.endereco_ou_unidade ?? "").toLowerCase();
  for (const loc of LOCAIS_CONHECIDOS) {
    if (loc.keys.some((k) => texto.includes(k))) {
      return { label: loc.label, key: loc.label.toLowerCase() };
    }
  }

  if (p.tipo?.toLowerCase() === "delivery") {
    return { label: p.enderecoOuUnidade || "Entrega", key: "outro" };
  }

  const label = p.enderecoOuUnidade || "—";
  return { label, key: "outro" };
}

function resolveSetor(
  sector: ProductionSector | null | undefined,
  produtoNome: string,
): { label: string; key: string } {
  if (sector && SETOR_LABEL[sector]) {
    const label = SETOR_LABEL[sector];
    return { label, key: label.toLowerCase() };
  }
  const itens = [{ produto_id: produtoNome, produto_tipo: "cesta" as const, nome: produtoNome }];
  const resolved = resolveProductionSector(itens, buildRegrasForItens(itens));
  if (resolved && SETOR_LABEL[resolved]) {
    const label = SETOR_LABEL[resolved];
    return { label, key: label.toLowerCase() };
  }
  return { label: "—", key: "outro" };
}

function pushLinha(
  out: EncomendaLinha[],
  base: Omit<EncomendaLinha, "linhaId" | "produto" | "qtd" | "setor" | "setorKey">,
  produto: string,
  qtd: number,
  sector?: ProductionSector | null,
) {
  const setor = resolveSetor(sector, produto);
  out.push({
    ...base,
    linhaId: `${base.pedidoId}-${produto}-${out.length}`,
    produto,
    qtd,
    setor: setor.label,
    setorKey: setor.key,
    productionSector: sector ?? base.productionSector,
  });
}

/** Uma linha por item (cesta, sobremesa, cartão, polaroid) — espelha a planilha ENCOMENDAS. */
export function flattenPedidosParaLinhas(
  pedidos: PedidoSalvo[],
  rawRows: PedidoRow[],
  unidades: UnidadeCadastrada[] = [],
): EncomendaLinha[] {
  const rowMap = new Map(rawRows.map((r) => [r.id, r]));
  const linhas: EncomendaLinha[] = [];

  for (const p of pedidos) {
    const raw = rowMap.get(p.id);
    const op = raw ? rowToPedidoOperacional(raw) : null;
    const exec = execucaoFromPedido(p, raw);
    const local = resolveLocal(p, raw, unidades);
    const nomeCliente =
      op?.recipientName ||
      p.destinatario?.nome ||
      p.cliente.nome ||
      "(sem nome)";

    const sector = op?.productionSector ?? null;

    const base = {
      pedidoId: p.id,
      dataRetirada: exec?.date ?? (p.data ? p.data.split("-").reverse().join("/") : "—"),
      horarioRetirada: exec?.time ?? (p.horario ? `${String(parseHorarioInicio(p.horario)).padStart(2, "0")}:00:00` : "—"),
      diaSemana: exec?.weekday ?? "—",
      nomeCliente,
      localRetirada: local.label,
      localKey: local.key,
      unidadeId: raw?.unidade_id ?? null,
      productionSector: (raw?.production_sector as ProductionSector | null) ?? sector,
      setor: "",
      setorKey: "outro",
      produto: "",
      qtd: 0,
    };

    if (p.cesta?.nome) {
      pushLinha(linhas, base, p.cesta.nome, p.cesta.quantidade, sector);
    }
    for (const s of p.sobremesas) {
      pushLinha(linhas, base, s.nome, s.quantidade, sector);
    }
    for (const c of p.pagamento?.extras?.cartoes ?? []) {
      pushLinha(linhas, base, c.nome, 1, sector);
    }
    for (const po of p.pagamento?.extras?.polaroids ?? []) {
      pushLinha(linhas, base, po.nome, 1, sector);
    }

    if (!p.cesta && p.sobremesas.length === 0 && !(p.pagamento?.extras?.cartoes?.length) && !(p.pagamento?.extras?.polaroids?.length)) {
      pushLinha(linhas, base, "(sem produto)", 0, sector);
    }
  }

  return linhas;
}

export const ENCOMENDAS_CSV_HEAD = [
  "DATA DE RETIRADA",
  "HORÁRIO DA RETIRADA",
  "DIA DA SEMANA",
  "NOME DO CLIENTE",
  "SETOR RESPONSÁVEL",
  "PRODUTO",
  "QTD",
  "LOCAL DE RETIRADA",
] as const;

export function linhasParaCsvRows(linhas: EncomendaLinha[]): string[][] {
  return linhas.map((l) => [
    l.dataRetirada,
    l.horarioRetirada,
    l.diaSemana,
    l.nomeCliente,
    l.setor,
    l.produto,
    String(l.qtd),
    l.localRetirada,
  ]);
}
