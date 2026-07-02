import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Link2, Copy, ExternalLink, Download, Search } from "lucide-react";
import {
  listarPedidos,
  conciliarPagamentosAsaas,
  avancarEtapaPedidos,
  marcarComoPago,
  type PedidoRow,
} from "@/lib/pedidos";
import {
  listarTokensPedidos,
  criarTokenPedidos,
  urlPublicaPedidos,
  type ShareToken,
} from "@/lib/shareToken";
import { rowToPedidoOperacional, type PedidoOperacional } from "@/lib/operacaoPedido";
import { useAdmin } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { todayISOSP } from "@/lib/timezone";
import {
  PAY_CHIP,
  STAGE_LABEL,
  STAGE_ORDER,
  stageChip,
  typeChip,
  type FulfillmentStage,
} from "@/lib/etapaPedido";
import type { PaymentStatusNormalized } from "@/lib/paymentStatus";
import { Chip } from "./Chip";
import { PedidoDrawer } from "./PedidoDrawer";

const SERIF = { fontFamily: "Spectral, serif" } as const;
const GRID = "34px 108px 1.15fr 1.3fr 96px 122px 122px 104px";
const GRID_CLASS = "hidden lg:grid";

type TabKey = "todos" | "hoje" | "entregas" | "retiradas" | "aberto";
type Linha = { row: PedidoRow; op: PedidoOperacional };

const TABS: { key: TabKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "entregas", label: "Entregas" },
  { key: "retiradas", label: "Retiradas" },
  { key: "aberto", label: "Pgto. em aberto" },
];

function ehHoje(op: PedidoOperacional, hoje: string) {
  return !!op.executionAt && op.executionAt.slice(0, 10) === hoje;
}
function estaAberto(op: PedidoOperacional) {
  return op.paymentStatusNormalized === "aguardando" || op.paymentStatusNormalized === "vencido";
}
function passaTab(op: PedidoOperacional, tab: TabKey, hoje: string) {
  if (tab === "hoje") return ehHoje(op, hoje);
  if (tab === "entregas") return op.tipo === "delivery";
  if (tab === "retiradas") return op.tipo === "retirada";
  if (tab === "aberto") return estaAberto(op);
  return true;
}

