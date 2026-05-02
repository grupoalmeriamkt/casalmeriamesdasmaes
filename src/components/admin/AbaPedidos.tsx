import { useEffect, useMemo, useState, useCallback } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/store/pedido";
import { toast } from "sonner";
import { ListOrdered, RefreshCw, Link2, Copy, Trash2, Plus, MessageCircle } from "lucide-react";
import {
  listarPedidos,
  rowToPedidoSalvo,
  type PedidoRow,
  type PagamentoAsaasRow,
} from "@/lib/pedidos";
import {
  listarTokensPedidos,
  criarTokenPedidos,
  revogarToken,
  urlPublicaPedidos,
  type ShareToken,
} from "@/lib/shareToken";
import type { PedidoSalvo } from "@/store/admin";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";

const STATUSES = ["todos", "pago", "aguardando", "vencido", "cancelado"] as const;

// Pega o pagamento Asaas mais recente do pedido
function ultimoPagamento(p: PedidoRow): PagamentoAsaasRow | undefined {
  const lista = p.pagamentos ?? [];
  if (lista.length === 0) return undefined;
  return [...lista].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
}

const ASAAS_LABEL: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Pago", cls: "bg-emerald-100 text-emerald-700" },
  RECEIVED: { label: "Recebido", cls: "bg-emerald-100 text-emerald-700" },
  PENDING: { label: "Aguardando", cls: "bg-amber-100 text-amber-700" },
  OVERDUE: { label: "Vencido", cls: "bg-orange-100 text-orange-700" },
  REFUNDED: { label: "Estornado", cls: "bg-zinc-200 text-zinc-700" },
  REFUND_REQUESTED: { label: "Estorno em andamento", cls: "bg-zinc-200 text-zinc-700" },
  CHARGEBACK_REQUESTED: { label: "Chargeback", cls: "bg-red-100 text-red-700" },
  CHARGEBACK_DISPUTE: { label: "Chargeback", cls: "bg-red-100 text-red-700" },
  PAYMENT_DELETED: { label: "Cancelada", cls: "bg-zinc-200 text-zinc-700" },
};

function statusBadge(asaasStatus?: string, pedidoStatus?: string) {
  if (asaasStatus && ASAAS_LABEL[asaasStatus]) return ASAAS_LABEL[asaasStatus];
  // Fallback pro status local do pedido
  if (pedidoStatus === "pago") return { label: "Pago", cls: "bg-emerald-100 text-emerald-700" };
  if (pedidoStatus === "aguardando_pagamento")
    return { label: "Aguardando", cls: "bg-amber-100 text-amber-700" };
  if (pedidoStatus === "vencido") return { label: "Vencido", cls: "bg-orange-100 text-orange-700" };
  if (pedidoStatus === "cancelado") return { label: "Cancelado", cls: "bg-zinc-200 text-zinc-700" };
  return { label: pedidoStatus ?? "—", cls: "bg-zinc-100 text-zinc-700" };
}

