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
import { parseTamanhoDoNome, resolveCestaItem } from "@/lib/cestaTamanho";

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
  tamanho: string | null;
  qtd: number;
  localRetirada: string;
  localKey: string;
  unidadeId: string | null;
  dataIso: string | null;
  concluidoAt: string | null;
};

export const ENTREGA_MOTOBOY_ID = "entrega-motoboy" as const;

export const LOCAIS_RETIRADA_OPCOES = [
  { id: "asa-sul", label: "Retirada 104", key: "retirada 104", aliases: ["asa sul", "104 sul", "104"] },
  { id: "noroeste", label: "Retirada Noroeste", key: "retirada noroeste", aliases: ["noroeste"] },
  { id: ENTREGA_MOTOBOY_ID, label: "Entrega Motoboy", key: "entrega motoboy", aliases: ["entrega", "delivery", "motoboy"] },
] as const;

export function locaisPlanilhaOpcoes(): LocalOpcaoRef[] {
  return LOCAIS_RETIRADA_OPCOES.map((l) => ({ id: l.id, label: l.label, key: l.key }));
}

export const LOCAL_BADGE: Record<string, string> = {
  "retirada 104": "bg-blue-600 text-white",
  "retirada noroeste": "bg-amber-400 text-charcoal",
  "entrega motoboy": "bg-emerald-600 text-white",
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

function planilhaLocalFromOpcao(id: string): { label: string; key: string } | null {
  const opt = LOCAIS_RETIRADA_OPCOES.find((l) => l.id === id);
  return opt ? { label: opt.label, key: opt.key } : null;
}

function resolveLocal(
  p: PedidoSalvo,
  raw: PedidoRow | undefined,
  _unidades: UnidadeCadastrada[],
): { label: string; key: string } {
  const tipo = (p.tipo ?? raw?.tipo ?? "").toLowerCase();
  if (tipo === "delivery") {
    return planilhaLocalFromOpcao(ENTREGA_MOTOBOY_ID)!;
  }

  const texto = (p.enderecoOuUnidade ?? raw?.endereco_ou_unidade ?? "").toLowerCase().trim();
  if (texto === "entrega motoboy") {
    return planilhaLocalFromOpcao(ENTREGA_MOTOBOY_ID)!;
  }

  const unidadeId = raw?.unidade_id ?? p.unidadeId;
  if (unidadeId && unidadeId !== ENTREGA_MOTOBOY_ID) {
    const fromId = planilhaLocalFromOpcao(unidadeId);
    if (fromId) return fromId;
  }

  for (const loc of LOCAIS_RETIRADA_OPCOES) {
    if (loc.id === ENTREGA_MOTOBOY_ID) continue;
    const keys = [loc.key, loc.id, ...(loc.aliases ?? [])];
    if (keys.some((k) => texto.includes(k))) {
      return { label: loc.label, key: loc.key };
    }
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
  const keyNorm = localKey.trim().toLowerCase();

  if (labelNorm === "entrega motoboy" || keyNorm === "entrega motoboy") {
    return ENTREGA_MOTOBOY_ID;
  }

  if (labelNorm && labelNorm !== "—") {
    const byLabel = opcoes.find((o) => o.label.toLowerCase() === labelNorm);
    if (byLabel) return byLabel.id;

    const byLabelPartial = opcoes.find(
      (o) => labelNorm.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(labelNorm),
    );
    if (byLabelPartial) return byLabelPartial.id;
  }

  if (keyNorm && keyNorm !== "outro") {
    const byKey = opcoes.find((o) => o.key === keyNorm || o.id === keyNorm);
    if (byKey) return byKey.id;
  }

  for (const loc of LOCAIS_RETIRADA_OPCOES) {
    const aliasHit =
      (loc.aliases ?? []).some((a) => labelNorm.includes(a) || keyNorm === a) ||
      labelNorm.includes(loc.key) ||
      labelNorm === loc.label.toLowerCase() ||
      keyNorm === loc.key;
    if (aliasHit) {
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
  _unidades: UnidadeCadastrada[],
): string | null {
  if (local.key === "entrega motoboy" || local.label === "Entrega Motoboy") return null;
  if (rawId && rawId !== ENTREGA_MOTOBOY_ID) return rawId;

  const fromLocais = LOCAIS_RETIRADA_OPCOES.find(
    (l) =>
      l.id !== ENTREGA_MOTOBOY_ID &&
      (l.label.toLowerCase() === local.label.toLowerCase() || l.key === local.key),
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
  base: Omit<EncomendaLinha, "linhaId" | "produto" | "tamanho" | "qtd" | "setor" | "setorKey">,
  produto: string,
  qtd: number,
  tamanho: string | null,
  sector?: SetorOperacional | ProductionSector | null,
) {
  const nomeSetor = tamanho ? `${produto} · Tam. ${tamanho}` : produto;
  const setor = resolveSetor(sector, nomeSetor);
  out.push({
    ...base,
    linhaId: `${base.pedidoId}-${produto}-${out.length}`,
    produto,
    tamanho,
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
      dataIso: dataEntregaParaIso(p.data ?? raw?.data_entrega) ?? null,
      concluidoAt: p.concluidoAt ?? (raw as any)?.concluido_at ?? null,
      setor: "",
      setorKey: "outro",
      produto: "",
      tamanho: null,
      qtd: 0,
    };

    if (p.cesta?.nome) {
      const item = resolveCestaItem(p.cesta);
      pushLinha(linhas, base, item.nomeBase, item.quantidade, item.tamanho, sector);
    }
    for (const s of p.sobremesas) {
      const parsed = parseTamanhoDoNome(s.nome);
      pushLinha(linhas, base, parsed.nomeBase, s.quantidade, parsed.tamanho, sector);
    }
    for (const c of p.pagamento?.extras?.cartoes ?? []) {
      pushLinha(linhas, base, c.nome, 1, null, sector);
    }
    for (const po of p.pagamento?.extras?.polaroids ?? []) {
      pushLinha(linhas, base, po.nome, 1, null, sector);
    }

    if (!p.cesta && p.sobremesas.length === 0 && !(p.pagamento?.extras?.cartoes?.length) && !(p.pagamento?.extras?.polaroids?.length)) {
      pushLinha(linhas, base, "(sem produto)", 0, null, sector);
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
  "TAMANHO",
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
    l.tamanho ?? "",
    String(l.qtd),
    l.localRetirada,
  ]);
}
