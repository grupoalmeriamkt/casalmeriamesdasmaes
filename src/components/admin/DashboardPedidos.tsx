import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Handle,
  Controls,
  getBezierPath,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  GitBranchPlus,
  ExternalLink,
  Factory,
  Filter,
  Maximize2,
  PackageCheck,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  avancarEtapaPedidos,
  conciliarPagamentosAsaas,
  listarPedidos,
  marcarComoPago,
  type PedidoRow,
} from "@/lib/pedidos";
import { rowToPedidoOperacional, type PedidoOperacional } from "@/lib/operacaoPedido";
import { todayISOSP } from "@/lib/timezone";
import { formatBRL } from "@/store/pedido";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentStatusNormalized } from "@/lib/paymentStatus";
import type { FulfillmentStage } from "@/lib/etapaPedido";

type Linha = { row: PedidoRow; op: PedidoOperacional };

type FlowNodeId =
  | "criado"
  | "pendente"
  | "aprovado"
  | "producao"
  | "separacao"
  | "retirada"
  | "entrega"
  | "rota"
  | "finalizado"
  | "cancelamento"
  | "cancelado";

type FlowNode = {
  id: FlowNodeId;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  tone: "green" | "blue" | "dark" | "muted" | "danger";
  count: number;
  items: Linha[];
  amount?: number;
};

type OpsNodeData = {
  title: string;
  subtitle: string;
  count: number;
  amount?: number;
  tone: FlowNode["tone"];
  stageId?: FlowNodeId;
  active?: boolean;
  onSelect?: (id: FlowNodeId) => void;
};

type OpsNode = Node<OpsNodeData, "ops">;
type OpsEdgeData = { tone?: "primary" | "muted" | "success" | "danger" };
type OpsEdge = Edge<OpsEdgeData, "oracle">;

type Bucket = {
  id: string;
  title: string;
  description: string;
  tone: "blue" | "amber" | "green" | "dark" | "danger";
  icon: typeof Clock3;
  items: Linha[];
};

type DashboardFilters = {
  busca: string;
  dataExecucao: string;
  criadoInicio: string;
  criadoFim: string;
  tipo: "" | "delivery" | "retirada";
  pagamento: "" | PaymentStatusNormalized;
  etapa: "" | FulfillmentStage;
  setor: string;
};

const EMPTY_FILTERS: DashboardFilters = {
  busca: "",
  dataExecucao: "",
  criadoInicio: "",
  criadoFim: "",
  tipo: "",
  pagamento: "",
  etapa: "",
  setor: "",
};

const NODE_LABEL: Record<FlowNodeId, string> = {
  criado: "Pedido criado",
  pendente: "Pagamento pendente",
  aprovado: "Pagamento aprovado",
  producao: "Em producao",
  separacao: "Separacao",
  retirada: "Pronto retirada",
  entrega: "Pronto entrega",
  rota: "Em rota",
  finalizado: "Finalizado",
  cancelamento: "Cancelamento",
  cancelado: "Cancelado",
};

const NODE_CLASS = {
  green: "border-[#3FB950]/45 bg-[#3FB950]/16 text-[#3FB950]",
  blue: "border-[#58A6FF]/45 bg-[#58A6FF]/16 text-[#58A6FF]",
  dark: "border-[#3FB950] bg-[#0f8b45] text-white",
  muted: "border-[#30363D] bg-[#0D1117] text-[#8B949E]",
  danger: "border-[#F85149]/45 bg-[#F85149]/12 text-[#F85149]",
};

const BUCKET_CLASS = {
  blue: "border-[#58A6FF]/30 bg-[#58A6FF]/10 text-[#58A6FF]",
  amber: "border-[#D29922]/30 bg-[#D29922]/10 text-[#D29922]",
  green: "border-[#3FB950]/30 bg-[#3FB950]/10 text-[#3FB950]",
  dark: "border-[#30363D] bg-[#0D1117] text-[#C9D1D9]",
  danger: "border-[#F85149]/30 bg-[#F85149]/10 text-[#F85149]",
};

function isOpenPayment(op: PedidoOperacional) {
  return op.paymentStatusNormalized === "aguardando" || op.paymentStatusNormalized === "vencido";
}

function isCanceled(op: PedidoOperacional) {
  return op.paymentStatusNormalized === "cancelado" || op.status === "cancelado";
}

function isApproved(op: PedidoOperacional) {
  return op.paymentStatusNormalized === "aprovado";
}

function sameDayExecution(op: PedidoOperacional, day: string) {
  return op.executionAt?.slice(0, 10) === day;
}

function deliveryOrPickupLabel(tipo: string) {
  if (tipo === "delivery") return "Entrega";
  if (tipo === "retirada") return "Retirada";
  return "Operação";
}

