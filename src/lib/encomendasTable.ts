import type { PedidoRow } from "@/lib/pedidos";
import { dataEntregaParaIso } from "@/lib/dateUtils";
import { rowToPedidoOperacional } from "@/lib/operacaoPedido";
import { parseHorarioInicio } from "@/lib/executionAt";
import { TZ_SP } from "@/lib/timezone";
import type { PedidoSalvo } from "@/store/admin";
import type { UnidadeCadastrada } from "@/store/admin";
import {
  badgeKeySetorOperacao,
  labelSetorOperacao,
  type SetorOperacional,
} from "@/lib/setoresOperacao";
import {
  buildRegrasForItens,
  resolveProductionSector,
  type ProductionSector,
} from "@/lib/availability";

export type EncomendaLinha = {
  linhaId: string;
  pedidoId: string;
  dataChegada: string;
  dataRetirada: string;
  horarioRetirada: string;
  diaSemana: string;
  nomeCliente: string;
  setor: string;
  setorKey: string;
  productionSector: SetorOperacional | null;
  produto: string;
  qtd: number;
  localRetirada: string;
  localKey: string;
  unidadeId: string | null;
};

export const LOCAIS_RETIRADA_OPCOES = [
  { id: "asa-sul", label: "Asa Sul", key: "asa sul" },
  { id: "noroeste", label: "Noroeste", key: "noroeste" },
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
  "beira lago": "bg-green-600 text-white",
  "wine garden": "bg-purple-600 text-white",
  outro: "bg-charcoal/10 text-charcoal",
};

export {
  SETORES_OPERACAO_OPCOES as SETORES_OPCOES,
  SETOR_OPERACAO_BADGE_PLANILHA as SETOR_BADGE_PLANILHA,
} from "@/lib/setoresOperacao";

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

export type LocalOpcaoRef = { id: string; label: string; key: string };

/** Resolve o id da opção de local para o dropdown da planilha. */
export function resolveLocalOptionId(
  unidadeId: string | null,
  localRetirada: string,
  localKey: string,
  opcoes: LocalOpcaoRef[] = [],
): string {
  if (unidadeId && opcoes.some((o) => o.id === unidadeId)) {
    return unidadeId;
  }

  const labelNorm = localRetirada.trim().toLowerCase();
  if (labelNorm && labelNorm !== "—") {
    const byLabel = opcoes.find((o) => o.label.toLowerCase() === labelNorm);
    if (byLabel) return byLabel.id;

    const byLabelPartial = opcoes.find(
      (o) => labelNorm.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(labelNorm),
    );
    if (byLabelPartial) return byLabelPartial.id;
  }

  const keyNorm = localKey.trim().toLowerCase();
  if (keyNorm && keyNorm !== "outro") {
    const byKey = opcoes.find((o) => o.key === keyNorm || o.id === keyNorm);
    if (byKey) return byKey.id;
  }

  for (const loc of LOCAIS_RETIRADA_OPCOES) {
    if (
      labelNorm.includes(loc.key) ||
      labelNorm === loc.label.toLowerCase() ||
      keyNorm === loc.key
    ) {
      const inOpcoes = opcoes.find(
        (o) => o.id === loc.id || o.label.toLowerCase() === loc.label.toLowerCase(),
      );
      if (inOpcoes) return inOpcoes.id;
      return loc.id;
    }
  }

  return "";
}

function inferUnidadeId(
  rawId: string | null | undefined,
  local: { label: string; key: string },
  unidades: UnidadeCadastrada[],
): string | null {
  if (rawId) return rawId;

  const fromUnidades = unidades.find(
    (u) => u.nome.toLowerCase() === local.label.toLowerCase(),
  );
  if (fromUnidades) return fromUnidades.id;

  const fromLocais = LOCAIS_RETIRADA_OPCOES.find(
    (l) =>
      l.label.toLowerCase() === local.label.toLowerCase() || l.key === local.key,
  );
  return fromLocais?.id ?? null;
}

function resolveSetor(
  sector: SetorOperacional | ProductionSector | null | undefined,
  produtoNome: string,
): { label: string; key: string; value: SetorOperacional | null } {
  if (sector && labelSetorOperacao(sector) !== "—") {
    return {
      label: labelSetorOperacao(sector),
      key: badgeKeySetorOperacao(sector),
      value: sector as SetorOperacional,
    };
  }
  const itens = [{ produto_id: produtoNome, produto_tipo: "cesta" as const, nome: produtoNome }];
  const resolved = resolveProductionSector(itens, buildRegrasForItens(itens));
  if (resolved) {
    return {
      label: labelSetorOperacao(resolved),
      key: badgeKeySetorOperacao(resolved),
      value: resolved,
    };
  }
  return { label: "—", key: "outro", value: null };
}

function pushLinha(
  out: EncomendaLinha[],
  base: Omit<EncomendaLinha, "linhaId" | "produto" | "qtd" | "setor" | "setorKey">,
  produto: string,
  qtd: number,
  sector?: SetorOperacional | ProductionSector | null,
) {
  const setor = resolveSetor(sector, produto);
  out.push({
    ...base,
    linhaId: `${base.pedidoId}-${produto}-${out.length}`,
    produto,
    qtd,
    setor: setor.label,
    setorKey: setor.key,
    productionSector: setor.value ?? base.productionSector,
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
    const chegada = isoToPartsSP(raw?.criado_em ?? p.criadoEm ?? "");

    const base = {
      pedidoId: p.id,
      dataChegada: chegada?.date ?? "—",
      dataRetirada: exec?.date ?? (p.data ? p.data.split("-").reverse().join("/") : "—"),
      horarioRetirada: exec?.time ?? (p.horario ? `${String(parseHorarioInicio(p.horario)).padStart(2, "0")}:00:00` : "—"),
      diaSemana: exec?.weekday ?? "—",
      nomeCliente,
      localRetirada: local.label,
      localKey: local.key,
      unidadeId: inferUnidadeId(raw?.unidade_id, local, unidades),
      productionSector: (raw?.production_sector as SetorOperacional | null) ?? sector,
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
  "DATA DO PEDIDO",
  "DATA DA ENTREGA",
  "HORÁRIO DA ENTREGA",
  "DIA DA ENTREGA",
  "NOME DO CLIENTE",
  "SETOR RESPONSÁVEL",
  "PRODUTO",
  "QTD",
  "LOCAL DE RETIRADA",
] as const;

export function linhasParaCsvRows(linhas: EncomendaLinha[]): string[][] {
  return linhas.map((l) => [
    l.dataChegada,
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
