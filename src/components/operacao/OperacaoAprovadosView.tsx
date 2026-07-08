import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaymentStatusNormalized } from "@/lib/paymentStatus";
import {
  arquivarPedidos,
  listarPedidosPorToken,
  rowToPedidoSalvo,
  type PedidoRow,
} from "@/lib/pedidos";
import type { PedidoSalvo } from "@/store/admin";
import { Button } from "@/components/ui/button";
import { PedidoManualModal } from "@/components/pedidoManual/PedidoManualModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ordenarPorEntrega } from "@/lib/pedidosSort";
import { sortPedidosPorCriadoDesc } from "@/lib/operacaoPedido";
import { EncomendasTable } from "@/components/operacao/EncomendasTable";
import { PlanilhaFiltrosBar } from "@/components/operacao/PlanilhaFiltrosBar";
import {
  flattenPedidosParaLinhas,
  locaisPlanilhaOpcoes,
} from "@/lib/encomendasTable";
import {
  FILTROS_PLANILHA_VAZIOS,
  filtrarLinhasEncomenda,
  filtrosPlanilhaAtivos,
  produtosUnicosDasLinhas,
  type FiltrosPlanilha,
} from "@/lib/planilhaFiltros";
import { useAdmin } from "@/store/admin";
import { DetalhesPedido } from "@/components/operacao/PedidoDetalheContent";
import { labelTipoPedido } from "@/lib/asaasStatus";

type StatusKey = "aprovado" | "pendente" | "rascunho" | "abandonado";

const STATUS_ALIASES: Record<string, StatusKey> = {
  CONFIRMED: "aprovado",
  RECEIVED: "aprovado",
  aprovado: "aprovado",
  pago: "aprovado",
  recebido: "aprovado",
  PENDING: "pendente",
  pendente: "pendente",
  aguardando: "pendente",
  rascunho: "rascunho",
  abandonado: "abandonado",
  cancelado: "abandonado",
};

function statusKeyFromNormalized(n: PaymentStatusNormalized): StatusKey {
  if (n === "aprovado") return "aprovado";
  if (n === "rascunho") return "rascunho";
  if (n === "cancelado" || n === "abandonado") return "abandonado";
  return "pendente";
}

function getStatus(p: PedidoSalvo, raw?: PedidoRow): StatusKey {
  if (raw?.payment_status_normalized) {
    return statusKeyFromNormalized(raw.payment_status_normalized as PaymentStatusNormalized);
  }
  const s = p.pagamento?.status || "";
  return STATUS_ALIASES[s] ?? STATUS_ALIASES[s.toLowerCase()] ?? "rascunho";
}

function horaNow() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type Props = {
  token: string;
};

