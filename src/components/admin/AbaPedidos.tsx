import { useEffect, useMemo, useState, useCallback } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/store/pedido";
import { toast } from "sonner";
import {
  ListOrdered,
  RefreshCw,
  Link2,
  Copy,
  Trash2,
  Plus,
  MessageCircle,
} from "lucide-react";
import {
  listarPedidos,
  rowToPedidoSalvo,
  type PedidoRow,
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

const STATUSES = ["todos", "aprovado", "pendente", "abandonado"] as const;

export function AbaPedidos() {
  const [pedidos, setPedidos] = useState<PedidoSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("todos");
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<PedidoSalvo | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const rows: PedidoRow[] = await listarPedidos();
    setPedidos(rows.map(rowToPedidoSalvo));
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
    return pedidos.filter((p) => {
      if (status !== "todos" && p.pagamento.status !== status) return false;
      if (
        filtro &&
        !`${p.cliente.nome} ${p.id}`.toLowerCase().includes(filtro.toLowerCase())
      )
        return false;
      return true;
    });
  }, [pedidos, filtro, status]);

  const hojeCount = pedidos.filter((p) => {
    const d = new Date(p.criadoEm);
    const h = new Date();
    return d.toDateString() === h.toDateString();
  }).length;

  const exportar = () => {
    if (filtrados.length === 0) {
      toast.error("Nenhum pedido para exportar.");
      return;
    }
    const head = [
      "ID",
      "Data/Hora",
      "Nome",
      "WhatsApp",
      "Cesta",
      "Sobremesas",
      "Tipo",
      "Endereço/Unidade",
      "Data entrega",
      "Horário",
      "Pagamento",
      "Status",
      "Total",
    ];
    const rows = filtrados.map((p) => [
      p.id,
      p.criadoEm,
      p.cliente.nome,
      p.cliente.whatsapp,
      p.cesta ? `${p.cesta.nome} x${p.cesta.quantidade}` : "",
      p.sobremesas.map((s) => `${s.nome} x${s.quantidade}`).join(" | "),
      p.tipo,
      p.enderecoOuUnidade,
      p.data ?? "",
      p.horario ?? "",
      p.pagamento.metodo,
      p.pagamento.status,
      String(p.total),
    ]);
    const csv = [head, ...rows]
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
              Compartilhe com quem prepara os pedidos. Acesso somente-leitura,
              sem login.
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
                  <code className="flex-1 truncate text-xs text-charcoal">
                    {url}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copiar(url)}
                  >
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por nome ou ID"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-64"
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof STATUSES)[number])
            }
            className="rounded-md border border-border bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={carregar}
            disabled={carregando}
            className="text-charcoal"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button
            onClick={exportar}
            className="bg-charcoal text-white hover:bg-charcoal/90"
          >
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
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Carregando pedidos…
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Nenhum pedido ainda.
                </td>
              </tr>
            ) : (
              filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDetalhe(p)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.criadoEm).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.cliente.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.cliente.whatsapp}
                    </p>
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
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.pagamento.status === "aprovado"
                          ? "bg-olive/15 text-olive"
                          : p.pagamento.status === "pendente"
                            ? "bg-terracotta/20 text-charcoal"
                            : "bg-terracotta/15 text-terracotta"
                      }`}
                    >
                      {p.pagamento.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-charcoal">
                    {formatBRL(p.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pedido #{detalhe?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {detalhe && <DetalhesPedidoAdmin p={detalhe} />}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}

function DetalhesPedidoAdmin({ p }: { p: PedidoSalvo }) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const status = p.pagamento?.status ?? "—";
  const statusCls =
    status === "aprovado"
      ? "bg-olive/15 text-olive"
      : status === "pendente"
        ? "bg-terracotta/20 text-charcoal"
        : "bg-terracotta/15 text-terracotta";

  return (
    <div className="space-y-5 text-sm">
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Cliente
        </p>
        <p className="font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Tipo
          </p>
          <p className="capitalize text-charcoal">{p.tipo || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Status
          </p>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls}`}
          >
            {status}
          </span>
        </div>
        <div className="col-span-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Endereço / Unidade
          </p>
          <p className="text-charcoal">{p.enderecoOuUnidade || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Data
          </p>
          <p className="text-charcoal">{p.data || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Horário
          </p>
          <p className="text-charcoal">{p.horario || "—"}</p>
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Itens
        </p>
        <div className="mt-1 space-y-1 text-charcoal">
          {p.cesta && (
            <div className="flex justify-between">
              <span>
                {p.cesta.nome} × {p.cesta.quantidade}
              </span>
              <span className="font-semibold">
                {formatBRL(p.cesta.preco * p.cesta.quantidade)}
              </span>
            </div>
          )}
          {p.sobremesas.map((s, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {s.nome} × {s.quantidade}
              </span>
              <span className="font-semibold">
                {formatBRL(s.preco * s.quantidade)}
              </span>
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
          <PedidoExtrasView
            cartoes={cartoes}
            polaroids={polaroids}
            variant="admin"
          />
        </section>
      )}

      <section className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-serif text-2xl font-bold text-terracotta">
          {formatBRL(p.total)}
        </span>
      </section>
    </div>
  );
}
