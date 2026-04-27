import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { RefreshCw, Printer, Eye, MessageCircle } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/pedidos/$token")({
  head: () => ({
    meta: [
      { title: "Pedidos — Casa Almeria" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CozinhaPage,
});

type Aba = "aguardando" | "aprovados";

function statusLabel(p: PedidoSalvo): { label: string; cls: string } {
  const s = (p.pagamento?.status || "").toLowerCase();
  if (s === "aprovado") return { label: "Aprovado", cls: "bg-olive/15 text-olive" };
  if (s === "pendente") return { label: "Aguardando pagamento", cls: "bg-terracotta/20 text-charcoal" };
  if (s === "rascunho") return { label: "Em preenchimento", cls: "bg-charcoal/10 text-charcoal" };
  if (s === "abandonado") return { label: "Abandonado", cls: "bg-terracotta/15 text-terracotta" };
  return { label: s || "—", cls: "bg-muted text-charcoal" };
}

function CozinhaPage() {
  const { token } = Route.useParams();
  const [pedidos, setPedidos] = useState<PedidoSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aba, setAba] = useState<Aba>("aprovados");
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);
  const [imprimindo, setImprimindo] = useState<PedidoSalvo[] | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const rows: PedidoRow[] = await listarPedidosPorToken(token);
    if (!rows || rows.length === 0) {
      // Não distinguimos token inválido vs lista vazia — mostramos lista vazia.
    }
    setPedidos(rows.map(rowToPedidoSalvo));
    setErro(false);
    setCarregando(false);
  }, [token]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 30_000);
    return () => clearInterval(id);
  }, [carregar]);

  const aprovados = useMemo(
    () => pedidos.filter((p) => (p.pagamento?.status || "").toLowerCase() === "aprovado"),
    [pedidos],
  );
  const aguardando = useMemo(
    () =>
      pedidos.filter((p) => {
        const s = (p.pagamento?.status || "").toLowerCase();
        return s === "pendente" || s === "rascunho";
      }),
    [pedidos],
  );

  const lista = aba === "aprovados" ? aprovados : aguardando;

  const imprimirUm = (p: PedidoSalvo) => {
    setImprimindo([p]);
    setTimeout(() => {
      window.print();
      setTimeout(() => setImprimindo(null), 500);
    }, 50);
  };

  const imprimirTodosAprovadosHoje = () => {
    const hoje = new Date().toDateString();
    const lista = aprovados.filter(
      (p) => new Date(p.criadoEm).toDateString() === hoje,
    );
    if (lista.length === 0) return;
    setImprimindo(lista);
    setTimeout(() => {
      window.print();
      setTimeout(() => setImprimindo(null), 500);
    }, 50);
  };

  return (
    <div className="min-h-screen bg-linen">
      {/* Tela (não imprime) */}
      <div className="print:hidden">
        <header className="bg-charcoal text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <h1 className="font-serif text-xl font-bold">Pedidos — Casa Almeria</h1>
              <p className="text-xs text-white/60">
                Atualização automática a cada 30s
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={carregar}
                disabled={carregando}
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button
                onClick={imprimirTodosAprovadosHoje}
                disabled={aprovados.length === 0}
                className="bg-terracotta text-white hover:bg-terracotta/90"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir aprovados de hoje
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setAba("aprovados")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                aba === "aprovados"
                  ? "bg-olive text-white"
                  : "bg-white text-charcoal ring-1 ring-border hover:bg-muted"
              }`}
            >
              Aprovados ({aprovados.length})
            </button>
            <button
              onClick={() => setAba("aguardando")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                aba === "aguardando"
                  ? "bg-terracotta text-white"
                  : "bg-white text-charcoal ring-1 ring-border hover:bg-muted"
              }`}
            >
              Aguardando ({aguardando.length})
            </button>
          </div>

          {carregando && pedidos.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Carregando pedidos…
            </p>
          ) : erro ? (
            <p className="py-12 text-center text-sm text-terracotta">
              Link inválido ou expirado.
            </p>
          ) : lista.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum pedido nesta lista.
            </p>
          ) : (
            <div className="grid gap-3">
              {lista.map((p) => {
                const st = statusLabel(p);
                const tel = p.cliente.whatsapp.replace(/\D/g, "");
                return (
                  <article
                    key={p.id}
                    className="rounded-2xl bg-white p-4 ring-1 ring-border"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                            {st.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            #{p.id.slice(0, 8)} · {new Date(p.criadoEm).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-2 font-serif text-lg font-bold text-charcoal">
                          {p.cliente.nome || "(sem nome)"}
                        </p>
                        {tel && (
                          <a
                            href={`https://wa.me/55${tel}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-olive hover:underline"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {p.cliente.whatsapp}
                          </a>
                        )}
                        <div className="mt-2 text-sm text-charcoal">
                          {p.cesta?.nome ? (
                            <span>
                              {p.cesta.nome} × {p.cesta.quantidade}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">— sem cesta —</span>
                          )}
                          {p.sobremesas.length > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              + {p.sobremesas.length} sobremesa(s)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.tipo ? `${p.tipo}` : ""}
                          {p.enderecoOuUnidade ? ` · ${p.enderecoOuUnidade}` : ""}
                          {p.data ? ` · ${p.data}` : ""}
                          {p.horario ? ` · ${p.horario}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="font-serif text-xl font-bold text-terracotta">
                          {formatBRL(p.total)}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetalhe(p)}
                          >
                            <Eye className="mr-1 h-4 w-4" /> Detalhes
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => imprimirUm(p)}
                            className="bg-charcoal text-white hover:bg-charcoal/90"
                          >
                            <Printer className="mr-1 h-4 w-4" /> Imprimir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Folha de impressão */}
      {imprimindo && (
        <div className="hidden print:block">
          {imprimindo.map((p) => (
            <FolhaImpressao key={p.id} p={p} />
          ))}
        </div>
      )}

      {/* Modal detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Pedido #{detalhe?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {detalhe && <DetalhesPedido p={detalhe} />}
          {detalhe && (
            <div className="flex justify-end">
              <Button
                onClick={() => imprimirUm(detalhe)}
                className="bg-charcoal text-white hover:bg-charcoal/90"
              >
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

function DetalhesPedido({ p }: { p: PedidoSalvo }) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
        <p className="font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
        {tel && (
          <a
            href={`https://wa.me/55${tel}`}
            target="_blank"
            rel="noreferrer"
            className="text-olive hover:underline"
          >
            {p.cliente.whatsapp}
          </a>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens</p>
        {p.cesta && (
          <p>
            {p.cesta.nome} × {p.cesta.quantidade} —{" "}
            {formatBRL(p.cesta.preco * p.cesta.quantidade)}
          </p>
        )}
        {p.sobremesas.map((s, i) => (
          <p key={i}>
            {s.nome} × {s.quantidade} — {formatBRL(s.preco * s.quantidade)}
          </p>
        ))}
      </div>
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Endereço / Unidade
          </p>
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
        <span className="font-serif text-lg font-bold text-terracotta">
          {formatBRL(p.total)}
        </span>
      </div>
    </div>
  );
}

function FolhaImpressao({ p }: { p: PedidoSalvo }) {
  const tel = p.cliente.whatsapp;
  return (
    <div
      style={{
        pageBreakAfter: "always",
        padding: "20mm 15mm",
        fontFamily: "system-ui, sans-serif",
        color: "#000",
        fontSize: "12pt",
      }}
    >
      <div style={{ borderBottom: "2px solid #000", paddingBottom: "8pt", marginBottom: "12pt" }}>
        <h1 style={{ fontSize: "18pt", margin: 0 }}>Casa Almeria — Pedido</h1>
        <p style={{ fontSize: "10pt", margin: "4pt 0 0" }}>
          #{p.id.slice(0, 8)} · {new Date(p.criadoEm).toLocaleString("pt-BR")}
        </p>
      </div>
      <p>
        <strong>Cliente:</strong> {p.cliente.nome || "—"}
      </p>
      <p>
        <strong>WhatsApp:</strong> {tel || "—"}
      </p>
      <p>
        <strong>Status:</strong> {p.pagamento?.status || "—"}
      </p>
      <hr style={{ margin: "10pt 0" }} />
      <p style={{ fontWeight: "bold", marginBottom: "4pt" }}>Itens</p>
      {p.cesta && (
        <p>
          • {p.cesta.nome} × {p.cesta.quantidade} —{" "}
          {formatBRL(p.cesta.preco * p.cesta.quantidade)}
        </p>
      )}
      {p.sobremesas.map((s, i) => (
        <p key={i}>
          • {s.nome} × {s.quantidade} — {formatBRL(s.preco * s.quantidade)}
        </p>
      ))}
      <hr style={{ margin: "10pt 0" }} />
      <p>
        <strong>Tipo:</strong> {p.tipo || "—"}
      </p>
      <p>
        <strong>Endereço/Unidade:</strong> {p.enderecoOuUnidade || "—"}
      </p>
      <p>
        <strong>Data:</strong> {p.data || "—"} · <strong>Horário:</strong>{" "}
        {p.horario || "—"}
      </p>
      <hr style={{ margin: "10pt 0" }} />
      <p style={{ fontSize: "16pt", fontWeight: "bold", textAlign: "right" }}>
        Total: {formatBRL(p.total)}
      </p>
    </div>
  );
}