export function OperacaoAprovadosView({ token }: Props) {
  const unidades = useAdmin((s) => s.unidades);
  const [pedidos, setPedidos] = useState<PedidoSalvo[]>([]);
  const [rawRows, setRawRows] = useState<PedidoRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"" | "delivery" | "retirada">("");
  const [filtroData, setFiltroData] = useState("");
  const [filtrosPlanilha, setFiltrosPlanilha] = useState<FiltrosPlanilha>(FILTROS_PLANILHA_VAZIOS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);
  const [confirmArquivar, setConfirmArquivar] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const carregarRef = useRef<(() => Promise<void>) | undefined>(undefined);
  carregarRef.current = async () => {
    setCarregando(true);
    try {
      const rows = await listarPedidosPorToken(token);
      setRawRows(rows);
      setPedidos(sortPedidosPorCriadoDesc(rows.map(rowToPedidoSalvo)));
      setUltimaAtualizacao(horaNow());
    } catch (e) {
      console.error("[operacao] carregar:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao carregar pedidos.");
    }
    setCarregando(false);
  };

  useEffect(() => {
    void carregarRef.current?.();

    const channel = supabase
      .channel("pedidos-operacao")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        void carregarRef.current?.();
      })
      .subscribe();

    const id = setInterval(() => void carregarRef.current?.(), 30_000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [token]);

  const rawRowsById = useMemo(() => new Map(rawRows.map((r) => [r.id, r])), [rawRows]);

  const pedidosAprovados = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.archivedAt) return false;
      return getStatus(p, rawRowsById.get(p.id)) === "aprovado";
    });
  }, [pedidos, rawRowsById]);

  const pedidosFiltrados = useMemo(() => {
    return pedidosAprovados.filter((p) => {
      if (filtroTipo && p.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroData && p.data !== filtroData) return false;
      if (filtroTexto) {
        const q = filtroTexto.toLowerCase();
        const hay = `${p.cliente.nome} ${p.cliente.whatsapp} ${p.destinatario?.nome ?? ""} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pedidosAprovados, filtroTipo, filtroData, filtroTexto]);

  const locaisOpcoes = useMemo(() => locaisPlanilhaOpcoes(), []);
  const linhasEncomenda = useMemo(
    () => flattenPedidosParaLinhas(ordenarPorEntrega(pedidosFiltrados), rawRows, unidades),
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

  const selecionadosNaoArquivados = useMemo(
    () => pedidosFiltrados.filter((p) => selectedIds.has(p.id) && !p.archivedAt),
    [pedidosFiltrados, selectedIds],
  );

  const toggleSelecionado = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const concluirPedidos = async (ids: string[]) => {
    if (ids.length === 0) return;
    setArquivando(true);
    const res = await arquivarPedidos(ids);
    setArquivando(false);
    setConfirmArquivar(false);
    setSelectedIds(new Set());
    setDetalhe(null);
    if (!res.ok) {
      toast.error("Erro ao concluir pedidos", { description: res.error });
      return;
    }
    const arquivados = new Set(ids);
    const agora = new Date().toISOString();
    setPedidos((prev) =>
      prev.map((p) => (arquivados.has(p.id) ? { ...p, archivedAt: agora } : p)),
    );
    setRawRows((prev) =>
      prev.map((r) =>
        arquivados.has(r.id)
          ? { ...r, archived_at: agora, fulfillment_stage: "finalizado" }
          : r,
      ),
    );
    const n = res.arquivados ?? ids.length;
    toast.success(
      n === 1
        ? "Pedido concluído e arquivado!"
        : `${n} pedidos concluídos e arquivados!`,
    );
  };

  const arquivarSelecionados = async () => {
    const ids = selecionadosNaoArquivados.map((p) => p.id);
    await concluirPedidos(ids);
  };

  const concluirUm = async (pedidoId: string) => {
    await concluirPedidos([pedidoId]);
  };

  const limparFiltrosPlanilha = () => setFiltrosPlanilha(FILTROS_PLANILHA_VAZIOS);

  return (
    <div className="flex min-h-dvh flex-col bg-linen">
      <header className="shrink-0 bg-charcoal text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Operação restrita
            </p>
            <h1 className="font-serif text-xl font-bold">Pedidos aprovados</h1>
            <p className="text-xs text-white/50">
              {ultimaAtualizacao
                ? `Atualizado às ${ultimaAtualizacao}`
                : "Carregando…"}
              {" · "}
              {pedidosFiltrados.length} na fila
              {" · "}
              Selecione e use <strong className="text-white/70">Concluir</strong> para dar baixa
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void carregarRef.current?.()}
              disabled={carregando}
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <PedidoManualModal onCriado={() => void carregarRef.current?.()} />
            <Button
              variant="outline"
              onClick={() => supabase.auth.signOut()}
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar cliente, telefone…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-charcoal/30 sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {(["", "delivery", "retirada"] as const).map((t) => (
              <button
                key={t || "todos"}
                type="button"
                onClick={() => setFiltroTipo(t)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filtroTipo === t ? "bg-charcoal text-white" : "bg-linen text-charcoal hover:bg-charcoal/10"
                }`}
              >
                {t === "" ? "Todos" : labelTipoPedido(t)}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
          />
        </div>
        <div className="mt-2">
          <PlanilhaFiltrosBar
            filtros={filtrosPlanilha}
            produtos={produtosOpcoes}
            locais={locaisOpcoes.map((l) => ({ id: l.id, label: l.label }))}
            onChange={(patch) => setFiltrosPlanilha((f) => ({ ...f, ...patch }))}
            onLimpar={limparFiltrosPlanilha}
          />
        </div>
        {filtrosPlanilhaAtivos(filtrosPlanilha) && (
          <button
            type="button"
            onClick={limparFiltrosPlanilha}
            className="mt-1 text-xs font-medium text-terracotta hover:underline"
          >
            Limpar filtros da planilha
          </button>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col px-2 pb-20 pt-2 sm:px-3">
        {carregando && pedidos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Carregando pedidos…</p>
        ) : pedidosFiltrados.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum pedido aprovado na fila.
          </p>
        ) : (
          <EncomendasTable
            fillViewport
            linhas={linhasVisiveis}
            selectedIds={selectedIds}
            locaisOpcoes={locaisOpcoes}
            salvandoPedidoId={null}
            onTogglePedido={toggleSelecionado}
            onAbrirPedido={(pedidoId) => {
              const p = pedidosFiltrados.find((x) => x.id === pedidoId);
              if (p) setDetalhe(p);
            }}
            onAlterarSetor={() => undefined}
            onAlterarLocal={() => undefined}
          />
        )}
      </main>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-charcoal px-5 py-3 text-sm font-semibold text-white shadow-xl">
          <span>
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          {selecionadosNaoArquivados.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmArquivar(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-olive px-3 py-1.5 text-xs hover:bg-olive/90"
            >
              <Archive className="h-3.5 w-3.5" />
              Concluir
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
          >
            Limpar
          </button>
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{detalhe?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {detalhe && <DetalhesPedido p={detalhe} />}
          {detalhe && !detalhe.archivedAt && (
            <div className="flex justify-end">
              <Button
                className="bg-olive text-white hover:bg-olive/90"
                disabled={arquivando}
                onClick={() => void concluirUm(detalhe.id)}
              >
                <Archive className="mr-2 h-4 w-4" />
                Concluir pedido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmArquivar} onOpenChange={(o) => !o && !arquivando && setConfirmArquivar(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Concluir {selecionadosNaoArquivados.length} pedido
              {selecionadosNaoArquivados.length !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selecionadosNaoArquivados.length === 1
              ? "O pedido será concluído, arquivado e sairá desta lista."
              : "Os pedidos serão concluídos, arquivados e sairão desta lista."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmArquivar(false)} disabled={arquivando}>
              Cancelar
            </Button>
            <Button onClick={() => void arquivarSelecionados()} disabled={arquivando}>
              {arquivando ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