function timeLabel(value?: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateLabel(value?: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function amount(items: Linha[]) {
  return items.reduce((acc, { op }) => acc + Number(op.total || 0), 0);
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function currentStageLabel(op: PedidoOperacional) {
  if (isCanceled(op)) return "Cancelado";
  if (isOpenPayment(op)) return "Pagamento pendente";
  if (!isApproved(op)) return "Pedido criado";
  if (op.fulfillmentStage === "finalizado") return "Finalizado";
  if (op.fulfillmentStage === "pronto" && op.tipo === "retirada") return "Pronto para retirada";
  if (op.fulfillmentStage === "pronto" && op.tipo === "delivery") return "Pronto para entrega";
  if (op.fulfillmentStage === "em_preparo") return "Separação";
  if (op.fulfillmentStage === "confirmado") return "Em produção";
  return "Pagamento aprovado";
}

function paymentLabel(value?: PaymentStatusNormalized | null) {
  if (value === "aprovado") return "Pago";
  if (value === "aguardando") return "Aguardando";
  if (value === "vencido") return "Vencido";
  if (value === "cancelado") return "Cancelado";
  if (value === "rascunho") return "Rascunho";
  if (value === "abandonado") return "Abandonado";
  return "Sem status";
}

function stageFilterLabel(value?: FulfillmentStage | null) {
  if (value === "confirmado") return "Confirmado";
  if (value === "em_preparo") return "Em preparo";
  if (value === "pronto") return "Pronto";
  if (value === "finalizado") return "Finalizado";
  return "Sem etapa";
}

function matchesFilters(item: Linha, filters: DashboardFilters) {
  const { row, op } = item;
  const q = filters.busca.trim().toLowerCase();

  if (q) {
    const haystack = [
      row.id,
      row.cliente_nome,
      row.cliente_whatsapp,
      row.cesta?.nome,
      op.recipientName,
      op.recipientPhone,
      op.enderecoOuUnidade,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (filters.dataExecucao && op.executionAt?.slice(0, 10) !== filters.dataExecucao) return false;
  if (filters.criadoInicio && row.criado_em.slice(0, 10) < filters.criadoInicio) return false;
  if (filters.criadoFim && row.criado_em.slice(0, 10) > filters.criadoFim) return false;
  if (filters.tipo && row.tipo !== filters.tipo) return false;
  if (filters.pagamento && op.paymentStatusNormalized !== filters.pagamento) return false;
  if (filters.etapa && op.fulfillmentStage !== filters.etapa) return false;
  if (filters.setor && op.productionSector !== filters.setor) return false;

  return true;
}

async function arquivarPedidosVencidos() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch("/api/admin/arquivar-pedidos", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (error) {
    console.error("[dashboard] erro ao arquivar pedidos vencidos", error);
  }
}

export function DashboardPedidos({ fullscreen = false }: { fullscreen?: boolean }) {
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<FlowNodeId>("producao");
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [selectedOrder, setSelectedOrder] = useState<Linha | null>(null);
  const refreshInFlightRef = useRef(false);

  const load = useCallback(
    async ({
      silent = false,
      reconcile = true,
    }: { silent?: boolean; reconcile?: boolean } = {}) => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      if (!silent) setLoading(true);
      try {
        if (reconcile) {
          const conc = await conciliarPagamentosAsaas();
          if (conc.ok && (conc.pagamentosAtualizados ?? 0) > 0) {
            toast.success("Pagamentos conciliados com o Asaas");
          }
          await arquivarPedidosVencidos();
        }
        setRows(await listarPedidos());
        setUpdatedAt(new Date());
      } finally {
        refreshInFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshSilently = () => {
      void load({ silent: true, reconcile: false });
    };

    const channel = supabase
      .channel("dashboard-pedidos-ops")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, refreshSilently)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagamentos" },
        refreshSilently,
      )
      .subscribe();

    const intervalId = window.setInterval(refreshSilently, 30_000);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(intervalId);
    };
  }, [load]);

  const hoje = todayISOSP();

  const base = useMemo<Linha[]>(
    () =>
      rows
        .map((row) => ({ row, op: rowToPedidoOperacional(row) }))
        .filter(({ op }) => !op.archivedAt && !op.isTest),
    [rows],
  );

  const filteredBase = useMemo(
    () => base.filter((item) => matchesFilters(item, filters)),
    [base, filters],
  );

  const filterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== "").length,
    [filters],
  );

  const sectors = useMemo(
    () =>
      Array.from(new Set(base.map(({ op }) => op.productionSector).filter(Boolean) as string[]))
        .sort()
        .map((value) => ({
          value,
          label:
            value === "CONFEITARIA"
              ? "Confeitaria"
              : value === "PADARIA"
                ? "Padaria"
                : value === "COZINHA"
                  ? "Cozinha"
                  : value,
        })),
    [base],
  );

  const stats = useMemo(() => {
    const criados = filteredBase;
    const pendentes = filteredBase.filter(({ op }) => !isCanceled(op) && isOpenPayment(op));
    const aprovados = filteredBase.filter(({ op }) => !isCanceled(op) && isApproved(op));
    const producao = aprovados.filter(({ op }) => op.fulfillmentStage === "confirmado");
    const separacao = aprovados.filter(({ op }) => op.fulfillmentStage === "em_preparo");
    const retirada = aprovados.filter(
      ({ op }) => op.fulfillmentStage === "pronto" && op.tipo === "retirada",
    );
    const entrega = aprovados.filter(
      ({ op }) => op.fulfillmentStage === "pronto" && op.tipo === "delivery",
    );
    const rota = aprovados.filter(
      ({ op }) => op.fulfillmentStage === "finalizado" && op.tipo === "delivery",
    );
    const finalizados = aprovados.filter(({ op }) => op.fulfillmentStage === "finalizado");
    const cancelados = filteredBase.filter(({ op }) => isCanceled(op));
    const hojeList = filteredBase.filter(({ op }) => sameDayExecution(op, hoje));
    const gargalo = [
      ["Pagamento pendente", pendentes.length],
      ["Em produção", producao.length],
      ["Separação", separacao.length],
      ["Prontos", retirada.length + entrega.length],
    ].sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    return {
      criados,
      pendentes,
      aprovados,
      producao,
      separacao,
      retirada,
      entrega,
      rota,
      finalizados,
      cancelados,
      hojeList,
      gargalo: gargalo?.[0] ?? "Sem gargalo",
    };
  }, [filteredBase, hoje]);

  const nodes = useMemo<FlowNode[]>(
    () => [
      {
        id: "criado",
        title: "Pedido criado",
        subtitle: "entrada",
        x: 24,
        y: 34,
        tone: "green",
        count: stats.criados.length,
        items: stats.criados,
        amount: amount(stats.criados),
      },
      {
        id: "pendente",
        title: "Pagamento pendente",
        subtitle: "aguardando",
        x: 164,
        y: 34,
        tone: "green",
        count: stats.pendentes.length,
        items: stats.pendentes,
        amount: amount(stats.pendentes),
      },
      {
        id: "aprovado",
        title: "Pagamento aprovado",
        subtitle: "liberado",
        x: 304,
        y: 34,
        tone: "green",
        count: stats.aprovados.length,
        items: stats.aprovados,
        amount: amount(stats.aprovados),
      },
      {
        id: "producao",
        title: "Em produção",
        subtitle: "cozinha",
        x: 444,
        y: 34,
        tone: "blue",
        count: stats.producao.length,
        items: stats.producao,
      },
      {
        id: "separacao",
        title: "Separação",
        subtitle: "conferencia",
        x: 584,
        y: 34,
        tone: "green",
        count: stats.separacao.length,
        items: stats.separacao,
      },
      {
        id: "entrega",
        title: "Pronto entrega",
        subtitle: "expedicao",
        x: 724,
        y: 34,
        tone: "green",
        count: stats.entrega.length,
        items: stats.entrega,
      },
      {
        id: "rota",
        title: "Em rota",
        subtitle: "delivery",
        x: 864,
        y: 34,
        tone: "blue",
        count: stats.rota.length,
        items: stats.rota,
      },
      {
        id: "finalizado",
        title: "Finalizado",
        subtitle: "concluido",
        x: 1004,
        y: 34,
        tone: "dark",
        count: stats.finalizados.length,
        items: stats.finalizados,
        amount: amount(stats.finalizados),
      },
      {
        id: "retirada",
        title: "Pronto retirada",
        subtitle: "balcao",
        x: 724,
        y: 154,
        tone: "blue",
        count: stats.retirada.length,
        items: stats.retirada,
      },
      {
        id: "cancelamento",
        title: "Solicitar cancelamento",
        subtitle: "excecao",
        x: 584,
        y: 244,
        tone: "muted",
        count: 0,
        items: [],
      },
      {
        id: "cancelado",
        title: "Cancelado",
        subtitle: "encerrado",
        x: 1004,
        y: 244,
        tone: "danger",
        count: stats.cancelados.length,
        items: stats.cancelados,
      },
    ],
    [stats],
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0],
    [nodes, selectedNodeId],
  );

  const selectedItems = selectedNode?.items ?? [];

  const activeThroughput = stats.aprovados.length - stats.finalizados.length;

  const buckets = useMemo<Bucket[]>(
    () => [
      {
        id: "pendentes",
        title: "Pagamento",
        description: "Aguardando confirmacao para entrar na linha.",
        tone: stats.pendentes.length ? "amber" : "dark",
        icon: Clock3,
        items: stats.pendentes,
      },
      {
        id: "producao",
        title: "Producao",
        description: "Pedidos pagos que ja podem ser preparados.",
        tone: "blue",
        icon: ChefHat,
        items: [...stats.producao, ...stats.separacao],
      },
      {
        id: "expedicao",
        title: "Expedicao",
        description: "Prontos para retirada, entrega ou rota.",
        tone: "green",
        icon: PackageCheck,
        items: [...stats.retirada, ...stats.entrega, ...stats.rota],
      },
      {
        id: "excecoes",
        title: "Excecoes",
        description: "Cancelados ou fora do fluxo normal.",
        tone: stats.cancelados.length ? "danger" : "dark",
        icon: AlertTriangle,
        items: stats.cancelados,
      },
    ],
    [stats],
  );

  const nextOrders = useMemo(
    () =>
      filteredBase
        .filter(
          ({ op }) => !isCanceled(op) && isApproved(op) && op.fulfillmentStage !== "finalizado",
        )
        .sort((a, b) => {
          const da = a.op.executionAt ? new Date(a.op.executionAt).getTime() : Infinity;
          const db = b.op.executionAt ? new Date(b.op.executionAt).getTime() : Infinity;
          if (da !== db) return da - db;
          return new Date(a.row.criado_em).getTime() - new Date(b.row.criado_em).getTime();
        })
        .slice(0, 6),
    [filteredBase],
  );

  async function mutateSelected(
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    if (!selectedOrder) return;
    setSaving(true);
    const result = await fn(selectedOrder.row.id);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Erro ao atualizar pedido");
      return;
    }
    toast.success(success);
    setSelectedOrder(null);
    await load();
  }

  return (
    <div
      className={cn(
        "admin-shell dashboard-ops bg-[#0A0C10] text-[#C9D1D9]",
        fullscreen
          ? "min-h-[100dvh] w-full px-3 py-3 sm:px-4 lg:px-5"
          : "-mx-4 -my-5 px-4 py-5 sm:-mx-6 sm:px-6 md:-mx-8 md:-my-8 md:px-8 md:py-8",
      )}
    >
      <div className={cn("w-full", fullscreen ? "max-w-none" : "mx-auto max-w-7xl")}>
        <header
          className={cn(
            "relative overflow-hidden border border-[#30363D] bg-[#0D1117] px-4 sm:px-5",
            fullscreen ? "py-4" : "py-5",
          )}
        >
          <div className="dashboard-scanline" aria-hidden />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 border border-[#30363D] bg-[#0A0C10]/80 px-3 py-2">
                  <Logo variant="light" className="max-h-9" />
                  <div className="border-l border-[#30363D] pl-3">
                    <div className="font-mono text-[10px] font-black uppercase text-[#8B949E]">
                      Operação
                    </div>
                    <div className="font-mono text-lg font-black leading-none text-[#F0F6FC]">
                      Ops
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 border border-[#58A6FF]/35 bg-[#58A6FF]/10 px-2.5 py-1 text-[11px] font-bold uppercase text-[#58A6FF]">
                  <span className="h-2 w-2 animate-pulse bg-[#3FB950]" />
                  <Factory className="h-3.5 w-3.5" />
                  Linha viva
                </div>
              </div>
              <h1
                className={cn(
                  "mt-3 font-sans font-black text-[#F0F6FC]",
                  fullscreen ? "text-2xl sm:text-[2rem]" : "text-2xl sm:text-3xl",
                )}
              >
                Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8B949E]">
                Status em tempo real dos pedidos, com fluxo animado de producao, gargalos e fila
                operacional por etapa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs font-bold text-[#8B949E]">
                {loading
                  ? "Atualizando..."
                  : `Atualizado ${updatedAt ? timeLabel(updatedAt.toISOString()) : "--:--"}`}
              </div>
              {fullscreen ? (
                <a
                  href="/admin"
                  className="inline-flex h-10 items-center gap-2 border border-[#30363D] bg-[#0A0C10] px-3 text-xs font-black uppercase text-[#C9D1D9] transition-colors hover:border-[#58A6FF]/60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Admin
                </a>
              ) : (
                <a
                  href="/admin/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 border border-[#30363D] bg-[#0A0C10] px-3 text-xs font-black uppercase text-[#C9D1D9] transition-colors hover:border-[#58A6FF]/60"
                >
                  <Maximize2 className="h-4 w-4" />
                  Expandir
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-10 items-center gap-2 border border-[#58A6FF]/35 bg-[#58A6FF]/10 px-3 text-xs font-black uppercase text-[#58A6FF] transition-colors hover:border-[#58A6FF]"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar
              </button>
            </div>
          </div>
        </header>

        <section
          className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", fullscreen ? "mt-3" : "mt-5")}
        >
          <MetricCard
            icon={ShoppingBag}
            label="Pedidos ativos"
            value={String(stats.criados.length)}
            sub={`${stats.hojeList.length} para hoje`}
            tone="blue"
          />
          <MetricCard
            icon={Clock3}
            label="Pagamento aberto"
            value={formatBRL(amount(stats.pendentes))}
            sub={`${stats.pendentes.length} pedidos aguardando`}
            tone="amber"
          />
          <MetricCard
            icon={Boxes}
            label="Na linha"
            value={String(activeThroughput)}
            sub={`Gargalo: ${stats.gargalo}`}
            tone="green"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Finalizados"
            value={percent(stats.finalizados.length, stats.criados.length)}
            sub={`${stats.finalizados.length} concluidos`}
            tone="dark"
          />
        </section>

        <section
          className={cn("border border-[#30363D] bg-[#0D1117]", fullscreen ? "mt-3" : "mt-5")}
        >
          <div className="flex flex-col gap-2 border-b border-[#30363D] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#58A6FF]" />
              <div>
                <h2 className="font-sans text-sm font-black uppercase text-[#F0F6FC]">Filtros</h2>
                <p className="mt-1 text-xs text-[#8B949E]">
                  {filteredBase.length} de {base.length} pedidos exibidos
                  {filterCount ? ` - ${filterCount} filtro(s) ativo(s)` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setSelectedOrder(null);
              }}
              className="inline-flex h-9 items-center gap-2 border border-[#30363D] px-3 text-xs font-black uppercase text-[#8B949E] transition-colors hover:border-[#F85149]/50 hover:text-[#F85149]"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
          <div className={cn("grid gap-3 p-4", fullscreen ? "xl:grid-cols-8" : "lg:grid-cols-4")}>
            <label className="lg:col-span-2">
              <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase text-[#8B949E]">
                <Search className="h-3.5 w-3.5" />
                Busca
              </span>
              <input
                value={filters.busca}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, busca: event.target.value }))
                }
                placeholder="Cliente, telefone, produto, ID..."
                className="h-10 w-full border border-[#30363D] bg-[#0A0C10] px-3 text-sm font-semibold text-[#F0F6FC] outline-none transition-colors placeholder:text-[#8B949E] focus:border-[#58A6FF]"
              />
            </label>
            <FilterInput
              icon={CalendarDays}
              label="Data execução"
              type="date"
              value={filters.dataExecucao}
              onChange={(value) => setFilters((current) => ({ ...current, dataExecucao: value }))}
            />
            <FilterSelect
              label="Tipo"
              value={filters.tipo}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  tipo: value as DashboardFilters["tipo"],
                }))
              }
              options={[
                ["", "Todos"],
                ["delivery", "Entrega"],
                ["retirada", "Retirada"],
              ]}
            />
            <FilterInput
              label="Criado de"
              type="date"
              value={filters.criadoInicio}
              onChange={(value) => setFilters((current) => ({ ...current, criadoInicio: value }))}
            />
            <FilterInput
              label="Criado até"
              type="date"
              value={filters.criadoFim}
              onChange={(value) => setFilters((current) => ({ ...current, criadoFim: value }))}
            />
            <FilterSelect
              label="Pagamento"
              value={filters.pagamento}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  pagamento: value as DashboardFilters["pagamento"],
                }))
              }
              options={[
                ["", "Todos"],
                ["aprovado", "Pago"],
                ["aguardando", "Aguardando"],
                ["vencido", "Vencido"],
                ["cancelado", "Cancelado"],
                ["rascunho", "Rascunho"],
                ["abandonado", "Abandonado"],
              ]}
            />
            <FilterSelect
              label="Etapa"
              value={filters.etapa}
              onChange={(value) =>
                setFilters((current) => ({ ...current, etapa: value as DashboardFilters["etapa"] }))
              }
              options={[
                ["", "Todas"],
                ["confirmado", "Confirmado"],
                ["em_preparo", "Em preparo"],
                ["pronto", "Pronto"],
                ["finalizado", "Finalizado"],
              ]}
            />
            <FilterSelect
              label="Setor"
              value={filters.setor}
              onChange={(value) => setFilters((current) => ({ ...current, setor: value }))}
              options={[
                ["", "Todos"],
                ...sectors.map((sector) => [sector.value, sector.label] as const),
              ]}
            />
          </div>
        </section>

        <section
          className={cn(
            "overflow-hidden border border-[#30363D] bg-[#0D1117]",
            fullscreen ? "mt-3" : "mt-5",
          )}
        >
          <div className="flex flex-col gap-2 border-b border-[#30363D] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-sm font-black uppercase text-[#F0F6FC]">
                Fluxo de status dos pedidos
              </h2>
              <p className="mt-1 text-xs text-[#8B949E]">
                Clique em uma etapa para focar os pedidos e acompanhar onde a operacao esta
                concentrada.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
              <Legend tone="green" label="evento principal" />
              <Legend tone="blue" label="acao operacional" />
              <Legend tone="danger" label="excecao" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-[#30363D] px-4 py-3 scrollbar-hide">
            {nodes
              .filter((node) => node.id !== "cancelamento")
              .map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className={cn(
                    "shrink-0 border px-3 py-2 text-left transition-all",
                    selectedNodeId === node.id
                      ? "border-[#58A6FF] bg-[#58A6FF]/15 text-[#F0F6FC]"
                      : "border-[#30363D] bg-[#0A0C10] text-[#8B949E] hover:border-[#58A6FF]/50 hover:text-[#C9D1D9]",
                  )}
                >
                  <div className="text-[10px] font-black uppercase">{node.title}</div>
                  <div className="mt-1 font-mono text-sm font-black">{node.count}</div>
                </button>
              ))}
          </div>
          <ReactFlowProvider>
            <OpsFlowBoard
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectStage={setSelectedNodeId}
              fullscreen={fullscreen}
            />
          </ReactFlowProvider>
        </section>

        <section
          className={cn(
            "grid gap-4",
            fullscreen ? "mt-3 2xl:grid-cols-[1.35fr_0.65fr]" : "mt-5 xl:grid-cols-[1.25fr_0.75fr]",
          )}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {buckets.map((bucket) => (
              <BucketCard
                key={bucket.id}
                bucket={bucket}
                onSelectOrder={(item) => setSelectedOrder(item)}
              />
            ))}
          </div>

          <div className="border border-[#30363D] bg-[#0D1117]">
            <div className="flex items-center justify-between gap-3 border-b border-[#30363D] px-4 py-3">
              <div>
                <h2 className="font-sans text-sm font-black uppercase text-[#F0F6FC]">
                  Foco: {selectedNode ? NODE_LABEL[selectedNode.id] : "Etapa"}
                </h2>
                <p className="mt-1 text-xs text-[#8B949E]">
                  {selectedItems.length} pedido(s) nesta posicao da linha.
                </p>
              </div>
              <Route className="h-5 w-5 text-[#58A6FF]" />
            </div>
            <div>
              {loading ? (
                <EmptyLine text="Carregando pedidos..." />
              ) : selectedItems.length === 0 ? (
                <EmptyLine text="Nenhum pedido nesta etapa." />
              ) : (
                selectedItems
                  .slice(0, 8)
                  .map((item) => (
                    <QueueRow
                      key={item.row.id}
                      item={item}
                      active={selectedOrder?.row.id === item.row.id}
                      onSelect={() => setSelectedOrder(item)}
                    />
                  ))
              )}
            </div>
          </div>
        </section>

        {selectedOrder ? (
          <OrderInspector
            item={selectedOrder}
            saving={saving}
            onClose={() => setSelectedOrder(null)}
            onMarkPaid={() =>
              void mutateSelected((id) => marcarComoPago([id]), "Pedido marcado como pago")
            }
            onAdvance={() =>
              void mutateSelected((id) => avancarEtapaPedidos([id]), "Etapa avançada")
            }
          />
        ) : null}

        <section className="mt-4 border border-[#30363D] bg-[#0D1117]">
          <div className="flex items-center justify-between gap-3 border-b border-[#30363D] px-4 py-3">
            <div>
              <h2 className="font-sans text-sm font-black uppercase text-[#F0F6FC]">
                Proximos da fila
              </h2>
              <p className="mt-1 text-xs text-[#8B949E]">
                Ordenado por data e horario de execucao.
              </p>
            </div>
            <Truck className="h-5 w-5 text-[#3FB950]" />
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyLine text="Carregando pedidos..." />
              </div>
            ) : nextOrders.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyLine text="Nenhum pedido aprovado em aberto." />
              </div>
            ) : (
              nextOrders.map((item) => (
                <QueueRow
                  key={item.row.id}
                  item={item}
                  compact
                  active={selectedOrder?.row.id === item.row.id}
                  onSelect={() => setSelectedOrder(item)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterInput({
  icon: Icon,
  label,
  type,
  value,
  onChange,
}: {
  icon?: typeof CalendarDays;
  label: string;
  type: "date" | "text";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase text-[#8B949E]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full border border-[#30363D] bg-[#0A0C10] px-3 text-sm font-semibold text-[#F0F6FC] outline-none transition-colors focus:border-[#58A6FF]"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      <span className="mb-1.5 block text-[10px] font-black uppercase text-[#8B949E]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full border border-[#30363D] bg-[#0A0C10] px-3 text-sm font-semibold text-[#F0F6FC] outline-none transition-colors focus:border-[#58A6FF]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  sub: string;
  tone: "blue" | "amber" | "green" | "dark";
}) {
  const toneClass = {
    blue: "border-[#58A6FF]/30 bg-[#58A6FF]/10 text-[#58A6FF]",
    amber: "border-[#D29922]/30 bg-[#D29922]/10 text-[#D29922]",
    green: "border-[#3FB950]/30 bg-[#3FB950]/10 text-[#3FB950]",
    dark: "border-[#30363D] bg-[#161B22] text-[#C9D1D9]",
  }[tone];

  return (
    <div className="border border-[#30363D] bg-[#0D1117] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-[#8B949E]">{label}</div>
          <div className="mt-2 font-mono text-2xl font-black text-[#F0F6FC]">{value}</div>
        </div>
        <span className={cn("flex h-10 w-10 items-center justify-center border", toneClass)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 border-t border-[#30363D]/65 pt-3 text-xs font-semibold text-[#8B949E]">
        {sub}
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: "green" | "blue" | "danger"; label: string }) {
  const colors = {
    green: "bg-[#3FB950]",
    blue: "bg-[#58A6FF]",
    danger: "bg-[#F85149]",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[#8B949E]">
      <span className={cn("h-2 w-2", colors[tone])} />
      {label}
    </span>
  );
}

const nodeTypes: NodeTypes = { ops: OpsFlowNode };
const edgeTypes: EdgeTypes = { oracle: OracleEdge };

const palette = [
  { label: "Nova etapa", subtitle: "manual", tone: "blue" as const },
  { label: "Inspeção", subtitle: "qualidade", tone: "green" as const },
  { label: "Atenção", subtitle: "gargalo", tone: "danger" as const },
];

function toOpsNode(
  node: FlowNode,
  selectedNodeId: FlowNodeId,
  onSelectStage: (id: FlowNodeId) => void,
): OpsNode {
  return {
    id: node.id,
    type: "ops",
    position: { x: node.x * 1.42, y: node.y * 1.34 },
    data: {
      title: node.title,
      subtitle: node.subtitle,
      count: node.count,
      amount: node.amount,
      tone: node.tone,
      stageId: node.id,
      active: selectedNodeId === node.id,
      onSelect: onSelectStage,
    },
  };
}

function initialEdges(): OpsEdge[] {
  const edge = (
    source: FlowNodeId,
    target: FlowNodeId,
    tone: OpsEdgeData["tone"] = "primary",
  ): OpsEdge => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "oracle",
    data: { tone },
  });

  return [
    edge("criado", "pendente"),
    edge("pendente", "aprovado"),
    edge("aprovado", "producao"),
    edge("producao", "separacao"),
    edge("separacao", "entrega"),
    edge("entrega", "rota"),
    edge("rota", "finalizado"),
    edge("separacao", "retirada"),
    edge("retirada", "finalizado", "muted"),
    edge("producao", "cancelamento", "muted"),
    edge("cancelamento", "cancelado", "danger"),
  ];
}

function OpsFlowBoard({
  nodes,
  selectedNodeId,
  onSelectStage,
  fullscreen,
}: {
  nodes: FlowNode[];
  selectedNodeId: FlowNodeId;
  onSelectStage: (id: FlowNodeId) => void;
  fullscreen: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const makeNode = useCallback(
    (node: FlowNode) => toOpsNode(node, selectedNodeId, onSelectStage),
    [onSelectStage, selectedNodeId],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<OpsNode>(nodes.map(makeNode));
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<OpsEdge>(initialEdges());

  useEffect(() => {
    setRfNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      const stageIds = new Set(nodes.map((node) => node.id));
      const synced = nodes.map((node) => {
        const next = makeNode(node);
        const previous = currentById.get(node.id);
        return previous ? { ...next, position: previous.position } : next;
      });
      const loose = current.filter((node) => !stageIds.has(node.id as FlowNodeId));
      return [...synced, ...loose];
    });
  }, [makeNode, nodes, setRfNodes]);

  useEffect(() => {
    const baseEdgeIds = new Set(initialEdges().map((edge) => edge.id));
    setRfEdges((current) => {
      const custom = current.filter((edge) => !baseEdgeIds.has(edge.id));
      return [...initialEdges(), ...custom];
    });
  }, [setRfEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setRfEdges((edges) =>
        addEdge(
          {
            ...connection,
            type: "oracle",
            data: { tone: "success" },
          },
          edges,
        ),
      ),
    [setRfEdges],
  );

  const onDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    item: (typeof palette)[number],
  ) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      const item = JSON.parse(raw) as (typeof palette)[number];
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: OpsNode = {
        id: `ops-${Date.now()}`,
        type: "ops",
        position,
        data: {
          title: item.label,
          subtitle: item.subtitle,
          count: 0,
          tone: item.tone,
        },
      };
      setRfNodes((current) => [...current, newNode]);
    },
    [screenToFlowPosition, setRfNodes],
  );

  const resetLayout = () => {
    setRfNodes((current) => {
      const custom = current.filter((node) => !nodes.some((stage) => stage.id === node.id));
      return [...nodes.map(makeNode), ...custom];
    });
    window.setTimeout(() => fitView({ padding: 0.18, duration: 420 }), 0);
  };

  const removeLooseNodes = () => {
    const stageIds = new Set(nodes.map((node) => node.id));
    setRfNodes((current) => current.filter((node) => stageIds.has(node.id as FlowNodeId)));
    setRfEdges(initialEdges());
  };

  return (
    <div className="grid border-t border-[#30363D] lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-[#30363D] bg-[#0A0C10] p-3 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-[#F0F6FC]">
          <GitBranchPlus className="h-4 w-4 text-[#58A6FF]" />
          Drag and drop
        </div>
        <div className="space-y-2">
          {palette.map((item) => (
            <button
              key={item.label}
              type="button"
              draggable
              onDragStart={(event) => onDragStart(event, item)}
              className={cn(
                "flex w-full cursor-grab items-center justify-between border px-3 py-2 text-left active:cursor-grabbing",
                NODE_CLASS[item.tone],
              )}
            >
              <span>
                <span className="block text-xs font-black">{item.label}</span>
                <span className="block text-[10px] font-bold uppercase opacity-75">
                  {item.subtitle}
                </span>
              </span>
              <Plus className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={resetLayout}
            className="border border-[#30363D] px-3 py-2 text-xs font-black uppercase text-[#C9D1D9] transition-colors hover:border-[#58A6FF]/60"
          >
            Auto organizar
          </button>
          <button
            type="button"
            onClick={removeLooseNodes}
            className="border border-[#30363D] px-3 py-2 text-xs font-black uppercase text-[#8B949E] transition-colors hover:border-[#F85149]/60 hover:text-[#F85149]"
          >
            Limpar livres
          </button>
        </div>
      </aside>
      <div
        ref={wrapperRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={cn(
          "dashboard-flow-canvas bg-[#080B10]",
          fullscreen ? "h-[min(58vh,720px)] min-h-[520px]" : "h-[460px]",
        )}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "oracle",
          }}
        >
          <Background gap={28} color="rgba(88,166,255,0.14)" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={(node) =>
              node.data?.tone === "danger"
                ? "#F85149"
                : node.data?.tone === "blue"
                  ? "#58A6FF"
                  : "#3FB950"
            }
          />
        </ReactFlow>
      </div>
    </div>
  );
}

function OracleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<OpsEdge>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const tone = data?.tone ?? "primary";

  return (
    <g className={cn("oracle-edge-group", selected && "oracle-edge-selected")}>
      <path d={edgePath} className="oracle-edge-hit" />
      <path id={id} d={edgePath} className={cn("oracle-edge-line", `oracle-edge-${tone}`)} />
    </g>
  );
}

function OpsFlowNode({ data }: NodeProps<OpsNode>) {
  const handleSelect = () => {
    if (data.stageId) data.onSelect?.(data.stageId);
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={cn(
        "dashboard-node relative flex min-h-[104px] w-[184px] flex-col justify-between border px-4 py-3 text-center shadow-[0_14px_28px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:border-[#58A6FF]",
        NODE_CLASS[data.tone],
        data.active && "dashboard-node-active",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-5px] !h-2.5 !w-2.5 !border !border-[#0D1117] !bg-[#58A6FF]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-5px] !h-2.5 !w-2.5 !border !border-[#0D1117] !bg-[#3FB950]"
      />
      {data.count > 0 ? <span className="dashboard-node-ping" aria-hidden /> : null}
      <div className="font-mono text-lg font-black leading-none">{data.count}</div>
      <div className="text-[12px] font-black leading-tight">{data.title}</div>
      <div className="text-[10px] font-bold uppercase opacity-75">{data.subtitle}</div>
      {typeof data.amount === "number" && data.amount > 0 ? (
        <div className="truncate font-mono text-[10px] font-bold opacity-80">
          {formatBRL(data.amount)}
        </div>
      ) : null}
    </button>
  );
}

function BucketCard({
  bucket,
  onSelectOrder,
}: {
  bucket: Bucket;
  onSelectOrder: (item: Linha) => void;
}) {
  const Icon = bucket.icon;
  return (
    <div className="border border-[#30363D] bg-[#0D1117]">
      <div className="flex items-start justify-between gap-3 border-b border-[#30363D] px-4 py-3">
        <div>
          <h3 className="font-sans text-sm font-black uppercase text-[#F0F6FC]">{bucket.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#8B949E]">{bucket.description}</p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center border",
            BUCKET_CLASS[bucket.tone],
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="font-mono text-2xl font-black text-[#F0F6FC]">{bucket.items.length}</div>
          <div className="text-right text-[11px] font-bold uppercase text-[#8B949E]">
            {formatBRL(amount(bucket.items))}
          </div>
        </div>
        <div className="space-y-2">
          {bucket.items.slice(0, 3).map((item) => (
            <MiniOrder key={item.row.id} item={item} onSelect={() => onSelectOrder(item)} />
          ))}
          {bucket.items.length === 0 ? <EmptyLine text="Sem pedidos aqui." compact /> : null}
          {bucket.items.length > 3 ? (
            <div className="border-t border-[#30363D]/65 pt-2 text-xs font-bold text-[#8B949E]">
              +{bucket.items.length - 3} pedidos nesta etapa
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniOrder({ item, onSelect }: { item: Linha; onSelect?: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 border border-[#30363D]/70 bg-[#161B22] px-3 py-2 text-left transition-colors hover:border-[#58A6FF]/50"
    >
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-[#C9D1D9]">{item.op.recipientName}</div>
        <div className="mt-0.5 truncate text-[11px] text-[#8B949E]">
          #{item.row.id.slice(0, 8)} - {deliveryOrPickupLabel(item.row.tipo)}
        </div>
      </div>
      <div className="shrink-0 font-mono text-xs font-black text-[#F0F6FC]">
        {formatBRL(Number(item.row.total))}
      </div>
    </button>
  );
}

function QueueRow({
  item,
  compact = false,
  active = false,
  onSelect,
}: {
  item: Linha;
  compact?: boolean;
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-[#30363D]/70 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#58A6FF]/8",
        compact && "border-r",
        active && "bg-[#58A6FF]/12",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-[#F0F6FC]">{item.op.recipientName}</div>
          <div className="mt-1 truncate text-xs text-[#8B949E]">
            {item.row.cesta?.nome ?? "Pedido sem cesta"}
          </div>
        </div>
        <span className="shrink-0 border border-[#58A6FF]/35 bg-[#58A6FF]/10 px-2 py-1 text-[10px] font-black uppercase text-[#58A6FF]">
          {currentStageLabel(item.op)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#8B949E]">
        <span>{dateLabel(item.op.executionAt)}</span>
        <ArrowRight className="h-3 w-3 text-[#30363D]" />
        <span>{timeLabel(item.op.executionAt)}</span>
        <ArrowRight className="h-3 w-3 text-[#30363D]" />
        <span className="inline-flex items-center gap-1">
          <Truck className="h-3.5 w-3.5" />
          {deliveryOrPickupLabel(item.row.tipo)}
        </span>
      </div>
    </button>
  );
}

function OrderInspector({
  item,
  saving,
  onClose,
  onMarkPaid,
  onAdvance,
}: {
  item: Linha;
  saving: boolean;
  onClose: () => void;
  onMarkPaid: () => void;
  onAdvance: () => void;
}) {
  const { row, op } = item;
  const canMarkPaid = op.paymentStatusNormalized !== "aprovado" && !isCanceled(op);
  const canAdvance =
    op.paymentStatusNormalized === "aprovado" && op.fulfillmentStage !== "finalizado";

  return (
    <section className="mt-4 border border-[#58A6FF]/40 bg-[#0D1117] shadow-[0_0_28px_rgba(88,166,255,0.12)]">
      <div className="flex flex-col gap-3 border-b border-[#30363D] px-4 py-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-mono text-[10px] font-black uppercase text-[#58A6FF]">
            Pedido selecionado
          </div>
          <h2 className="mt-1 font-sans text-lg font-black text-[#F0F6FC]">{op.recipientName}</h2>
          <p className="mt-1 text-xs text-[#8B949E]">
            #{row.id.slice(0, 8)} - {row.cesta?.nome ?? "Pedido sem cesta"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMarkPaid ? (
            <button
              type="button"
              disabled={saving}
              onClick={onMarkPaid}
              className="inline-flex h-9 items-center gap-2 border border-[#3FB950]/40 bg-[#3FB950]/10 px-3 text-xs font-black uppercase text-[#3FB950] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar pago
            </button>
          ) : null}
          {canAdvance ? (
            <button
              type="button"
              disabled={saving}
              onClick={onAdvance}
              className="inline-flex h-9 items-center gap-2 border border-[#58A6FF]/40 bg-[#58A6FF]/10 px-3 text-xs font-black uppercase text-[#58A6FF] disabled:opacity-50"
            >
              <ArrowRight className="h-4 w-4" />
              Avançar etapa
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-2 border border-[#30363D] px-3 text-xs font-black uppercase text-[#8B949E] hover:border-[#F85149]/50 hover:text-[#F85149]"
          >
            <X className="h-4 w-4" />
            Fechar
          </button>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        <DetailBlock label="Etapa" value={currentStageLabel(op)} />
        <DetailBlock label="Pagamento" value={paymentLabel(op.paymentStatusNormalized)} />
        <DetailBlock label="Valor" value={formatBRL(Number(row.total))} />
        <DetailBlock label="Tipo" value={deliveryOrPickupLabel(row.tipo)} />
        <DetailBlock
          label="Execução"
          value={`${dateLabel(op.executionAt)} ${timeLabel(op.executionAt)}`}
        />
        <DetailBlock label="Setor" value={op.productionSector ?? "Sem setor"} />
        <DetailBlock label="Telefone" value={op.recipientPhone || row.cliente_whatsapp} />
        <DetailBlock
          label="Criado em"
          value={`${dateLabel(row.criado_em)} ${timeLabel(row.criado_em)}`}
        />
        <DetailBlock label="Local" value={row.endereco_ou_unidade || "Sem local"} wide />
      </div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("border-b border-r border-[#30363D]/70 px-4 py-3", wide && "md:col-span-3")}>
      <div className="text-[10px] font-black uppercase text-[#8B949E]">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-[#F0F6FC]">{value}</div>
    </div>
  );
}

function EmptyLine({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "text-center text-xs font-semibold text-[#8B949E]",
        compact ? "py-2" : "px-4 py-10",
      )}
    >
      {text}
    </div>
  );
}
