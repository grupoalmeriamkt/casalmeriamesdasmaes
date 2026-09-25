import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MOTIVO_RECUPERACAO_LABEL,
  motivoRecuperacaoPedido,
  pedidoNaFilaAprovados,
  type MotivoRecuperacao,
} from "@/lib/statusPedidoTela";
import {
  arquivarPedidos,
  listarPedidosPorToken,
  rowToPedidoSalvo,
  type PedidoRow,
} from "@/lib/pedidos";
import type { PedidoSalvo } from "@/store/admin";
import { Button } from "@/components/ui/button";
import { PedidoManualModal } from "@/components/pedidoManual/PedidoManualModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Archive, CheckCircle2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ordenarPorEntrega } from "@/lib/pedidosSort";
import { sortPedidosPorCriadoDesc } from "@/lib/operacaoPedido";
import { EncomendasTable } from "@/components/operacao/EncomendasTable";
import { PlanilhaFiltrosBar } from "@/components/operacao/PlanilhaFiltrosBar";
import { flattenPedidosParaLinhas, locaisPlanilhaOpcoes } from "@/lib/encomendasTable";
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
import { formatBRL } from "@/store/pedido";
import {
  DIAS_LISTA_RECUPERACAO,
  dentroDaJanelaRecuperacao,
  linkWhatsApp,
  mensagemRecuperacaoPedido,
  resumoTempoDesde,
} from "@/lib/recuperacaoPedido";

function horaNow() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type Aba = "fila" | "recuperar";

/** Ação que tira o pedido da fila: as duas arquivam, só "concluir" marca como finalizado. */
type AcaoFila = "concluir" | "arquivar";

const BADGE_MOTIVO: Record<MotivoRecuperacao, string> = {
  aguardando: "bg-amber-100 text-amber-900",
  vencido: "bg-orange-100 text-orange-900",
  expirado: "bg-red-100 text-red-900",
};

function resumoItens(p: PedidoSalvo): string {
  const nomes = [
    p.cesta?.nome,
    ...(Array.isArray(p.sobremesas) ? p.sobremesas.map((s) => s?.nome) : []),
  ].filter((n): n is string => !!n);
  return nomes.length > 0 ? nomes.join(" · ") : "Sem itens registrados";
}