function categoria(asaasStatus?: string, pedidoStatus?: string): string {
  if (asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED" || pedidoStatus === "pago")
    return "pago";
  if (asaasStatus === "PENDING" || pedidoStatus === "aguardando_pagamento") return "aguardando";
  if (asaasStatus === "OVERDUE" || pedidoStatus === "vencido") return "vencido";
  if (
    asaasStatus === "REFUNDED" ||
    asaasStatus === "PAYMENT_DELETED" ||
    pedidoStatus === "cancelado"
  )
    return "cancelado";
  return "outro";
}

export function AbaPedidos() {
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("todos");
  const [filtroTipo, setFiltroTipo] = useState<"" | "delivery" | "retirada">("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroPolaroid, setFiltroPolaroid] = useState(false);
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<{ pedido: PedidoSalvo; row: PedidoRow } | null>(null);

  const pedidos: PedidoSalvo[] = useMemo(() => rows.map(rowToPedidoSalvo), [rows]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const data = await listarPedidos();
    setRows(data);
    setCarregando(false);
  }, []);

  const carregarTokens = useCallback(async () => {
    setTokens(await listarTokensPedidos());
  }, []);

  useEffect(() => {
    carregar();
    carregarTokens();
  }, [carregar, carregarTokens]);

  const gerarLink = async () => {
    setTokensLoading(true);
    const t = await criarTokenPedidos();
    setTokensLoading(false);
    if (!t) return toast.error("Não foi possível gerar o link.");
    toast.success("Link público criado.");
    await carregarTokens();
  };

  const revogar = async (token: string) => {
    if (!confirm("Revogar este link? Quem tiver a URL perderá acesso.")) return;
    const ok = await revogarToken(token);
    if (!ok) return toast.error("Falha ao revogar.");
    toast.success("Link revogado.");
    await carregarTokens();
  };

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const filtrados = useMemo(() => {
    return rows.filter((r) => {
      const pag = ultimoPagamento(r);
      const cat = categoria(pag?.status, r.status);
      if (status !== "todos" && cat !== status) return false;
      if (filtro && !`${r.cliente_nome} ${r.id} ${pag?.asaas_payment_id ?? ""}`.toLowerCase().includes(filtro.toLowerCase())) return false;
      if (filtroTipo && r.tipo?.toLowerCase() !== filtroTipo) return false;
      if (filtroData && r.data_entrega !== filtroData) return false;
      if (filtroPolaroid) {
        const p = rowToPedidoSalvo(r);
        if (!((p.pagamento?.extras?.polaroids?.length ?? 0) > 0)) return false;
      }
      return true;
    });
  }, [rows, filtro, status, filtroTipo, filtroData, filtroPolaroid]);

  const hojeCount = rows.filter((r) => {
    const d = new Date(r.criado_em);
    const h = new Date();
    return d.toDateString() === h.toDateString();
  }).length;
  const pagosCount = rows.filter((r) => {
    const pag = ultimoPagamento(r);
    return categoria(pag?.status, r.status) === "pago";
  }).length;
  const aguardandoCount = rows.filter((r) => {
    const pag = ultimoPagamento(r);
    return categoria(pag?.status, r.status) === "aguardando";
  }).length;
  const totalArrecadado = rows.reduce((acc, r) => {
    const pag = ultimoPagamento(r);
    if (categoria(pag?.status, r.status) === "pago") return acc + Number(r.total);
    return acc;
  }, 0);

  const exportar = () => {
    if (filtrados.length === 0) {
      toast.error("Nenhum pedido para exportar.");
      return;
    }
    const head = [
      "ID",
      "Data/Hora",
      "Nome",
      "CPF",
      "Email",
      "WhatsApp",
      "Cesta",
      "Sobremesas",
      "Tipo",
      "Endereço/Unidade",
      "Data entrega",
      "Horário",
      "Método",
      "Status Asaas",
      "Asaas ID",
      "Cupom",
      "Desconto",
      "Total",
    ];
    const csvRows = filtrados.map((r) => {
      const pag = ultimoPagamento(r);
      const p = rowToPedidoSalvo(r);
      return [
        r.id,
        r.criado_em,
        r.cliente_nome,
        r.cliente_cpf ?? "",
        r.cliente_email ?? "",
        r.cliente_whatsapp,
        p.cesta ? `${p.cesta.nome} x${p.cesta.quantidade}` : "",
        p.sobremesas.map((s) => `${s.nome} x${s.quantidade}`).join(" | "),
        p.tipo,
        p.enderecoOuUnidade,
        p.data ?? "",
        p.horario ?? "",
        pag?.metodo ?? p.pagamento.metodo,
        pag?.status ?? p.pagamento.status,
        pag?.asaas_payment_id ?? "",
        pag?.cupom_codigo ?? "",
        pag?.cupom_desconto != null ? String(pag.cupom_desconto) : "",
        String(r.total),
      ];
    });
    const csv = [head, ...csvRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-casa-almeria-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminSection
      title="Pedidos recebidos"
      icon={<ListOrdered className="h-5 w-5" />}
      description="Pedidos sincronizados do banco de dados (Supabase)."
    >
      {/* Link público para a equipe da cozinha */}
      <div className="rounded-2xl border border-border bg-linen/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-charcoal">
              <Link2 className="h-4 w-4" /> Link público da cozinha
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compartilhe com quem prepara os pedidos. Acesso somente-leitura, sem login.
            </p>
          </div>
          <Button
            size="sm"
            onClick={gerarLink}
            disabled={tokensLoading}
            className="bg-charcoal text-white hover:bg-charcoal/90"
          >
            <Plus className="mr-1 h-4 w-4" /> Gerar link
          </Button>
        </div>
        {tokens.length > 0 && (
          <ul className="mt-3 space-y-2">
            {tokens.map((t) => {
              const url = urlPublicaPedidos(t.token);
              return (
                <li
                  key={t.token}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-border"
                >
                  <code className="flex-1 truncate text-xs text-charcoal">{url}</code>
                  <Button size="sm" variant="outline" onClick={() => copiar(url)}>
                    <Copy className="mr-1 h-3 w-3" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revogar(t.token)}
                    className="text-terracotta hover:text-terracotta"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-olive/15 px-3 py-1 text-sm font-bold text-olive">
          {hojeCount} hoje
        </span>
        <span className="rounded-full bg-charcoal/10 px-3 py-1 text-sm font-bold text-charcoal">
          {pedidos.length} no total
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
          {pagosCount} pago{pagosCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
          {aguardandoCount} aguardando
        </span>
        <span className="rounded-full bg-charcoal text-white px-3 py-1 text-sm font-bold">
          {formatBRL(totalArrecadado)} arrecadado
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nome ou ID"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-64"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="rounded-md border border-border bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as "" | "delivery" | "retirada")}
            className="rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="delivery">Delivery</option>
            <option value="retirada">Retirada</option>
          </select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Entrega:</label>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            {filtroData && (
              <button onClick={() => setFiltroData("")} className="text-muted-foreground hover:text-charcoal">
                <span className="text-sm">×</span>
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltroPolaroid((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroPolaroid ? "bg-charcoal text-white" : "border border-border bg-background text-charcoal hover:bg-muted"
            }`}
          >
            📸 Com polaroid
          </button>
          <Button
            variant="outline"
            onClick={carregar}
            disabled={carregando}
            className="text-charcoal"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={exportar} className="bg-charcoal text-white hover:bg-charcoal/90">
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-linen text-left text-xs uppercase tracking-widest text-charcoal">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Carregando pedidos…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum pedido ainda.
                </td>
              </tr>
            ) : (
              filtrados.map((r) => {
                const p = rowToPedidoSalvo(r);
                const pag = ultimoPagamento(r);
                const badge = statusBadge(pag?.status, r.status);
                const metodo =
                  pag?.metodo === "PIX"
                    ? "PIX"
                    : pag?.metodo === "CREDIT_CARD"
                      ? `Cartão ${pag.cartao_brand?.toUpperCase() ?? ""} ••${pag.cartao_last4 ?? ""}`
                      : p.pagamento.metodo || "—";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setDetalhe({ pedido: p, row: r })}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{r.cliente_whatsapp}</p>
                    </td>
                    <td className="px-4 py-3">
                      {p.cesta?.nome}
                      {p.sobremesas.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{p.sobremesas.length} sobremesa(s)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{p.tipo}</td>
                    <td className="px-4 py-3 text-xs text-charcoal">{metodo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-charcoal">
                      {formatBRL(Number(r.total))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{detalhe?.pedido.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {detalhe && <DetalhesPedidoAdmin p={detalhe.pedido} row={detalhe.row} />}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}

function DetalhesPedidoAdmin({ p, row }: { p: PedidoSalvo; row: PedidoRow }) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const pagamentos = (row.pagamentos ?? [])
    .slice()
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const ultimo = pagamentos[0];
  const badge = statusBadge(ultimo?.status, row.status);

  return (
    <div className="space-y-5 text-sm">
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Cliente</p>
        <p className="font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
        {row.cliente_cpf && <p className="text-xs text-muted-foreground">CPF: {row.cliente_cpf}</p>}
        {row.cliente_email && <p className="text-xs text-muted-foreground">{row.cliente_email}</p>}
        {tel && (
          <a
            href={`https://wa.me/55${tel}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-olive hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {p.cliente.whatsapp}
          </a>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tipo</p>
          <p className="capitalize text-charcoal">{p.tipo || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="col-span-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Endereço / Unidade
          </p>
          <p className="text-charcoal">{p.enderecoOuUnidade || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Data</p>
          <p className="text-charcoal">{p.data || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Horário</p>
          <p className="text-charcoal">{p.horario || "—"}</p>
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Itens</p>
        <div className="mt-1 space-y-1 text-charcoal">
          {p.cesta && (
            <div className="flex justify-between">
              <span>
                {p.cesta.nome} × {p.cesta.quantidade}
              </span>
              <span className="font-semibold">{formatBRL(p.cesta.preco * p.cesta.quantidade)}</span>
            </div>
          )}
          {p.sobremesas.map((s, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {s.nome} × {s.quantidade}
              </span>
              <span className="font-semibold">{formatBRL(s.preco * s.quantidade)}</span>
            </div>
          ))}
          {!p.cesta && p.sobremesas.length === 0 && (
            <p className="text-muted-foreground">— sem itens —</p>
          )}
        </div>
      </section>

      {(cartoes.length > 0 || polaroids.length > 0) && (
        <section>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Personalizações
          </p>
          <PedidoExtrasView cartoes={cartoes} polaroids={polaroids} variant="admin" />
        </section>
      )}

      {pagamentos.length > 0 && (
        <section className="rounded-lg bg-linen/50 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Pagamento (Asaas)
          </p>
          <div className="space-y-2">
            {pagamentos.map((pag) => {
              const b = statusBadge(pag.status);
              return (
                <div key={pag.id} className="rounded-md bg-white p-2 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-charcoal">{pag.asaas_payment_id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
                      {b.label}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      Método:{" "}
                      <span className="text-charcoal">
                        {pag.metodo === "CREDIT_CARD"
                          ? `Cartão ${pag.cartao_brand?.toUpperCase() ?? ""} ••${pag.cartao_last4 ?? ""}`
                          : pag.metodo}
                      </span>
                    </div>
                    <div>
                      Valor: <span className="text-charcoal">{formatBRL(Number(pag.valor))}</span>
                    </div>
                    {pag.cupom_codigo && (
                      <div className="col-span-2">
                        Cupom: <span className="text-charcoal">{pag.cupom_codigo}</span>
                        {pag.cupom_desconto != null && (
                          <span className="text-emerald-700">
                            {" "}
                            (−{formatBRL(Number(pag.cupom_desconto))})
                          </span>
                        )}
                      </div>
                    )}
                    <div className="col-span-2">
                      <a
                        href={`https://www.asaas.com/i/${pag.asaas_payment_id.replace(/^pay_/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Ver no Asaas →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-serif text-2xl font-bold text-terracotta">{formatBRL(p.total)}</span>
      </section>
    </div>
  );
}
