import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  listarPedidosPorToken,
  rowToPedidoSalvo,
  type PedidoRow,
} from "@/lib/pedidos";
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
  X,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const s = (p.pagamento?.status || "").toLowerCase();
  return STATUS_ALIASES[s] ?? "rascunho";
}

function horaNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Main component ─────────────────────────────────────────────────────────

function CozinhaPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();

  const [pedidos, setPedidos] = useState<PedidoSalvo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);
  const [imprimindo, setImprimindo] = useState<PedidoSalvo[] | null>(null);

  // view mode
  const [view, setView] = useState<"lista" | "kanban">(() => {
    if (typeof window === "undefined") return "lista";
    return (localStorage.getItem("pedidos-view") as "lista" | "kanban") ?? "lista";
  });

  // filtros
  const [filtroStatus, setFiltroStatus] = useState<StatusKey[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"" | "delivery" | "retirada">("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroPolaroid, setFiltroPolaroid] = useState(false);

  // login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginErro, setLoginErro] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Refresh estável: não recria o interval ao mudar carregar ──────────────
  const carregarRef = useRef<(() => Promise<void>) | undefined>(undefined);
  carregarRef.current = async () => {
    setCarregando(true);
    try {
      const rows: PedidoRow[] = await listarPedidosPorToken(token);
      setPedidos(rows.map(rowToPedidoSalvo));
      setUltimaAtualizacao(horaNow());
    } catch {
      // token inválido ou sem permissão
    }
    setCarregando(false);
  };

  useEffect(() => {
    if (!user) return;
    carregarRef.current?.();
    const id = setInterval(() => carregarRef.current?.(), 30_000);
    return () => clearInterval(id);
  }, [user, token]); // deps estáveis — sem carregar no array

  // ── Filtros aplicados ─────────────────────────────────────────────────────
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroStatus.length > 0 && !filtroStatus.includes(getStatus(p))) return false;
      if (filtroTipo && p.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroData && p.data !== filtroData) return false;
      if (filtroPolaroid && !((p.pagamento?.extras?.polaroids?.length ?? 0) > 0)) return false;
      return true;
    });
  }, [pedidos, filtroStatus, filtroTipo, filtroData, filtroPolaroid]);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-linen p-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoginErro("");
            const email = loginEmail.trim();
            if (!email || !loginSenha) { setLoginErro("Preencha email e senha."); return; }
            setLoginLoading(true);
            const { error } = await supabase.auth.signInWithPassword({ email, password: loginSenha });
            setLoginLoading(false);
            if (error) setLoginErro("Email ou senha incorretos.");
          }}
          className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 ring-1 ring-border"
        >
          <h1 className="font-serif text-xl font-bold text-charcoal">Acesso restrito</h1>
          <p className="text-xs text-muted-foreground">Faça login para visualizar os pedidos.</p>
          <input type="email" value={loginEmail}
            onChange={(e) => { setLoginEmail(e.target.value); setLoginErro(""); }}
            autoComplete="email" autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Email" required />
          <input type="password" value={loginSenha}
            onChange={(e) => { setLoginSenha(e.target.value); setLoginErro(""); }}
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Senha" required />
          {loginErro && <p className="text-xs text-terracotta">{loginErro}</p>}
          <Button type="submit" disabled={loginLoading}
            className="w-full bg-charcoal text-white hover:bg-charcoal/90">
            {loginLoading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <Toaster position="bottom-right" />
      </div>
    );
  }

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

  const toggleView = (v: "lista" | "kanban") => {
    setView(v);
    localStorage.setItem("pedidos-view", v);
  };

  const toggleStatus = (s: StatusKey) => {
    setFiltroStatus((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const temFiltro = filtroStatus.length > 0 || filtroTipo !== "" || filtroData !== "" || filtroPolaroid;

  // ── View ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linen">
      <div className="print:hidden">

        {/* Header */}
        <header className="bg-charcoal text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <h1 className="font-serif text-xl font-bold">Pedidos — Casa Almeria</h1>
              <p className="text-xs text-white/50">
                {ultimaAtualizacao
                  ? `Atualizado às ${ultimaAtualizacao} · atualiza a cada 30s`
                  : "Carregando…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle lista/kanban */}
              <div className="flex rounded-lg border border-white/20 p-0.5">
                <button
                  onClick={() => toggleView("lista")}
                  title="Lista"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "lista" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleView("kanban")}
                  title="Kanban"
                  className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${view === "kanban" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Columns className="h-4 w-4" />
                </button>
              </div>

              <Button variant="outline" onClick={() => carregarRef.current?.()} disabled={carregando}
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
                Atualizar
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
        <div className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">

            {/* Status chips */}
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((s) => {
                const active = filtroStatus.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-charcoal text-white"
                        : "bg-linen text-charcoal hover:bg-charcoal/10"
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                    {active && <X className="ml-1 inline h-3 w-3" />}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Tipo chips */}
            <div className="flex gap-1.5">
              {(["", "delivery", "retirada"] as const).map((t) => (
                <button
                  key={t || "todos"}
                  onClick={() => setFiltroTipo(t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors capitalize ${
                    filtroTipo === t
                      ? "bg-charcoal text-white"
                      : "bg-linen text-charcoal hover:bg-charcoal/10"
                  }`}
                >
                  {t === "" ? "Todos os tipos" : t}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Data */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Entrega:</label>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              {filtroData && (
                <button onClick={() => setFiltroData("")} className="text-muted-foreground hover:text-charcoal">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Polaroid */}
            <button
              onClick={() => setFiltroPolaroid((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filtroPolaroid ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
              }`}
            >
              📸 Com polaroid
            </button>

            {/* Contador + limpar */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? "s" : ""}
              </span>
              {temFiltro && (
                <button
                  onClick={() => { setFiltroStatus([]); setFiltroTipo(""); setFiltroData(""); setFiltroPolaroid(false); }}
                  className="text-xs font-semibold text-terracotta hover:text-terracotta/80"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {carregando && pedidos.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Carregando pedidos…</p>
          ) : pedidosFiltrados.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {temFiltro ? "Nenhum pedido corresponde aos filtros." : "Nenhum pedido encontrado."}
            </p>
          ) : view === "lista" ? (
            <ListView
              porStatus={porStatus}
              pedidosFiltrados={pedidosFiltrados}
              temFiltro={temFiltro}
              onDetalhe={setDetalhe}
              onImprimir={imprimirUm}
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
            <div className="flex justify-end">
              <Button onClick={() => imprimirUm(detalhe)}
                className="bg-charcoal text-white hover:bg-charcoal/90">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            </div>
          )}
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
}: {
  porStatus: Record<StatusKey, PedidoSalvo[]>;
  pedidosFiltrados: PedidoSalvo[];
  temFiltro: boolean;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
}) {
  if (temFiltro) {
    return (
      <div className="grid gap-3">
        {pedidosFiltrados.map((p) => (
          <PedidoCard key={p.id} p={p} onDetalhe={onDetalhe} onImprimir={onImprimir} />
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
                <PedidoCard key={p.id} p={p} onDetalhe={onDetalhe} onImprimir={onImprimir} />
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

      <p className="mt-1 text-[11px] text-charcoal/50 capitalize">
        {[p.tipo, p.data, p.horario].filter(Boolean).join(" · ")}
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
}: {
  p: PedidoSalvo;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
}) {
  const s = getStatus(p);
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CONFIG[s].bg}`}>
              {STATUS_CONFIG[s].label}
            </span>
            <span className="text-xs text-muted-foreground">
              #{p.id.slice(0, 8)} · {new Date(p.criadoEm).toLocaleString("pt-BR")}
            </span>
          </div>
          <p className="mt-2 font-serif text-lg font-bold text-charcoal">
            {p.cliente.nome || "(sem nome)"}
          </p>
          {tel && (
            <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-olive hover:underline">
              <MessageCircle className="h-3.5 w-3.5" />
              {p.cliente.whatsapp}
            </a>
          )}
          <div className="mt-2 text-sm text-charcoal">
            {p.cesta?.nome
              ? <span>{p.cesta.nome} × {p.cesta.quantidade}</span>
              : <span className="text-muted-foreground">— sem cesta —</span>}
            {p.sobremesas.length > 0 && (
              <span className="text-muted-foreground"> + {p.sobremesas.length} sobremesa(s)</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {[p.tipo, p.enderecoOuUnidade, p.data, p.horario].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-serif text-xl font-bold text-terracotta">{formatBRL(p.total)}</span>
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

function DetalhesPedido({ p }: { p: PedidoSalvo }) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
        <p className="font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
        {tel && (
          <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" className="text-olive hover:underline">
            {p.cliente.whatsapp}
          </a>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens</p>
        {p.cesta && (
          <p>{p.cesta.nome} × {p.cesta.quantidade} — {formatBRL(p.cesta.preco * p.cesta.quantidade)}</p>
        )}
        {p.sobremesas.map((s, i) => (
          <p key={i}>{s.nome} × {s.quantidade} — {formatBRL(s.preco * s.quantidade)}</p>
        ))}
      </div>
      {(() => {
        const cartoes = p.pagamento?.extras?.cartoes ?? [];
        const polaroids = p.pagamento?.extras?.polaroids ?? [];
        if (!cartoes.length && !polaroids.length) return null;
        return (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Personalizações</p>
            <PedidoExtrasView cartoes={cartoes} polaroids={polaroids} variant="admin" />
          </div>
        );
      })()}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</p>
          <p className="capitalize">{p.tipo || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <p>{p.pagamento?.status || "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Endereço / Unidade</p>
          <p>{p.enderecoOuUnidade || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
          <p>{p.data || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário</p>
          <p>{p.horario || "—"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-muted-foreground">Total</span>
        <span className="font-serif text-lg font-bold text-terracotta">{formatBRL(p.total)}</span>
      </div>
    </div>
  );
}

// ── Folha de impressão ─────────────────────────────────────────────────────

function FolhaImpressao({ p }: { p: PedidoSalvo }) {
  return (
    <div style={{ pageBreakAfter: "always", padding: "20mm 15mm", fontFamily: "system-ui, sans-serif", color: "#000", fontSize: "12pt" }}>
      <div style={{ borderBottom: "2px solid #000", paddingBottom: "8pt", marginBottom: "12pt" }}>
        <h1 style={{ fontSize: "18pt", margin: 0 }}>Casa Almeria — Pedido</h1>
        <p style={{ fontSize: "10pt", margin: "4pt 0 0" }}>
          #{p.id.slice(0, 8)} · {new Date(p.criadoEm).toLocaleString("pt-BR")}
        </p>
      </div>
      <p><strong>Cliente:</strong> {p.cliente.nome || "—"}</p>
      <p><strong>WhatsApp:</strong> {p.cliente.whatsapp || "—"}</p>
      <p><strong>Status:</strong> {p.pagamento?.status || "—"}</p>
      <hr style={{ margin: "10pt 0" }} />
      <p style={{ fontWeight: "bold", marginBottom: "4pt" }}>Itens</p>
      {p.cesta && <p>• {p.cesta.nome} × {p.cesta.quantidade} — {formatBRL(p.cesta.preco * p.cesta.quantidade)}</p>}
      {p.sobremesas.map((s, i) => (
        <p key={i}>• {s.nome} × {s.quantidade} — {formatBRL(s.preco * s.quantidade)}</p>
      ))}
      <hr style={{ margin: "10pt 0" }} />
      <p><strong>Tipo:</strong> {p.tipo || "—"}</p>
      <p><strong>Endereço/Unidade:</strong> {p.enderecoOuUnidade || "—"}</p>
      <p><strong>Data:</strong> {p.data || "—"} · <strong>Horário:</strong> {p.horario || "—"}</p>
      {((p.pagamento?.extras?.cartoes?.length ?? 0) > 0 || (p.pagamento?.extras?.polaroids?.length ?? 0) > 0) && (
        <>
          <hr style={{ margin: "10pt 0" }} />
          <p style={{ fontWeight: "bold", marginBottom: "4pt" }}>Personalizações</p>
          {(p.pagamento?.extras?.cartoes ?? []).map((c, i) => (
            <div key={`c${i}`} style={{ marginBottom: "6pt" }}>
              <p>• {c.nome} — {formatBRL(c.preco)}</p>
              {c.mensagem && <p style={{ margin: "2pt 0 0 12pt", fontStyle: "italic" }}>"{c.mensagem}"</p>}
            </div>
          ))}
          {(p.pagamento?.extras?.polaroids ?? []).map((pl, i) => (
            <p key={`p${i}`}>• {pl.nome} — {formatBRL(pl.preco)} — Foto enviada{pl.arquivoNome ? ` (${pl.arquivoNome})` : ""}</p>
          ))}
        </>
      )}
      <hr style={{ margin: "10pt 0" }} />
      <p style={{ fontSize: "16pt", fontWeight: "bold", textAlign: "right" }}>
        Total: {formatBRL(p.total)}
      </p>
    </div>
  );
}