function CardRecuperacao({
  p,
  motivo,
  onDetalhes,
}: {
  p: PedidoSalvo;
  motivo: MotivoRecuperacao;
  onDetalhes: () => void;
}) {
  const telefone = p.cliente.whatsapp ?? "";
  const temTelefone = telefone.replace(/\D/g, "").length >= 10;
  const mensagem = mensagemRecuperacaoPedido({
    nome: p.cliente.nome ?? "",
    pedidoId: p.id,
    total: p.total,
  });

  return (
    <li className="rounded-2xl border border-border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-charcoal">{p.cliente.nome || "Sem nome"}</p>
          <p className="text-xs text-muted-foreground">
            {telefone || "Sem telefone"} · {resumoTempoDesde(p.criadoEm)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_MOTIVO[motivo]}`}
        >
          {MOTIVO_RECUPERACAO_LABEL[motivo]}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{resumoItens(p)}</p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-charcoal">{formatBRL(p.total)}</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDetalhes}>
            Detalhes
          </Button>
          {temTelefone ? (
            <Button size="sm" className="bg-olive text-white hover:bg-olive/90" asChild>
              <a href={linkWhatsApp(telefone, mensagem)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                WhatsApp
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Sem telefone
            </Button>
          )}
        </div>
      </div>
    </li>
  );
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
  const [aba, setAba] = useState<Aba>("fila");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"" | "delivery" | "retirada">("");
  const [filtroData, setFiltroData] = useState("");
  const [filtrosPlanilha, setFiltrosPlanilha] = useState<FiltrosPlanilha>(FILTROS_PLANILHA_VAZIOS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);
  const [confirmAcao, setConfirmAcao] = useState<AcaoFila | null>(null);
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

  // Defesa em profundidade: recomputa do pagamento relevante e NÃO confia na coluna
  // payment_status_normalized. Concluídos e arquivados saem da fila, como na central.
  const pedidosAprovados = useMemo(
    () => pedidos.filter((p) => pedidoNaFilaAprovados(p, rawRowsById.get(p.id)?.status)),
    [pedidos, rawRowsById],
  );

  const buscaCasa = useCallback(
    (p: PedidoSalvo) => {
      if (!filtroTexto) return true;
      const q = filtroTexto.toLowerCase();
      const hay =
        `${p.cliente.nome} ${p.cliente.whatsapp} ${p.destinatario?.nome ?? ""} ${p.id}`.toLowerCase();
      return hay.includes(q);
    },
    [filtroTexto],
  );

  const pedidosFiltrados = useMemo(() => {
    return pedidosAprovados.filter((p) => {
      if (filtroTipo && p.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroData && p.data !== filtroData) return false;
      return buscaCasa(p);
    });
  }, [pedidosAprovados, filtroTipo, filtroData, buscaCasa]);

  /** Pedidos que chegaram à cobrança e não foram pagos — a operação liga para recuperar. */
  const pedidosRecuperacao = useMemo(() => {
    const lista: { pedido: PedidoSalvo; motivo: MotivoRecuperacao }[] = [];
    const agora = new Date();
    for (const p of pedidos) {
      if (!dentroDaJanelaRecuperacao(p.criadoEm, agora)) continue;
      const motivo = motivoRecuperacaoPedido(p, rawRowsById.get(p.id)?.status);
      if (motivo) lista.push({ pedido: p, motivo });
    }
    return lista;
  }, [pedidos, rawRowsById]);

  const recuperacaoFiltrada = useMemo(
    () => pedidosRecuperacao.filter(({ pedido }) => buscaCasa(pedido)),
    [pedidosRecuperacao, buscaCasa],
  );

  const locaisOpcoes = useMemo(() => locaisPlanilhaOpcoes(), []);
  const linhasEncomenda = useMemo(
    () => flattenPedidosParaLinhas(ordenarPorEntrega(pedidosFiltrados), rawRows, unidades),
    [pedidosFiltrados, rawRows, unidades],
  );
  const linhasVisiveis = useMemo(
    () => filtrarLinhasEncomenda(linhasEncomenda, filtrosPlanilha, locaisOpcoes),
    [linhasEncomenda, filtrosPlanilha, locaisOpcoes],
  );
  const produtosOpcoes = useMemo(() => produtosUnicosDasLinhas(linhasEncomenda), [linhasEncomenda]);

  const selecionadosNaoArquivados = useMemo(
    () => pedidosFiltrados.filter((p) => selectedIds.has(p.id) && !p.archivedAt),
    [pedidosFiltrados, selectedIds],
  );

  const detalheNaFila = useMemo(
    () => !!detalhe && pedidosAprovados.some((p) => p.id === detalhe.id),
    [detalhe, pedidosAprovados],
  );

  const toggleSelecionado = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tirarDaFila = async (ids: string[], acao: AcaoFila) => {
    if (ids.length === 0) return;
    setArquivando(true);
    const res = await arquivarPedidos(
      ids,
      acao === "arquivar" ? { marcarFinalizado: false } : undefined,
    );
    setArquivando(false);
    setConfirmAcao(null);
    setSelectedIds(new Set());
    setDetalhe(null);
    if (!res.ok) {
      toast.error(acao === "concluir" ? "Erro ao concluir pedidos" : "Erro ao arquivar pedidos", {
        description: res.error,
      });
      return;
    }
    const afetados = new Set(ids);
    const agora = new Date().toISOString();
    setPedidos((prev) => prev.map((p) => (afetados.has(p.id) ? { ...p, archivedAt: agora } : p)));
    setRawRows((prev) =>
      prev.map((r) =>
        afetados.has(r.id)
          ? {
              ...r,
              archived_at: agora,
              ...(acao === "concluir" ? { fulfillment_stage: "finalizado" } : {}),
            }
          : r,
      ),
    );
    const n = res.arquivados ?? ids.length;
    const label = acao === "concluir" ? "concluído" : "arquivado";
    toast.success(n === 1 ? `Pedido ${label}!` : `${n} pedidos ${label}s!`);
  };

  const limparFiltrosPlanilha = () => setFiltrosPlanilha(FILTROS_PLANILHA_VAZIOS);

  const abas: { id: Aba; label: string; contagem: number }[] = [
    { id: "fila", label: "Aprovados", contagem: pedidosFiltrados.length },
    { id: "recuperar", label: "A recuperar", contagem: recuperacaoFiltrada.length },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-linen">
      <header className="shrink-0 bg-charcoal text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Operação restrita
            </p>
            <h1 className="font-serif text-xl font-bold">
              {aba === "fila" ? "Pedidos aprovados" : "Pedidos a recuperar"}
            </h1>
            <p className="text-xs text-white/50">
              {ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao}` : "Carregando…"}
              {" · "}
              {aba === "fila"
                ? `${pedidosFiltrados.length} na fila · Selecione e use Concluir ou Arquivar`
                : `${recuperacaoFiltrada.length} sem pagamento nos últimos ${DIAS_LISTA_RECUPERACAO} dias · Chame no WhatsApp`}
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

        <div className="flex gap-1 px-3 pb-2 sm:px-4">
          {abas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setAba(t.id);
                setSelectedIds(new Set());
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                aba === t.id ? "bg-white text-charcoal" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {t.label} ({t.contagem})
            </button>
          ))}
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
          {aba === "fila" && (
            <>
              <div className="flex flex-wrap gap-1">
                {(["", "delivery", "retirada"] as const).map((t) => (
                  <button
                    key={t || "todos"}
                    type="button"
                    onClick={() => setFiltroTipo(t)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      filtroTipo === t
                        ? "bg-charcoal text-white"
                        : "bg-linen text-charcoal hover:bg-charcoal/10"
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
            </>
          )}
        </div>
        {aba === "fila" && (
          <>
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
          </>
        )}
      </div>

      <main className="flex min-h-0 flex-1 flex-col px-2 pb-20 pt-2 sm:px-3">
        {carregando && pedidos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Carregando pedidos…</p>
        ) : aba === "recuperar" ? (
          recuperacaoFiltrada.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhum pedido esperando pagamento nos últimos {DIAS_LISTA_RECUPERACAO} dias.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {recuperacaoFiltrada.map(({ pedido, motivo }) => (
                <CardRecuperacao
                  key={pedido.id}
                  p={pedido}
                  motivo={motivo}
                  onDetalhes={() => setDetalhe(pedido)}
                />
              ))}
            </ul>
          )
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

      {aba === "fila" && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-charcoal px-5 py-3 text-sm font-semibold text-white shadow-xl">
          <span>
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          {selecionadosNaoArquivados.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setConfirmAcao("concluir")}
                className="inline-flex items-center gap-1 rounded-lg bg-olive px-3 py-1.5 text-xs hover:bg-olive/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmAcao("arquivar")}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
              >
                <Archive className="h-3.5 w-3.5" />
                Arquivar
              </button>
            </>
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
          {detalhe && detalheNaFila && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={arquivando}
                onClick={() => void tirarDaFila([detalhe.id], "arquivar")}
              >
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </Button>
              <Button
                className="bg-olive text-white hover:bg-olive/90"
                disabled={arquivando}
                onClick={() => void tirarDaFila([detalhe.id], "concluir")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Concluir pedido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAcao} onOpenChange={(o) => !o && !arquivando && setConfirmAcao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAcao === "arquivar" ? "Arquivar" : "Concluir"}{" "}
              {selecionadosNaoArquivados.length} pedido
              {selecionadosNaoArquivados.length !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAcao === "arquivar"
              ? "Sai desta lista sem marcar como finalizado. Use quando o pedido não vai ser produzido."
              : "Marca como finalizado, arquiva e sai desta lista."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmAcao(null)} disabled={arquivando}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                void tirarDaFila(
                  selecionadosNaoArquivados.map((p) => p.id),
                  confirmAcao ?? "concluir",
                )
              }
              disabled={arquivando}
            >
              {arquivando ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
