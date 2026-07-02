import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import {
  listarPedidosPorToken,
  editarPedidoPorToken,
  rowToPedidoSalvo,
  rowToPedidoOperacional,
  conciliarPagamentosAsaas,
  excluirPedido,
  arquivarPedidos,
  desarquivarPedidos,
  atualizarPedidoOperacao,
  type PedidoRow,
} from "@/lib/pedidos";
import { buscarInfoToken } from "@/lib/shareToken";
import type { PedidoSalvo } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Printer,
  Eye,
  MessageCircle,
  LayoutList,
  Columns,
  Table2,
  CalendarDays,
  X,
  Pencil,
  AlertTriangle,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { labelStatusPagamento, labelTipoPedido } from "@/lib/asaasStatus";
import { isOperacaoPedidosEnabled } from "@/lib/featureFlags";
import {
  agruparPorExecucao,
  contarAprovadosOperacionais,
  filtrarPedidosOperacionais,
  sortPedidosPorCriadoDesc,
  SETOR_LABEL,
  type FiltrosOperacionais,
  type PedidoOperacional,
} from "@/lib/operacaoPedido";
import { PAYMENT_STATUS_LABEL } from "@/lib/paymentStatus";
import { OperacaoFiltrosBar } from "@/components/operacao/OperacaoFiltrosBar";
import {
  grupoLabelFromIso,
  OperacaoGrupoExecucao,
} from "@/components/operacao/OperacaoPedidoCard";
import { useAdmin } from "@/store/admin";
import { SignInPage } from "@/components/admin/SignInPage";
import { AccessDenied } from "@/components/admin/AccessDenied";
import { EncomendasTable } from "@/components/operacao/EncomendasTable";
import { EncomendasCalendario } from "@/components/operacao/EncomendasCalendario";
import { PlanilhaFiltrosBar } from "@/components/operacao/PlanilhaFiltrosBar";
import {
  ENCOMENDAS_CSV_HEAD,
  flattenPedidosParaLinhas,
  linhasParaCsvRows,
  ENTREGA_MOTOBOY_ID,
  locaisPlanilhaOpcoes,
} from "@/lib/encomendasTable";
import {
  FILTROS_PLANILHA_VAZIOS,
  filtrarLinhasEncomenda,
  filtrosPlanilhaAtivos,
  produtosUnicosDasLinhas,
  type FiltrosPlanilha,
} from "@/lib/planilhaFiltros";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { dataEntregaParaIso } from "@/lib/dateUtils";