export function CentralPedidos() {
  const campanhas = useAdmin((s) => s.campanhas);
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [tokenGeral, setTokenGeral] = useState<ShareToken | null>(null);

  const [tab, setTab] = useState<TabKey>("todos");
  const [busca, setBusca] = useState("");
  const [fPag, setFPag] = useState<"" | PaymentStatusNormalized>("");
  const [fEtapa, setFEtapa] = useState<"" | FulfillmentStage>("");
  const [fCamp, setFCamp] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<PedidoRow | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const conc = await conciliarPagamentosAsaas();
    if (conc.ok && (conc.pagamentosAtualizados ?? 0) > 0) {
      toast.success("Pagamentos conciliados com o Asaas");
    }
    setRows(await listarPedidos());
    setCarregando(false);
  }, []);

  const carregarToken = useCallback(async () => {
    const lista = await listarTokensPedidos();
    let geral = lista.find((t) => !t.campanha_id) ?? null;
    if (!geral) geral = await criarTokenPedidos(undefined, undefined);
    setTokenGeral(geral);
  }, []);

  useEffect(() => {
    void carregar();
    void carregarToken();
  }, [carregar, carregarToken]);

  const hoje = todayISOSP();
  const campNome = useMemo(
    () => new Map(campanhas.map((c) => [c.id, c.nome])),
    [campanhas],
  );

  // Base: não arquivados, não teste.
  const base: Linha[] = useMemo(
    () =>
      rows
        .map((row) => ({ row, op: rowToPedidoOperacional(row) }))
        .filter(({ op }) => !op.archivedAt && !op.isTest),
    [rows],
  );

  // KPIs
  const kpis = useMemo(() => {
    const doHoje = base.filter(({ op }) => ehHoje(op, hoje));
    const entregasHoje = doHoje.filter(({ op }) => op.tipo === "delivery").length;
    const retiradasHoje = doHoje.filter(({ op }) => op.tipo === "retirada").length;
    const prep = doHoje.filter(
      ({ op }) => op.fulfillmentStage === "confirmado" || op.fulfillmentStage === "em_preparo",
    ).length;
    const prontos = doHoje.filter(({ op }) => op.fulfillmentStage === "pronto").length;
    const finalizados = doHoje.filter(({ op }) => op.fulfillmentStage === "finalizado").length;
    const abertos = base.filter(({ op }) => estaAberto(op));
    const valAberto = abertos.reduce((a, { op }) => a + op.total, 0);
    const aguardando = abertos.filter(({ op }) => op.paymentStatusNormalized === "aguardando").length;
    const vencidos = abertos.filter(({ op }) => op.paymentStatusNormalized === "vencido").length;
    const mes = hoje.slice(0, 7);
    const pagosMes = base.filter(
      ({ op, row }) =>
        op.paymentStatusNormalized === "aprovado" && (row.criado_em ?? "").slice(0, 7) === mes,
    );
    const arrecadado = pagosMes.reduce((a, { op }) => a + op.total, 0);
    const totalPagos = base.filter(({ op }) => op.paymentStatusNormalized === "aprovado").length;
    return {
      hoje: doHoje.length,
      hojeSub: `${entregasHoje} entregas · ${retiradasHoje} retiradas`,
      prep,
      prepSub: `${prontos} prontos · ${finalizados} finalizados`,
      valAberto,
      abertoSub: `${aguardando} aguardando · ${vencidos} vencidos`,
      arrecadado,
      arrecadadoSub: `${pagosMes.length} pedidos · ${totalPagos} pagos no total`,
    };
  }, [base, hoje]);

  const contagens = useMemo(() => {
    const c: Record<TabKey, number> = { todos: 0, hoje: 0, entregas: 0, retiradas: 0, aberto: 0 };
    for (const { op } of base) {
      c.todos++;
      if (ehHoje(op, hoje)) c.hoje++;
      if (op.tipo === "delivery") c.entregas++;
      if (op.tipo === "retirada") c.retiradas++;
      if (estaAberto(op)) c.aberto++;
    }
    return c;
  }, [base, hoje]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return base.filter(({ row, op }) => {
      if (!passaTab(op, tab, hoje)) return false;
      if (fPag && op.paymentStatusNormalized !== fPag) return false;
      if (fEtapa && op.fulfillmentStage !== fEtapa) return false;
      if (fCamp && row.campanha_id !== fCamp) return false;
      if (q) {
        const hay = `${op.recipientName} ${row.cliente_nome} ${op.recipientPhone} ${row.id} ${row.cesta?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [base, tab, hoje, fPag, fEtapa, fCamp, busca]);

  const idsVisiveis = useMemo(() => filtradas.map(({ row }) => row.id), [filtradas]);
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => sel.has(id));

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleTodos = () =>
    setSel((s) => {
      if (todosSelecionados) return new Set();
      return new Set(idsVisiveis);
    });
  const limparSel = () => setSel(new Set());

  async function mutar(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    setSalvando(true);
    const r = await fn();
    setSalvando(false);
    if (r.ok) {
      toast.success(msg);
      await carregar();
    } else {
      toast.error(r.error ?? "Erro");
    }
  }

  const avancarLote = () => {
    const ids = [...sel];
    if (!ids.length) return;
    void mutar(() => avancarEtapaPedidos(ids), `Etapa avançada em ${ids.length} pedido(s)`).then(limparSel);
  };
  const pagarLote = () => {
    const ids = [...sel];
    if (!ids.length) return;
    void mutar(() => marcarComoPago(ids), `${ids.length} pedido(s) marcados como pagos`).then(limparSel);
  };

  const url = tokenGeral ? urlPublicaPedidos(tokenGeral.token) : "";

  function exportarCsv() {
    const head = ["Recebido", "Codigo", "Cliente", "Telefone", "Produto", "Tipo", "Pagamento", "Etapa", "Total"];
    const linhas = filtradas.map(({ row, op }) => [
      new Date(row.criado_em).toLocaleString("pt-BR"),
      row.id.slice(0, 8),
      op.recipientName,
      op.recipientPhone,
      row.cesta?.nome ?? "",
      row.tipo,
      op.paymentStatusNormalized ?? "",
      op.fulfillmentStage ?? "",
      String(row.total),
    ]);
    const csv = [head, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pedidos-${hoje}.csv`;
    a.click();
  }

  return (
    <div className="admin-shell text-charcoal">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-charcoal" style={SERIF}>
            Pedidos recebidos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {carregando ? "Carregando…" : `${base.length} pedidos · atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void carregar()}
            className="admin-card inline-flex h-10 items-center gap-1.5 px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-black/[0.02]"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </button>
          <button
            onClick={exportarCsv}
            className="admin-card inline-flex h-10 items-center gap-1.5 px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-black/[0.02]"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {url && (
        <div className="admin-card mt-4 flex flex-col gap-3 border-dashed p-4 sm:flex-row sm:items-center">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-charcoal">Link público da cozinha</div>
            <div className="truncate text-xs text-muted-foreground">{url}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.open(url, "_blank")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/8 px-3 text-xs font-semibold"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </button>
            <button
              onClick={() => { void navigator.clipboard.writeText(url); toast.success("Link copiado"); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/8 px-3 text-xs font-semibold"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
        </div>
      )}

      <div className="admin-kpi-grid mt-5">
        <KpiCard bar="#2A5C8A" label="Pedidos hoje" valor={String(kpis.hoje)} sub={kpis.hojeSub} />
        <KpiCard bar="#97700F" label="Para preparar" valor={String(kpis.prep)} sub={kpis.prepSub} />
        <KpiCard bar="#B0414C" label="Pagamentos em aberto" valor={formatBRL(kpis.valAberto)} sub={kpis.abertoSub} />
        <KpiCard bar="#1E7A4F" label="Arrecadado no mês" valor={formatBRL(kpis.arrecadado)} sub={kpis.arrecadadoSub} />
      </div>

      <div className="admin-segmented-scroll mt-5">
        <div className="admin-segmented">
          {TABS.map((t) => {
            const ativo = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`admin-segmented-item inline-flex items-center gap-2 ${ativo ? "admin-segmented-item-active" : ""}`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ativo ? "bg-charcoal/10" : "bg-black/5"}`}>
                  {contagens[t.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="admin-card flex min-h-11 flex-1 items-center gap-2 px-3 py-2 lg:min-w-[240px]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, telefone, ID ou produto…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <SelectFiltro value={fPag} onChange={(v) => setFPag(v as "" | PaymentStatusNormalized)} placeholder="Pagamento: todos"
            opcoes={[["aprovado", "Pago"], ["aguardando", "Aguardando"], ["vencido", "Vencido"], ["cancelado", "Cancelado"]]} />
          <SelectFiltro value={fEtapa} onChange={(v) => setFEtapa(v as "" | FulfillmentStage)} placeholder="Etapa: todas"
            opcoes={STAGE_ORDER.map((s) => [s, STAGE_LABEL[s]])} />
          <SelectFiltro value={fCamp} onChange={setFCamp} placeholder="Campanha: todas"
            opcoes={campanhas.map((c) => [c.id, c.nome])} />
        </div>
      </div>

      {sel.size > 0 && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-charcoal px-4 py-3 text-white sm:flex-row sm:items-center">
          <span className="text-sm font-bold">{sel.size} selecionados</span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button onClick={pagarLote} disabled={salvando} className="h-9 rounded-xl bg-white px-3 text-xs font-bold text-charcoal disabled:opacity-50">Marcar como pago</button>
            <button onClick={avancarLote} disabled={salvando} className="h-9 rounded-xl bg-white/15 px-3 text-xs font-semibold disabled:opacity-50">Avançar etapa</button>
            <button onClick={limparSel} className="h-9 rounded-xl px-2.5 text-xs font-semibold text-white/70">Limpar</button>
          </div>
        </div>
      )}

      <div className="admin-card mt-4 overflow-hidden p-0">
        <div
          className={`${GRID_CLASS} items-center gap-3 border-b border-black/6 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground`}
          style={{ gridTemplateColumns: GRID }}
        >
          <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} className="h-4 w-4 accent-charcoal" />
          <span>Recebido</span><span>Cliente</span><span>Produto</span><span>Tipo</span><span>Pagamento</span><span>Etapa</span>
          <span className="text-right">Total</span>
        </div>
        {carregando ? (
          <div className="admin-empty-state border-0 shadow-none">Carregando…</div>
        ) : filtradas.length === 0 ? (
          <div className="admin-empty-state border-0 shadow-none">Nenhum pedido nesta visão.</div>
        ) : (
          filtradas.map(({ row, op }) => (
            <LinhaPedido
              key={row.id}
              row={row}
              op={op}
              selecionado={sel.has(row.id)}
              onToggle={() => toggle(row.id)}
              onAbrir={() => setDrawerRow(row)}
            />
          ))
        )}
      </div>

      <PedidoDrawer
        row={drawerRow}
        campanhaNome={drawerRow?.campanha_id ? campNome.get(drawerRow.campanha_id) : undefined}
        onOpenChange={(o) => { if (!o) setDrawerRow(null); }}
        loading={salvando}
        onAvancarEtapa={(id) => void mutar(() => avancarEtapaPedidos([id]), "Etapa avançada").then(() => setDrawerRow(null))}
        onMarcarPago={(id) => void mutar(() => marcarComoPago([id]), "Marcado como pago").then(() => setDrawerRow(null))}
        onImprimir={() => window.print()}
      />
    </div>
  );
}

function KpiCard({ bar, label, valor, sub }: { bar: string; label: string; valor: string; sub: string }) {
  return (
    <div className="admin-card p-4">
      <div className="mb-3 h-1 w-8 rounded-full" style={{ backgroundColor: bar }} />
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-bold leading-none text-charcoal" style={SERIF}>{valor}</div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function SelectFiltro({
  value,
  onChange,
  placeholder,
  opcoes,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  opcoes: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-card h-11 w-full rounded-xl px-3 text-sm text-charcoal lg:w-auto"
    >
      <option value="">{placeholder}</option>
      {opcoes.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function LinhaPedido({
  row,
  op,
  selecionado,
  onToggle,
  onAbrir,
}: {
  row: PedidoRow;
  op: PedidoOperacional;
  selecionado: boolean;
  onToggle: () => void;
  onAbrir: () => void;
}) {
  const pay = op.paymentStatusNormalized ? PAY_CHIP[op.paymentStatusNormalized] : null;

  return (
    <>
      <div
        onClick={onAbrir}
        className={`${GRID_CLASS} cursor-pointer items-center gap-3 border-b border-black/4 px-4 py-3.5 transition-colors hover:bg-black/[0.02]`}
        style={{ gridTemplateColumns: GRID }}
      >
        <input
          type="checkbox"
          checked={selecionado}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-charcoal"
        />
        <div>
          <div className="text-sm font-semibold text-charcoal">
            {new Date(row.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">#{row.id.slice(0, 8)}</div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-charcoal">{op.recipientName}</div>
          <div className="truncate text-xs text-muted-foreground">{op.recipientPhone}</div>
        </div>
        <div className="min-w-0 truncate text-sm text-charcoal">{row.cesta?.nome ?? "—"}</div>
        <div><Chip chip={typeChip(row.tipo)} /></div>
        <div><Chip chip={pay} /></div>
        <div><Chip chip={stageChip(op.fulfillmentStage)} /></div>
        <div className="text-right text-sm font-bold text-charcoal">{formatBRL(Number(row.total))}</div>
      </div>

      <button
        type="button"
        onClick={onAbrir}
        className="admin-card m-3 block w-[calc(100%-1.5rem)] p-4 text-left transition-transform active:scale-[0.99] lg:hidden"
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 accent-charcoal"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-charcoal">{op.recipientName}</p>
                <p className="truncate text-xs text-muted-foreground">{op.recipientPhone}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-charcoal">{formatBRL(Number(row.total))}</p>
            </div>
            <p className="text-sm text-charcoal">{row.cesta?.nome ?? "—"}</p>
            <div className="flex flex-wrap gap-2">
              <Chip chip={typeChip(row.tipo)} />
              <Chip chip={pay} />
              <Chip chip={stageChip(op.fulfillmentStage)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(row.criado_em).toLocaleDateString("pt-BR")} · #{row.id.slice(0, 8)}
            </p>
          </div>
        </div>
      </button>
    </>
  );
}