export const Route = createFileRoute("/pedidos/$token")({
  head: () => ({
    meta: [
      { title: "Pedidos — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CozinhaPage,
});

// ── Helpers ────────────────────────────────────────────────────────────────

type ViewMode = "lista" | "kanban" | "planilha" | "calendario";

type StatusKey = "aprovado" | "pendente" | "rascunho" | "abandonado";

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; header: string }> = {
  aprovado:   { label: "Aprovado",            bg: "bg-olive/15 text-olive",               header: "bg-olive text-white" },
  pendente:   { label: "Aguardando pagamento", bg: "bg-terracotta/20 text-charcoal",       header: "bg-terracotta text-white" },
  rascunho:   { label: "Em preenchimento",     bg: "bg-charcoal/10 text-charcoal",         header: "bg-charcoal text-white" },
  abandonado: { label: "Abandonado",           bg: "bg-terracotta/15 text-terracotta",     header: "bg-muted text-charcoal" },
};

const STATUS_ALIASES: Record<string, StatusKey> = {
  // Asaas (maiúsculo)
  CONFIRMED: "aprovado",
  RECEIVED: "aprovado",
  PENDING: "pendente",
  OVERDUE: "pendente",
  REFUNDED: "abandonado",
  PAYMENT_DELETED: "abandonado",
  CHARGEBACK_REQUESTED: "abandonado",
  CHARGEBACK_DISPUTE: "abandonado",
  // Internos (minúsculo)
  aprovado: "aprovado",
  pago: "aprovado",
  recebido: "aprovado",
  pendente: "pendente",
  aguardando: "pendente",
  aguardando_pagamento: "pendente",
  rascunho: "rascunho",
  abandonado: "abandonado",
  cancelado: "abandonado",
};

function getStatus(p: PedidoSalvo): StatusKey {
  const s = p.pagamento?.status || "";
  return STATUS_ALIASES[s] ?? STATUS_ALIASES[s.toLowerCase()] ?? "rascunho";
}

function entregaIsoDoPedido(p: PedidoSalvo, raw?: PedidoRow): string | null {
  return dataEntregaParaIso(p.data ?? raw?.data_entrega);
}

function horaNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Main component ─────────────────────────────────────────────────────────

function CozinhaPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading, canAccessCozinha } = useAuth();
  const operacaoEnabled = isOperacaoPedidosEnabled();
  const unidades = useAdmin((s) => s.unidades);

  const [pedidos, setPedidos] = useState<PedidoSalvo[]>([]);
  const [pedidosOps, setPedidosOps] = useState<PedidoOperacional[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);
  const [imprimindo, setImprimindo] = useState<PedidoSalvo[] | null>(null);
  const [campanhaInfo, setCampanhaInfo] = useState<{ campanha_id: string | null; nome: string | null } | null>(null);

  // Edição
  const [editando, setEditando] = useState<PedidoSalvo | null>(null);
  const [editForm, setEditForm] = useState({
    clienteNome: "",
    clienteWhatsapp: "",
    enderecoOuUnidade: "",
    data: "",
    horario: "",
    temDestinatario: false,
    destinatarioNome: "",
    destinatarioWhatsapp: "",
  });
  const [editConfirm, setEditConfirm] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // view mode
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "planilha";
    const saved = localStorage.getItem("pedidos-view");
    if (saved === "lista" || saved === "kanban" || saved === "planilha" || saved === "calendario") {
      return saved;
    }
    return "planilha";
  });

  const [rawRows, setRawRows] = useState<PedidoRow[]>([]);

  // filtros
  const [filtroStatus, setFiltroStatus] = useState<StatusKey[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"" | "delivery" | "retirada">("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroPolaroid, setFiltroPolaroid] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"hoje" | "ontem" | "semana" | "mes" | "">("");
  const [filtrosPlanilha, setFiltrosPlanilha] = useState<FiltrosPlanilha>(FILTROS_PLANILHA_VAZIOS);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtrosOps, setFiltrosOps] = useState<FiltrosOperacionais>(() =>
    operacaoEnabled
      ? {
          status: ["aprovado"],
          mostrarArquivados: false,
          mostrarTestes: false,
          ordenacao: "criado_desc",
        }
      : {},
  );
  const [pendencias, setPendencias] = useState<
    {
      id: string;
      cliente_nome: string;
      payment_status_raw: string | null;
      payment_status_normalized: string | null;
      payment_confirmed_at: string | null;
    }[]
  >([]);

  const [loginLoading, setLoginLoading] = useState(false);
  const [confirmExcluirLote, setConfirmExcluirLote] = useState(false);
  const [confirmaTextoExcluir, setConfirmaTextoExcluir] = useState("");
  const [excluirLoteLoading, setExcluirLoteLoading] = useState(false);
  const [confirmArquivarLote, setConfirmArquivarLote] = useState(false);
  const [arquivarLoteLoading, setArquivarLoteLoading] = useState(false);
  const [salvandoOperacaoId, setSalvandoOperacaoId] = useState<string | null>(null);

  // som
  const [somAtivo, setSomAtivo] = useState(false);
  const somAtivoRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pedidosIdsRef = useRef<Set<string>>(new Set());

  function tocarSino() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  }

  // ── Refresh estável: não recria o interval ao mudar carregar ──────────────
  const carregarRef = useRef<(() => Promise<void>) | undefined>(undefined);
  carregarRef.current = async () => {
    setCarregando(true);
    try {
      if (operacaoEnabled) {
        await conciliarPagamentosAsaas();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch("/api/admin/conciliacao-pendencias", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = (await res.json()) as { pendencias?: typeof pendencias };
            setPendencias(json.pendencias ?? []);
          }
        }
      }
      const rows: PedidoRow[] = await listarPedidosPorToken(token);
      const prevIds = pedidosIdsRef.current;
      if (prevIds.size > 0 && somAtivoRef.current) {
        const temNovo = rows.some((r) => !prevIds.has(r.id));
        if (temNovo) tocarSino();
      }
      pedidosIdsRef.current = new Set(rows.map((r) => r.id));
      setRawRows(rows);
      setPedidos(sortPedidosPorCriadoDesc(rows.map(rowToPedidoSalvo)));
      setPedidosOps(sortPedidosPorCriadoDesc(rows.map(rowToPedidoOperacional)));
      setUltimaAtualizacao(horaNow());
    } catch {
      // token inválido ou sem permissão
    }
    setCarregando(false);
  };

  useEffect(() => {
    buscarInfoToken(token).then((info) => {
      if (info) {
        setCampanhaInfo(info);
        if (info.nome) document.title = `Pedidos · ${info.nome}`;
      }
    });
  }, [token]);

  useEffect(() => {
    if (!user) return;
    carregarRef.current?.();

    const channel = supabase
      .channel("pedidos-cozinha")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        carregarRef.current?.();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos" }, () => {
        carregarRef.current?.();
      })
      .subscribe();

    // fallback polling caso Realtime não funcione por RLS
    const id = setInterval(() => carregarRef.current?.(), 30_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [user, token]);

  useEffect(() => {
    if (!user || !operacaoEnabled) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch("/api/admin/arquivar-pedidos", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    })();
  }, [user, operacaoEnabled]);

  // ── Filtros aplicados ─────────────────────────────────────────────────────
  const pedidosOpsFiltrados = useMemo(() => {
    if (!operacaoEnabled) return [];
    return filtrarPedidosOperacionais(pedidosOps, {
      ...filtrosOps,
      busca: filtroTexto || filtrosOps.busca,
      criadoInicio: filtroInicio || filtrosOps.criadoInicio,
      criadoFim: filtroFim || filtrosOps.criadoFim,
    });
  }, [operacaoEnabled, pedidosOps, filtrosOps, filtroTexto, filtroInicio, filtroFim]);

  const operacaoGrupos = useMemo(
    () => (operacaoEnabled ? agruparPorExecucao(pedidosOpsFiltrados) : []),
    [operacaoEnabled, pedidosOpsFiltrados],
  );

  const contagemAprovadosOps = useMemo(
    () => (operacaoEnabled ? contarAprovadosOperacionais(pedidosOps) : 0),
    [operacaoEnabled, pedidosOps],
  );

  const rawRowsById = useMemo(() => new Map(rawRows.map((r) => [r.id, r])), [rawRows]);

  const pedidosSemFiltroData = useMemo(() => {
    const mostrarArq = operacaoEnabled ? !!filtrosOps.mostrarArquivados : mostrarArquivados;
    const filtered = pedidos.filter((p) => {
      if (!mostrarArq && p.archivedAt) return false;
      if (filtroStatus.length > 0 && !filtroStatus.includes(getStatus(p))) return false;
      if (filtroTipo && p.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroPolaroid && !((p.pagamento?.extras?.polaroids?.length ?? 0) > 0)) return false;
      if (filtroTexto) {
        const q = filtroTexto.toLowerCase();
        const hay = `${p.cliente.nome} ${p.cliente.whatsapp} ${p.destinatario?.nome ?? ""} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroInicio && p.criadoEm.slice(0, 10) < filtroInicio) return false;
      if (filtroFim && p.criadoEm.slice(0, 10) > filtroFim) return false;
      return true;
    });
    return sortPedidosPorCriadoDesc(filtered);
  }, [pedidos, operacaoEnabled, filtrosOps.mostrarArquivados, mostrarArquivados, filtroStatus, filtroTipo, filtroPolaroid, filtroTexto, filtroInicio, filtroFim]);

  const pedidosParaCalendario = useMemo(() => {
    const mostrarArq = operacaoEnabled ? !!filtrosOps.mostrarArquivados : mostrarArquivados;
    const filtered = pedidos.filter((p) => {
      if (!mostrarArq && p.archivedAt) return false;
      if (filtroStatus.length > 0 && !filtroStatus.includes(getStatus(p))) return false;
      if (filtroTipo && p.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroPolaroid && !((p.pagamento?.extras?.polaroids?.length ?? 0) > 0)) return false;
      if (filtroTexto) {
        const q = filtroTexto.toLowerCase();
        const hay = `${p.cliente.nome} ${p.cliente.whatsapp} ${p.destinatario?.nome ?? ""} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortPedidosPorCriadoDesc(filtered);
  }, [pedidos, operacaoEnabled, filtrosOps.mostrarArquivados, mostrarArquivados, filtroStatus, filtroTipo, filtroPolaroid, filtroTexto]);

  const pedidosFiltrados = useMemo(() => {
    const base = view === "calendario" ? pedidosParaCalendario : pedidosSemFiltroData;
    if (!filtroData) return base;
    return base.filter((p) => entregaIsoDoPedido(p, rawRowsById.get(p.id)) === filtroData);
  }, [view, pedidosParaCalendario, pedidosSemFiltroData, filtroData, rawRowsById]);

  const contagemPorDiaEntrega = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pedidosParaCalendario) {
      const iso = entregaIsoDoPedido(p, rawRowsById.get(p.id));
      if (!iso) continue;
      map[iso] = (map[iso] ?? 0) + 1;
    }
    return map;
  }, [pedidosParaCalendario, rawRowsById]);

  const listaVisivel = useMemo(
    () => (operacaoEnabled && view === "lista" ? pedidosOpsFiltrados : pedidosFiltrados),
    [operacaoEnabled, view, pedidosOpsFiltrados, pedidosFiltrados],
  );

  const pedidosSelecionados = useMemo(
    () => listaVisivel.filter((p) => selectedIds.has(p.id)),
    [listaVisivel, selectedIds],
  );

  const selecionadosComPagamento = useMemo(
    () => pedidosSelecionados.filter((p) => getStatus(p) === "aprovado"),
    [pedidosSelecionados],
  );

  const selecionadosArquivados = useMemo(
    () => pedidosSelecionados.filter((p) => !!p.archivedAt),
    [pedidosSelecionados],
  );

  const selecionadosNaoArquivados = useMemo(
    () => pedidosSelecionados.filter((p) => !p.archivedAt),
    [pedidosSelecionados],
  );

  const mostrarArquivadosAtivo = operacaoEnabled ? !!filtrosOps.mostrarArquivados : mostrarArquivados;

  const locaisOpcoes = useMemo(() => locaisPlanilhaOpcoes(), []);

  const linhasEncomenda = useMemo(
    () => flattenPedidosParaLinhas(pedidosFiltrados, rawRows, unidades),
    [pedidosFiltrados, rawRows, unidades],
  );

  const linhasVisiveis = useMemo(
    () => filtrarLinhasEncomenda(linhasEncomenda, filtrosPlanilha, locaisOpcoes),
    [linhasEncomenda, filtrosPlanilha, locaisOpcoes],
  );

  const produtosOpcoes = useMemo(
    () => produtosUnicosDasLinhas(linhasEncomenda),
    [linhasEncomenda],
  );

  const pedidosComDataEntrega = useMemo(
    () => pedidosParaCalendario.filter((p) => !!entregaIsoDoPedido(p, rawRowsById.get(p.id))),
    [pedidosParaCalendario, rawRowsById],
  );

  // ── useMemo antes de qualquer return condicional ───────────────────────────
  const porStatus = useMemo(() => {
    const map: Record<StatusKey, PedidoSalvo[]> = {
      aprovado: [], pendente: [], rascunho: [], abandonado: [],
    };
    for (const p of pedidosFiltrados) map[getStatus(p)].push(p);
    return map;
  }, [pedidosFiltrados]);

  // ── Gates ─────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!user) {
    const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (!email || !password) {
        toast.error("Preencha e-mail e senha.");
        return;
      }
      setLoginLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoginLoading(false);
      if (error) {
        toast.error("Falha no login", {
          description:
            error.message === "Invalid login credentials"
              ? "E-mail ou senha incorretos."
              : error.message,
        });
      }
    };

    return (
      <>
        <SignInPage
          heroImageSrc="/img_casa_fachada.jpeg"
          description="Central de Pedidos — Módulo Cozinha"
          loading={loginLoading}
          onSignIn={handleSignIn}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (!canAccessCozinha) {
    return (
      <>
        <AccessDenied
          title="Acesso restrito"
          description="Esta central é exclusiva para usuários da cozinha ou administradores."
          showSignOut
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toaster position="bottom-right" />
      </>
    );
  }

  // ── Edição de pedido ──────────────────────────────────────────────────────
  const abrirEdicao = (p: PedidoSalvo) => {
    setEditForm({
      clienteNome: p.cliente.nome,
      clienteWhatsapp: p.cliente.whatsapp,
      enderecoOuUnidade: p.enderecoOuUnidade,
      data: p.data ?? "",
      horario: p.horario ?? "",
      temDestinatario: !!p.destinatario,
      destinatarioNome: p.destinatario?.nome ?? "",
      destinatarioWhatsapp: p.destinatario?.whatsapp ?? "",
    });
    setEditConfirm(false);
    setDetalhe(null);
    setEditando(p);
  };

  const salvarEdicao = async () => {
    if (!editando || !editConfirm) return;
    setEditLoading(true);
    const destinatario = editForm.temDestinatario
      ? { nome: editForm.destinatarioNome, whatsapp: editForm.destinatarioWhatsapp }
      : null;
    const res = await editarPedidoPorToken(
      token,
      editando.id,
      {
        cliente_nome: editForm.clienteNome,
        cliente_whatsapp: editForm.clienteWhatsapp,
        endereco_ou_unidade: editForm.enderecoOuUnidade,
        data_entrega: editForm.data || null,
        horario: editForm.horario || null,
      },
      destinatario,
    );
    setEditLoading(false);
    if (!res.ok) {
      toast.error(`Erro ao salvar: ${res.error}`);
      return;
    }
    toast.success("Pedido atualizado com sucesso.");
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === editando.id
          ? {
              ...p,
              cliente: { nome: editForm.clienteNome, whatsapp: editForm.clienteWhatsapp },
              enderecoOuUnidade: editForm.enderecoOuUnidade,
              data: editForm.data || undefined,
              horario: editForm.horario || undefined,
              destinatario,
            }
          : p,
      ),
    );
    setEditando(null);
  };

  // ── Helpers de impressão ───────────────────────────────────────────────────
  const imprimirUm = (p: PedidoSalvo) => {
    setImprimindo([p]);
    setTimeout(() => { window.print(); setTimeout(() => setImprimindo(null), 500); }, 50);
  };

  const imprimirAprovadosHoje = () => {
    const hoje = new Date().toDateString();
    const lista = porStatus.aprovado.filter((p) => new Date(p.criadoEm).toDateString() === hoje);
    if (!lista.length) return;
    setImprimindo(lista);
    setTimeout(() => { window.print(); setTimeout(() => setImprimindo(null), 500); }, 50);
  };

  const toggleView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("pedidos-view", v);
  };

  const toggleStatus = (s: StatusKey) => {
    setFiltroStatus((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  function toISO(d: Date) { return d.toISOString().slice(0, 10); }

  const aplicarPeriodo = (p: typeof filtroPeriodo) => {
    const hoje = new Date();
    if (p === "hoje") {
      setFiltroInicio(toISO(hoje)); setFiltroFim(toISO(hoje));
    } else if (p === "ontem") {
      const d = new Date(hoje); d.setDate(d.getDate() - 1);
      setFiltroInicio(toISO(d)); setFiltroFim(toISO(d));
    } else if (p === "semana") {
      const d = new Date(hoje); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      setFiltroInicio(toISO(d)); setFiltroFim(toISO(hoje));
    } else if (p === "mes") {
      setFiltroInicio(toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setFiltroFim(toISO(hoje));
    } else {
      setFiltroInicio(""); setFiltroFim("");
    }
    setFiltroPeriodo(p);
  };

  const exportarCSV = (lista: PedidoSalvo[], nome = "encomendas-casa-almeria") => {
    if (lista.length === 0) { toast.error("Nenhum pedido para exportar."); return; }
    const linhas = flattenPedidosParaLinhas(lista, rawRows, unidades);
    const head = [...ENCOMENDAS_CSV_HEAD];
    const csvRows = linhasParaCsvRows(linhas);
    const bom = "\uFEFF";
    const csv = bom + [head, ...csvRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelecionado = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selecionarTodos = () =>
    setSelectedIds(new Set(listaVisivel.map((p) => p.id)));

  const excluirSelecionados = async () => {
    if (confirmaTextoExcluir !== "EXCLUIR") return;
    const ids = [...selectedIds];
    setExcluirLoteLoading(true);
    const excluidos: string[] = [];
    let falhas = 0;
    for (const id of ids) {
      const res = await excluirPedido(id);
      if (res.ok) excluidos.push(id);
      else falhas += 1;
    }
    setExcluirLoteLoading(false);
    setConfirmExcluirLote(false);
    setConfirmaTextoExcluir("");
    setSelectedIds(new Set());

    if (excluidos.length > 0) {
      const removidos = new Set(excluidos);
      setPedidos((prev) => prev.filter((p) => !removidos.has(p.id)));
      setPedidosOps((prev) => prev.filter((p) => !removidos.has(p.id)));
      setRawRows((prev) => prev.filter((r) => !removidos.has(r.id)));
    }

    if (falhas === 0) {
      toast.success(`${excluidos.length} pedido${excluidos.length !== 1 ? "s" : ""} excluído${excluidos.length !== 1 ? "s" : ""}.`);
    } else if (excluidos.length === 0) {
      toast.error("Nenhum pedido foi excluído.");
    } else {
      toast.warning(`${excluidos.length} excluído(s), ${falhas} falha(s).`);
    }
  };

  const arquivarSelecionados = async () => {
    const ids = selecionadosNaoArquivados.map((p) => p.id);
    if (ids.length === 0) return;
    setArquivarLoteLoading(true);
    const res = await arquivarPedidos(ids);
    setArquivarLoteLoading(false);
    setConfirmArquivarLote(false);
    setSelectedIds(new Set());

    if (!res.ok) {
      toast.error("Erro ao arquivar", { description: res.error });
      return;
    }

    const agora = new Date().toISOString();
    const arquivados = new Set(ids);
    setPedidos((prev) =>
      prev.map((p) => (arquivados.has(p.id) ? { ...p, archivedAt: agora } : p)),
    );
    setPedidosOps((prev) =>
      prev.map((p) => (arquivados.has(p.id) ? { ...p, archivedAt: agora } : p)),
    );
    setRawRows((prev) =>
      prev.map((r) => (arquivados.has(r.id) ? { ...r, archived_at: agora } : r)),
    );
    toast.success(
      `${res.arquivados ?? ids.length} pedido${(res.arquivados ?? ids.length) !== 1 ? "s" : ""} arquivado${(res.arquivados ?? ids.length) !== 1 ? "s" : ""}.`,
    );
  };

  const desarquivarSelecionados = async () => {
    const ids = selecionadosArquivados.map((p) => p.id);
    if (ids.length === 0) return;
    setArquivarLoteLoading(true);
    const res = await desarquivarPedidos(ids);
    setArquivarLoteLoading(false);
    setSelectedIds(new Set());

    if (!res.ok) {
      toast.error("Erro ao desarquivar", { description: res.error });
      return;
    }

    const desarquivados = new Set(ids);
    setPedidos((prev) =>
      prev.map((p) => (desarquivados.has(p.id) ? { ...p, archivedAt: null } : p)),
    );
    setPedidosOps((prev) =>
      prev.map((p) => (desarquivados.has(p.id) ? { ...p, archivedAt: null } : p)),
    );
    setRawRows((prev) =>
      prev.map((r) => (desarquivados.has(r.id) ? { ...r, archived_at: null, archived_by: null } : r)),
    );
    toast.success(
      `${res.desarquivados ?? ids.length} pedido${(res.desarquivados ?? ids.length) !== 1 ? "s" : ""} restaurado${(res.desarquivados ?? ids.length) !== 1 ? "s" : ""}.`,
    );
  };

  const alterarSetorPedido = async (pedidoId: string, setor: SetorOperacional) => {
    const atual = rawRows.find((r) => r.id === pedidoId)?.production_sector;
    if (atual === setor) return;
    setSalvandoOperacaoId(pedidoId);
    const res = await atualizarPedidoOperacao(pedidoId, { production_sector: setor });
    setSalvandoOperacaoId(null);
    if (!res.ok) {
      toast.error("Erro ao atualizar setor", { description: res.error });
      return;
    }
    setRawRows((prev) =>
      prev.map((r) => (r.id === pedidoId ? { ...r, production_sector: setor } : r)),
    );
    setPedidosOps((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, productionSector: setor } : p)),
    );
    toast.success("Setor atualizado.");
  };

  const alterarLocalPedido = async (pedidoId: string, localId: string, label: string) => {
    const atual = rawRows.find((r) => r.id === pedidoId);
    const isEntrega = localId === ENTREGA_MOTOBOY_ID;
    const unidadeId = isEntrega ? null : localId;
    const tipo = isEntrega ? "delivery" : "retirada";
    const endereco =
      isEntrega && atual?.tipo === "delivery" && atual.endereco_ou_unidade?.trim()
        ? atual.endereco_ou_unidade
        : label;

    if (isEntrega) {
      if (atual?.tipo === "delivery" && (atual.unidade_id == null || atual.unidade_id === "")) return;
    } else if (
      atual?.tipo === "retirada" &&
      atual.unidade_id === unidadeId &&
      atual.endereco_ou_unidade === label
    ) {
      return;
    }

    setSalvandoOperacaoId(pedidoId);
    const res = await atualizarPedidoOperacao(pedidoId, {
      unidade_id: unidadeId,
      endereco_ou_unidade: endereco,
      tipo,
    });
    setSalvandoOperacaoId(null);
    if (!res.ok) {
      toast.error("Erro ao atualizar local", { description: res.error });
      return;
    }
    setRawRows((prev) =>
      prev.map((r) =>
        r.id === pedidoId
          ? { ...r, unidade_id: unidadeId, endereco_ou_unidade: endereco, tipo }
          : r,
      ),
    );
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? { ...p, unidadeId: unidadeId ?? undefined, enderecoOuUnidade: endereco, tipo }
          : p,
      ),
    );
    setPedidosOps((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? { ...p, unidadeId: unidadeId ?? undefined, enderecoOuUnidade: endereco, tipo }
          : p,
      ),
    );
    toast.success("Local atualizado.");
  };

  const temFiltro =
    filtroStatus.length > 0 || filtroTipo !== "" || filtroData !== "" || filtroPolaroid ||
    filtroTexto !== "" || filtroInicio !== "" || filtroFim !== "" ||
    filtrosPlanilhaAtivos(filtrosPlanilha);

  const limparFiltrosPlanilha = () => setFiltrosPlanilha(FILTROS_PLANILHA_VAZIOS);

  const limparTodosFiltros = () => {
    setFiltroStatus([]);
    setFiltroTipo("");
    setFiltroData("");
    setFiltroPolaroid(false);
    setFiltroTexto("");
    setFiltroInicio("");
    setFiltroFim("");
    setFiltroPeriodo("");
    setFiltrosPlanilha(FILTROS_PLANILHA_VAZIOS);
  };

  const planilhaLayout = view === "planilha" || view === "calendario";
  const shellClass = planilhaLayout ? "w-full" : "mx-auto max-w-6xl";
  const padX = planilhaLayout ? "px-2 sm:px-3" : "px-4 sm:px-6";

  // ── View ──────────────────────────────────────────────────────────────────
  return (
    <div className={planilhaLayout ? "flex min-h-dvh flex-col bg-linen" : "min-h-screen bg-linen"}>
      <div className={planilhaLayout ? "flex min-h-0 flex-1 flex-col print:hidden" : "print:hidden"}>

        {/* Header */}
        <header className="shrink-0 bg-charcoal text-white">
          <div className={`${shellClass} flex flex-wrap items-center justify-between gap-3 py-3 ${padX}`}>
            <div>
              <h1 className="font-serif text-xl font-bold">
                {campanhaInfo?.nome
                  ? `Pedidos · ${campanhaInfo.nome}`
                  : "Pedidos — Casa Almeria"}
              </h1>
              <p className="text-xs text-white/50">
                {ultimaAtualizacao
                  ? `Atualizado às ${ultimaAtualizacao} · ao vivo`
                  : "Carregando…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle lista/kanban */}
              <div className="flex rounded-lg border border-white/20 p-0.5">
                <button
                  onClick={() => toggleView("planilha")}
                  title="Planilha ENCOMENDAS"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "planilha" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Table2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleView("calendario")}
                  title="Calendário de entregas"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "calendario" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleView("lista")}
                  title="Lista"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "lista" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleView("kanban")}
                  title="Quadro"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "kanban" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Columns className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  if (!audioCtxRef.current) {
                    audioCtxRef.current = new AudioContext();
                  }
                  const next = !somAtivo;
                  setSomAtivo(next);
                  somAtivoRef.current = next;
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  somAtivo
                    ? "bg-white text-charcoal border-white"
                    : "bg-transparent text-white border-white/30 hover:bg-white/10"
                }`}
              >
                {somAtivo ? "🔔 Som ativo" : "🔕 Ativar som"}
              </button>

              <Button variant="outline" onClick={() => carregarRef.current?.()} disabled={carregando}
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button asChild className="bg-olive text-white hover:bg-olive/90">
                <a href="/pedidos/novo" target="_blank" rel="noopener noreferrer">＋ Novo Pedido</a>
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  exportarCSV(
                    operacaoEnabled
                      ? pedidosOpsFiltrados
                      : pedidosFiltrados,
                  )
                }
                disabled={
                  operacaoEnabled
                    ? pedidosOpsFiltrados.length === 0
                    : pedidosFiltrados.length === 0
                }
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                ⬇ Exportar visíveis
              </Button>
              <Button onClick={imprimirAprovadosHoje} disabled={porStatus.aprovado.length === 0}
                className="bg-terracotta text-white hover:bg-terracotta/90">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir aprovados de hoje
              </Button>
              <Button variant="outline" onClick={() => supabase.auth.signOut()}
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* Filtros */}
        <div className={`shrink-0 border-b border-border bg-white ${planilhaLayout ? "" : ""}`}>
          <div className={`${shellClass} space-y-2 py-2 ${padX} ${planilhaLayout ? "space-y-1.5" : "py-3"}`}>

            {operacaoEnabled && pendencias.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Pendências de conciliação ({pendencias.length})
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-950">
                  {pendencias.map((p) => (
                    <li key={p.id}>
                      <span className="font-mono font-semibold">#{p.id.slice(-6).toUpperCase()}</span>
                      {" · "}
                      {p.cliente_nome}
                      {" · "}
                      bruto: {p.payment_status_raw ?? "—"}
                      {" · "}
                      normalizado: {p.payment_status_normalized ?? "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Linha 1: busca + data entrega + polaroid + contagem */}
            <div className={`flex flex-wrap items-center gap-2 ${planilhaLayout ? "gap-1.5" : ""}`}>
              <input
                type="search"
                placeholder="🔍 Buscar por nome, telefone…"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className={`rounded-lg border border-border bg-background py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-charcoal/30 ${
                  planilhaLayout ? "min-w-[10rem] flex-1 sm:max-w-xs" : "w-56 px-3"
                } px-3`}
              />
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Entrega:</label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                {filtroData && (
                  <button onClick={() => setFiltroData("")} className="text-muted-foreground hover:text-charcoal">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!planilhaLayout && (
                <button
                  onClick={() => setFiltroPolaroid((v) => !v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filtroPolaroid ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                  }`}
                >
                  📸 Polaroid
                </button>
              )}
              {!operacaoEnabled && (
                <label className="flex items-center gap-1.5 text-xs text-charcoal">
                  <input
                    type="checkbox"
                    checked={mostrarArquivados}
                    onChange={(e) => setMostrarArquivados(e.target.checked)}
                    className="rounded border-border"
                  />
                  Mostrar arquivados
                </label>
              )}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={selecionarTodos}
                  className="text-xs font-semibold text-charcoal/60 hover:text-charcoal"
                >
                  Selecionar todos
                </button>
                {temFiltro && (
                  <button
                    onClick={() => {
                      setFiltroStatus([]); setFiltroTipo(""); setFiltroData("");
                      setFiltroPolaroid(false); setFiltroTexto("");
                      aplicarPeriodo("");
                    }}
                    className="text-xs font-semibold text-terracotta hover:text-terracotta/80"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Linha 2: status + tipo + período (compacto na planilha) */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${planilhaLayout ? "gap-y-1" : ""}`}>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => {
                  const active = filtroStatus.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors sm:px-3 sm:py-1 sm:text-xs ${
                        active ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                      }`}
                    >
                      {STATUS_CONFIG[s].label}
                      {active && <X className="ml-1 inline h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
              <div className="hidden h-3 w-px bg-border sm:block" />
              <div className="flex flex-wrap gap-1">
                {(["", "delivery", "retirada"] as const).map((t) => (
                  <button
                    key={t || "todos"}
                    onClick={() => setFiltroTipo(t)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors capitalize sm:px-3 sm:py-1 sm:text-xs ${
                      filtroTipo === t ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                    }`}
                  >
                    {t === "" ? "Todos" : labelTipoPedido(t)}
                  </button>
                ))}
              </div>
              {planilhaLayout && (
                <>
                  <div className="hidden h-3 w-px bg-border md:block" />
                  <div className="flex flex-wrap items-center gap-1">
                    {(["hoje", "ontem", "semana", "mes"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => aplicarPeriodo(filtroPeriodo === p ? "" : p)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors sm:text-xs ${
                          filtroPeriodo === p ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                        }`}
                      >
                        {{ hoje: "Hoje", ontem: "Ontem", semana: "Semana", mes: "Mês" }[p]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {operacaoEnabled && (
              <OperacaoFiltrosBar
                filtros={filtrosOps}
                onChange={(patch) => setFiltrosOps((f) => ({ ...f, ...patch }))}
                unidades={unidades.filter((u) => u.status === "ativa").map((u) => ({ id: u.id, nome: u.nome }))}
                contagemAprovados={contagemAprovadosOps}
              />
            )}

            {planilhaLayout && (
              <PlanilhaFiltrosBar
                filtros={filtrosPlanilha}
                produtos={produtosOpcoes}
                locais={locaisOpcoes.map((l) => ({ id: l.id, label: l.label }))}
                onChange={(patch) => setFiltrosPlanilha((f) => ({ ...f, ...patch }))}
                onLimpar={limparFiltrosPlanilha}
              />
            )}

            {temFiltro && planilhaLayout && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="text-xs font-medium text-terracotta hover:underline"
              >
                Limpar todos os filtros
              </button>
            )}

            {!planilhaLayout && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Período recebido:</span>
              {(["hoje", "ontem", "semana", "mes"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => aplicarPeriodo(filtroPeriodo === p ? "" : p)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filtroPeriodo === p ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                  }`}
                >
                  {{ hoje: "Hoje", ontem: "Ontem", semana: "Esta semana", mes: "Este mês" }[p]}
                </button>
              ))}
              <span className="text-xs text-muted-foreground">De</span>
              <input
                type="date"
                value={filtroInicio}
                onChange={(e) => { setFiltroInicio(e.target.value); setFiltroPeriodo(""); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="date"
                value={filtroFim}
                onChange={(e) => { setFiltroFim(e.target.value); setFiltroPeriodo(""); }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              {(filtroInicio || filtroFim || filtroPeriodo) && (
                <button
                  onClick={() => aplicarPeriodo("")}
                  className="text-xs text-muted-foreground hover:text-terracotta"
                >
                  ✕ Limpar período
                </button>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <main
          className={
            planilhaLayout
              ? `flex min-h-0 flex-1 flex-col pb-2 pt-2 ${padX}`
              : "mx-auto max-w-6xl px-4 py-6 sm:px-6"
          }
        >
          {carregando && pedidos.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Carregando pedidos…</p>
          ) : pedidosFiltrados.length === 0 && view !== "calendario" ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {temFiltro ? "Nenhum pedido corresponde aos filtros." : "Nenhum pedido encontrado."}
            </p>
          ) : view === "calendario" ? (
            pedidosComDataEntrega.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhum pedido com data de entrega nos filtros atuais.
              </p>
            ) : (
              <EncomendasCalendario
                contagemPorDia={contagemPorDiaEntrega}
                dataSelecionada={filtroData}
                onSelecionarData={setFiltroData}
                linhas={linhasVisiveis}
                selectedIds={selectedIds}
                locaisOpcoes={locaisOpcoes}
                salvandoPedidoId={salvandoOperacaoId}
                onTogglePedido={toggleSelecionado}
                onAbrirPedido={(pedidoId) => {
                  const p = pedidosFiltrados.find((x) => x.id === pedidoId);
                  if (p) setDetalhe(p);
                }}
                onAlterarSetor={(pedidoId, setor) => void alterarSetorPedido(pedidoId, setor)}
                onAlterarLocal={(pedidoId, unidadeId, label) =>
                  void alterarLocalPedido(pedidoId, unidadeId, label)
                }
              />
            )
          ) : view === "planilha" ? (
            <EncomendasTable
              fillViewport
              linhas={linhasVisiveis}
              selectedIds={selectedIds}
              locaisOpcoes={locaisOpcoes}
              salvandoPedidoId={salvandoOperacaoId}
              onTogglePedido={toggleSelecionado}
              onAbrirPedido={(pedidoId) => {
                const p = pedidosFiltrados.find((x) => x.id === pedidoId);
                if (p) setDetalhe(p);
              }}
              onAlterarSetor={(pedidoId, setor) => void alterarSetorPedido(pedidoId, setor)}
              onAlterarLocal={(pedidoId, unidadeId, label) =>
                void alterarLocalPedido(pedidoId, unidadeId, label)
              }
            />
          ) : operacaoEnabled && view === "lista" ? (
            <div className="space-y-8">
              {operacaoGrupos.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Nenhum pedido na fila operacional.
                </p>
              ) : (
                operacaoGrupos.map(([iso, items]) => (
                  <OperacaoGrupoExecucao
                    key={iso}
                    label={grupoLabelFromIso(iso)}
                    pedidos={items}
                    onDetalhe={setDetalhe}
                    onImprimir={imprimirUm}
                  />
                ))
              )}
            </div>
          ) : view === "lista" ? (
            <ListView
              porStatus={porStatus}
              pedidosFiltrados={pedidosFiltrados}
              temFiltro={temFiltro}
              onDetalhe={setDetalhe}
              onImprimir={imprimirUm}
              selectedIds={selectedIds}
              onToggle={toggleSelecionado}
            />
          ) : (
            <KanbanView
              porStatus={porStatus}
              onDetalhe={setDetalhe}
              onImprimir={imprimirUm}
            />
          )}
        </main>
      </div>

      {/* Impressão */}
      {imprimindo && (
        <div className="hidden print:block">
          {imprimindo.map((p) => <FolhaImpressao key={p.id} p={p} />)}
        </div>
      )}

      {/* Modal detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido #{detalhe?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {detalhe && <DetalhesPedido p={detalhe} />}
          {detalhe && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => abrirEdicao(detalhe)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button onClick={() => imprimirUm(detalhe)}
                className="bg-charcoal text-white hover:bg-charcoal/90">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de edição */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pedido #{editando?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              <strong>Atenção:</strong> Você está editando dados reais deste pedido. As alterações são permanentes e imediatamente refletidas no sistema.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Nome do cliente</label>
                <Input
                  value={editForm.clienteNome}
                  onChange={(e) => setEditForm((f) => ({ ...f, clienteNome: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">WhatsApp do cliente</label>
                <Input
                  value={editForm.clienteWhatsapp}
                  onChange={(e) => setEditForm((f) => ({ ...f, clienteWhatsapp: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Endereço / Unidade</label>
              <Input
                value={editForm.enderecoOuUnidade}
                onChange={(e) => setEditForm((f) => ({ ...f, enderecoOuUnidade: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Data de entrega</label>
                <Input
                  type="date"
                  value={editForm.data}
                  onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Horário</label>
                <Input
                  value={editForm.horario}
                  placeholder="ex: 14h–16h"
                  onChange={(e) => setEditForm((f) => ({ ...f, horario: e.target.value }))}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-charcoal">
              <input
                type="checkbox"
                checked={editForm.temDestinatario}
                onChange={(e) => setEditForm((f) => ({ ...f, temDestinatario: e.target.checked }))}
              />
              Pedido tem destinatário (quem recebe)
            </label>

            {editForm.temDestinatario && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Nome do destinatário</label>
                  <Input
                    value={editForm.destinatarioNome}
                    onChange={(e) => setEditForm((f) => ({ ...f, destinatarioNome: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">WhatsApp do destinatário</label>
                  <Input
                    value={editForm.destinatarioWhatsapp}
                    onChange={(e) => setEditForm((f) => ({ ...f, destinatarioWhatsapp: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={editConfirm}
              onChange={(e) => setEditConfirm(e.target.checked)}
            />
            <span className="text-xs text-red-800">
              Entendo que estou alterando os dados reais do pedido do cliente e que esta ação é irreversível.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editConfirm || editLoading}
              onClick={salvarEdicao}
              className="bg-terracotta text-white hover:bg-terracotta/90"
            >
              {editLoading ? "Salvando…" : "Confirmar alteração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barra flutuante de seleção */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-charcoal px-5 py-3 shadow-xl text-white text-sm font-semibold">
          <span>✓ {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
          <button
            onClick={() => {
              const lista = pedidosSelecionados.length
                ? pedidosSelecionados
                : pedidosFiltrados.filter((p) => selectedIds.has(p.id));
              exportarCSV(lista, "pedidos-selecionados");
            }}
            className="rounded-lg bg-terracotta px-3 py-1.5 text-xs hover:bg-terracotta/90"
          >
            ⬇ Exportar Excel
          </button>
          {selecionadosNaoArquivados.length > 0 && (
            <button
              onClick={() => setConfirmArquivarLote(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
            >
              <Archive className="h-3.5 w-3.5" />
              Arquivar
            </button>
          )}
          {mostrarArquivadosAtivo && selecionadosArquivados.length > 0 && (
            <button
              onClick={() => void desarquivarSelecionados()}
              disabled={arquivarLoteLoading}
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25 disabled:opacity-50"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Desarquivar
            </button>
          )}
          <button
            onClick={() => {
              setConfirmaTextoExcluir("");
              setConfirmExcluirLote(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs hover:bg-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
          >
            ✕ Limpar
          </button>
        </div>
      )}

      {/* Confirmação arquivamento em lote */}
      <Dialog
        open={confirmArquivarLote}
        onOpenChange={(o) => {
          if (!o && !arquivarLoteLoading) setConfirmArquivarLote(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Arquivar {selecionadosNaoArquivados.length} pedido
              {selecionadosNaoArquivados.length !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Os pedidos saem da lista principal, mas permanecem no banco. Você pode recuperá-los
              marcando <strong>Mostrar arquivados</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmArquivarLote(false)}
                disabled={arquivarLoteLoading}
              >
                Cancelar
              </Button>
              <Button onClick={() => void arquivarSelecionados()} disabled={arquivarLoteLoading}>
                {arquivarLoteLoading
                  ? "Arquivando…"
                  : `Arquivar ${selecionadosNaoArquivados.length} pedido${selecionadosNaoArquivados.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação exclusão em lote */}
      <Dialog
        open={confirmExcluirLote}
        onOpenChange={(o) => {
          if (!o && !excluirLoteLoading) {
            setConfirmExcluirLote(false);
            setConfirmaTextoExcluir("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-amber-900">
                Esta ação é <strong>permanente</strong> e remove os pedidos do banco de dados.
              </p>
            </div>
            {selecionadosComPagamento.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-red-900">
                  <strong>{selecionadosComPagamento.length}</strong> pedido(s) selecionado(s) está(ão){" "}
                  <strong>pago(s)</strong>. A exclusão não estorna no Asaas — faça o estorno manualmente se
                  necessário.
                </p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Digite <span className="font-mono font-semibold text-red-600">EXCLUIR</span> para confirmar:
              </label>
              <Input
                value={confirmaTextoExcluir}
                onChange={(e) => setConfirmaTextoExcluir(e.target.value)}
                placeholder="EXCLUIR"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={excluirLoteLoading}
                onClick={() => {
                  setConfirmExcluirLote(false);
                  setConfirmaTextoExcluir("");
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={excluirLoteLoading || confirmaTextoExcluir !== "EXCLUIR"}
                onClick={excluirSelecionados}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {excluirLoteLoading
                  ? "Excluindo…"
                  : `Excluir ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" />
    </div>
  );
}

// ── Lista view ─────────────────────────────────────────────────────────────

function ListView({
  porStatus,
  pedidosFiltrados,
  temFiltro,
  onDetalhe,
  onImprimir,
  selectedIds,
  onToggle,
}: {
  porStatus: Record<StatusKey, PedidoSalvo[]>;
  pedidosFiltrados: PedidoSalvo[];
  temFiltro: boolean;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (temFiltro) {
    return (
      <div className="grid gap-3">
        {pedidosFiltrados.map((p) => (
          <PedidoCard key={p.id} p={p} onDetalhe={onDetalhe} onImprimir={onImprimir}
            selected={selectedIds.has(p.id)} onToggle={() => onToggle(p.id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => {
        const lista = porStatus[s];
        if (!lista.length) return null;
        return (
          <section key={s}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[s].header}`}>
                {STATUS_CONFIG[s].label}
              </span>
              <span className="text-xs text-muted-foreground">{lista.length}</span>
            </div>
            <div className="grid gap-3">
              {lista.map((p) => (
                <PedidoCard key={p.id} p={p} onDetalhe={onDetalhe} onImprimir={onImprimir}
                  selected={selectedIds.has(p.id)} onToggle={() => onToggle(p.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Kanban view ────────────────────────────────────────────────────────────

function KanbanView({
  porStatus,
  onDetalhe,
  onImprimir,
}: {
  porStatus: Record<StatusKey, PedidoSalvo[]>;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
}) {
  return (
    /* Mobile: snap horizontal; Desktop: 4 colunas */
    <div
      className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:snap-none md:overflow-visible"
      style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
    >
      {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => {
        const lista = porStatus[s];
        return (
          <div
            key={s}
            className="flex shrink-0 snap-start flex-col rounded-2xl bg-white ring-1 ring-border"
            style={{ minWidth: 280, maxWidth: 360 }}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between rounded-t-2xl px-4 py-3 ${STATUS_CONFIG[s].header}`}>
              <span className="text-sm font-semibold">{STATUS_CONFIG[s].label}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{lista.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 p-3">
              {lista.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Vazio</p>
              ) : (
                lista.map((p) => (
                  <KanbanCard key={p.id} p={p} onDetalhe={onDetalhe} onImprimir={onImprimir} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Kanban card (compacto) ─────────────────────────────────────────────────

function KanbanCard({
  p,
  onDetalhe,
  onImprimir,
}: {
  p: PedidoSalvo;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
}) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  return (
    <div className="rounded-xl bg-linen p-3 ring-1 ring-border/60">
      <div className="flex items-start justify-between gap-1">
        <p className="font-serif text-[14px] font-semibold leading-tight text-charcoal">
          {p.cliente.nome || "(sem nome)"}
        </p>
        <span className="font-serif text-sm font-bold text-terracotta whitespace-nowrap">
          {formatBRL(p.total)}
        </span>
      </div>

      {p.cesta && (
        <p className="mt-1 text-[11.5px] text-charcoal/60">
          {p.cesta.nome} × {p.cesta.quantidade}
          {p.sobremesas.length > 0 && ` + ${p.sobremesas.length} sobr.`}
        </p>
      )}

      <p className="mt-1 text-[11px] text-charcoal/50">
        {[labelTipoPedido(p.tipo), p.data, p.horario].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        {tel && (
          <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer"
            className="flex items-center justify-center rounded-full bg-olive/10 p-1.5 text-olive hover:bg-olive/20">
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        <button onClick={() => onDetalhe(p)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold ring-1 ring-border hover:bg-muted">
          <Eye className="h-3 w-3" /> Detalhes
        </button>
        <button onClick={() => onImprimir(p)}
          className="flex items-center justify-center rounded-lg bg-charcoal px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-charcoal/85">
          <Printer className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Lista card (full) ──────────────────────────────────────────────────────

function PedidoCard({
  p,
  onDetalhe,
  onImprimir,
  selected = false,
  onToggle,
}: {
  p: PedidoSalvo;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const s = getStatus(p);
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  const destTel = p.destinatario?.whatsapp?.replace(/\D/g, "");
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const itensSoma =
    (p.cesta ? p.cesta.preco * p.cesta.quantidade : 0)
    + p.sobremesas.reduce((a, s) => a + s.preco * s.quantidade, 0)
    + cartoes.reduce((a, c) => a + c.preco, 0)
    + polaroids.reduce((a, po) => a + po.preco, 0)
    - Number(p.pagamento?.desconto ?? 0);
  const frete = p.tipo === "delivery" ? Math.max(0, p.total - itensSoma) : 0;

  return (
    <article className={`rounded-2xl bg-white p-4 ring-1 transition-colors ${selected ? "ring-2 ring-charcoal" : "ring-border"}`}>
      <div className="flex flex-wrap items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 cursor-pointer rounded border-border accent-charcoal"
        />

        <div className="min-w-0 flex-1">
          {/* Cabeçalho: status + ID + data */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CONFIG[s].bg}`}>
              {STATUS_CONFIG[s].label}
            </span>
            {p.archivedAt && (
              <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs font-semibold text-charcoal">
                Arquivado
              </span>
            )}
            <span className="font-mono text-xs font-bold text-charcoal">#{p.id.slice(-6).toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(p.criadoEm).toLocaleString("pt-BR")}
            </span>
          </div>

          {/* Cliente */}
          <p className="mt-2 font-serif text-lg font-bold text-charcoal leading-tight">
            {p.cliente.nome || "(sem nome)"}
          </p>
          {tel && (
            <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-olive hover:underline">
              <MessageCircle className="h-3.5 w-3.5" />
              {p.cliente.whatsapp}
            </a>
          )}

          {/* Destinatário */}
          {p.destinatario && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-terracotta/8 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-terracotta">🎁 Para:</span>
              <span className="text-xs font-semibold text-charcoal">{p.destinatario.nome}</span>
              {destTel && (
                <a href={`https://wa.me/55${destTel}`} target="_blank" rel="noreferrer"
                  className="ml-1 text-xs text-olive hover:underline">
                  {p.destinatario.whatsapp}
                </a>
              )}
            </div>
          )}

          {/* Itens */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal">
            {p.cesta?.nome
              ? <span className="font-medium">{p.cesta.nome} × {p.cesta.quantidade}</span>
              : <span className="text-muted-foreground">— sem cesta —</span>}
            {p.sobremesas.length > 0 && (
              <span className="text-charcoal/60">+{p.sobremesas.length} sobremesa{p.sobremesas.length !== 1 ? "s" : ""}</span>
            )}
            {cartoes.length > 0 && (
              <span className="text-charcoal/60">📝 {cartoes.length} cartão{cartoes.length !== 1 ? "ões" : ""}</span>
            )}
            {polaroids.length > 0 && (
              <span className="text-charcoal/60">📸 {polaroids.length} polaroid{polaroids.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Entrega */}
          <p className="mt-1 text-xs text-muted-foreground">
            {[labelTipoPedido(p.tipo), p.enderecoOuUnidade, p.data, p.horario].filter(Boolean).join(" · ")}
          </p>
          {frete > 0 && (
            <p className="text-xs text-charcoal/50">🚚 Frete: {formatBRL(frete)}</p>
          )}
        </div>

        {/* Total + ações */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="font-serif text-2xl font-bold text-terracotta">{formatBRL(p.total)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDetalhe(p)}>
              <Eye className="mr-1 h-4 w-4" /> Detalhes
            </Button>
            <Button size="sm" onClick={() => onImprimir(p)}
              className="bg-charcoal text-white hover:bg-charcoal/90">
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Modal detalhes ─────────────────────────────────────────────────────────

function destinatarioEntrega(p: PedidoSalvo): { nome: string; whatsapp: string } {
  if (p.destinatario?.nome) {
    return {
      nome: p.destinatario.nome,
      whatsapp: p.destinatario.whatsapp ?? "",
    };
  }
  return {
    nome: p.cliente.nome || "—",
    whatsapp: p.cliente.whatsapp ?? "",
  };
}

function formatDataEntregaLegivel(data?: string | null): string {
  if (!data) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const d = new Date(`${data}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  return data;
}

function DetalhesPedido({ p }: { p: PedidoSalvo }) {
  const dest = destinatarioEntrega(p);
  const telDest = dest.whatsapp.replace(/\D/g, "");
  const isDelivery = p.tipo?.toLowerCase() === "delivery";
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const desconto = Number(p.pagamento?.desconto ?? 0);
  const cupom = p.pagamento?.cupom;
  const metodo = p.pagamento?.metodo;
  const metodoLabel =
    metodo === "credit_card" || metodo === "CREDIT_CARD"
      ? "Cartão de crédito"
      : metodo?.toUpperCase() === "PIX"
        ? "PIX"
        : metodo ?? null;
  const itensSoma =
    (p.cesta ? p.cesta.preco * p.cesta.quantidade : 0)
    + p.sobremesas.reduce((a, s) => a + s.preco * s.quantidade, 0)
    + cartoes.reduce((a, c) => a + c.preco, 0)
    + polaroids.reduce((a, po) => a + po.preco, 0)
    - desconto;
  const frete = p.tipo === "delivery" ? Math.max(0, p.total - itensSoma) : 0;
  const s = getStatus(p);

  return (
    <div className="space-y-4 text-sm">
      {/* Cabeçalho: status + ID + data */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CONFIG[s].bg}`}>
          {STATUS_CONFIG[s].label}
        </span>
        <span className="font-mono text-sm font-bold text-charcoal">
          #{p.id.slice(-6).toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(p.criadoEm).toLocaleString("pt-BR")}
        </span>
      </div>

      {/* Destinatário — foco para entrega */}
      <div className="rounded-xl border-2 border-terracotta/40 bg-terracotta/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-terracotta">
          {isDelivery ? "🛵 Entregar para" : "🎁 Pedido para"}
        </p>
        <p className="mt-1 text-lg font-bold text-charcoal">{dest.nome}</p>
        {telDest && (
          <a
            href={`https://wa.me/55${telDest}`}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block text-base font-semibold text-olive hover:underline"
          >
            📞 {dest.whatsapp}
          </a>
        )}
      </div>

      {/* Logística */}
      <div className="rounded-lg border border-border bg-linen/60 px-4 py-3 space-y-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {isDelivery ? "📍 Endereço de entrega" : "📍 Local de retirada"}
          </p>
          <p className="mt-0.5 text-base font-semibold text-charcoal leading-snug">
            {p.enderecoOuUnidade || "—"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {isDelivery ? "📅 Entregar em" : "📅 Retirar em"}
            </p>
            <p className="mt-0.5 font-semibold text-charcoal capitalize">
              {formatDataEntregaLegivel(p.data)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">🕐 Horário</p>
            <p className="mt-0.5 font-semibold text-charcoal">{p.horario || "—"}</p>
          </div>
        </div>
      </div>

      {/* Itens com preços individuais */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens</p>
        <div className="mt-1 space-y-1 text-charcoal">
          {p.cesta && (
            <div className="flex justify-between">
              <span>{p.cesta.nome} × {p.cesta.quantidade}</span>
              <span className="font-semibold">{formatBRL(p.cesta.preco * p.cesta.quantidade)}</span>
            </div>
          )}
          {p.sobremesas.map((s, i) => (
            <div key={i} className="flex justify-between">
              <span>{s.nome} × {s.quantidade}</span>
              <span className="font-semibold">{formatBRL(s.preco * s.quantidade)}</span>
            </div>
          ))}
          {cartoes.map((c, i) => (
            <div key={`c-${i}`} className="flex justify-between">
              <span>💌 {c.nome}</span>
              <span className="font-semibold">{formatBRL(c.preco)}</span>
            </div>
          ))}
          {polaroids.map((pol, i) => (
            <div key={`p-${i}`} className="flex justify-between">
              <span>📸 {pol.nome}</span>
              <span className="font-semibold">{formatBRL(pol.preco)}</span>
            </div>
          ))}
          {!p.cesta && p.sobremesas.length === 0 && cartoes.length === 0 && polaroids.length === 0 && (
            <p className="text-muted-foreground">— sem itens —</p>
          )}
        </div>
      </div>

      {/* Desconto + Frete + Total */}
      <div className="space-y-1 border-t border-border pt-2">
        {desconto > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatBRL(itensSoma + desconto)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Desconto{cupom ? ` (${cupom})` : ""}</span>
              <span>−{formatBRL(desconto)}</span>
            </div>
          </>
        )}
        {frete > 0 && (
          <div className="flex justify-between text-sm text-charcoal/70">
            <span>🚚 Taxa de entrega</span>
            <span className="font-semibold">{formatBRL(frete)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-charcoal">Total</span>
          <span className="font-serif text-lg font-bold text-terracotta">{formatBRL(p.total)}</span>
        </div>
        {metodoLabel && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Forma de pagamento</span>
            <span>{metodoLabel}</span>
          </div>
        )}
      </div>

      {/* Fotos e Mensagens */}
      {(cartoes.length > 0 || polaroids.length > 0) && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Fotos e Mensagens</p>
          <PedidoExtrasView cartoes={cartoes} polaroids={polaroids} variant="admin" />
        </div>
      )}

      {/* Pagamento (referência interna) */}
      <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <p className="uppercase tracking-wide">Tipo</p>
          <p className="text-sm text-charcoal">{labelTipoPedido(p.tipo)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide">Pagamento</p>
          <p className="text-sm text-charcoal">{labelStatusPagamento(p.pagamento?.status)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Folha de impressão ─────────────────────────────────────────────────────

function FolhaImpressao({ p }: { p: PedidoSalvo }) {
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const dest = destinatarioEntrega(p);
  const isDelivery = p.tipo?.toLowerCase() === "delivery";

  return (
    <div style={{ pageBreakAfter: "always", padding: "16mm 14mm", fontFamily: "system-ui, sans-serif", color: "#000", fontSize: "12pt" }}>
      {/* Cabeçalho mínimo */}
      <div style={{ borderBottom: "2px solid #000", paddingBottom: "6pt", marginBottom: "10pt" }}>
        <h1 style={{ fontSize: "16pt", margin: 0 }}>Casa Almeria — {isDelivery ? "Entrega" : "Retirada"}</h1>
        <p style={{ fontSize: "10pt", margin: "4pt 0 0", fontFamily: "monospace" }}>
          Pedido #{p.id.slice(-6).toUpperCase()}
        </p>
      </div>

      {/* Destinatário em destaque */}
      <div style={{ background: "#f9f0e8", border: "2px solid #c4855a", borderRadius: "6pt", padding: "10pt 12pt", marginBottom: "10pt" }}>
        <p style={{ fontWeight: "bold", margin: 0, fontSize: "11pt", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {isDelivery ? "🛵 Entregar para" : "🎁 Pedido para"}
        </p>
        <p style={{ margin: "6pt 0 0", fontSize: "20pt", fontWeight: "bold" }}>{dest.nome}</p>
        {dest.whatsapp && (
          <p style={{ margin: "4pt 0 0", fontSize: "14pt", fontWeight: "bold" }}>📞 {dest.whatsapp}</p>
        )}
      </div>

      {/* Onde e quando */}
      <div style={{ border: "1.5px solid #333", borderRadius: "6pt", padding: "10pt 12pt", marginBottom: "10pt" }}>
        <p style={{ fontWeight: "bold", margin: 0, fontSize: "11pt", textTransform: "uppercase" }}>
          {isDelivery ? "📍 Endereço de entrega" : "📍 Local de retirada"}
        </p>
        <p style={{ margin: "6pt 0 0", fontSize: "13pt", fontWeight: "bold", lineHeight: 1.35 }}>
          {p.enderecoOuUnidade || "—"}
        </p>
        <hr style={{ margin: "8pt 0", border: "none", borderTop: "1px solid #ccc" }} />
        <div style={{ display: "flex", gap: "16pt" }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: "bold", margin: 0, fontSize: "10pt", textTransform: "uppercase" }}>
              {isDelivery ? "📅 Entregar em" : "📅 Retirar em"}
            </p>
            <p style={{ margin: "4pt 0 0", fontSize: "12pt", fontWeight: "bold", textTransform: "capitalize" }}>
              {formatDataEntregaLegivel(p.data)}
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: "bold", margin: 0, fontSize: "10pt", textTransform: "uppercase" }}>🕐 Horário</p>
            <p style={{ margin: "4pt 0 0", fontSize: "12pt", fontWeight: "bold" }}>{p.horario || "—"}</p>
          </div>
        </div>
      </div>

      {/* Itens */}
      <p style={{ fontWeight: "bold", marginBottom: "6pt", fontSize: "11pt", textTransform: "uppercase" }}>
        📦 O que levar
      </p>
      {p.cesta && <p style={{ margin: "3pt 0", fontSize: "12pt" }}>• {p.cesta.nome} × {p.cesta.quantidade}</p>}
      {p.sobremesas.map((s, i) => (
        <p key={i} style={{ margin: "3pt 0", fontSize: "12pt" }}>• {s.nome} × {s.quantidade}</p>
      ))}

      {/* Personalizações */}
      {(cartoes.length > 0 || polaroids.length > 0) && (
        <>
          <p style={{ fontWeight: "bold", margin: "8pt 0 4pt" }}>Personalizações</p>
          {cartoes.map((c, i) => (
            <div key={`c${i}`} style={{ marginBottom: "6pt" }}>
              <p style={{ margin: "3pt 0", fontSize: "12pt" }}>• 💌 {c.nome}</p>
              {c.mensagem && <p style={{ margin: "2pt 0 0 12pt", fontStyle: "italic", fontSize: "11pt" }}>"{c.mensagem}"</p>}
            </div>
          ))}
          {polaroids.map((pl, i) => (
            <p key={`p${i}`} style={{ margin: "3pt 0", fontSize: "12pt" }}>
              • 📸 {pl.nome}{pl.arquivoNome ? ` (${pl.arquivoNome})` : ""}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
