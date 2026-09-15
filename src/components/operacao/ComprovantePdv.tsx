import { FileText, Store } from "lucide-react";
import type { PedidoSalvo } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { formatItemPedidoLabel } from "@/lib/cestaTamanho";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PosExtras = { bandeira?: string; tipo?: "credito" | "debito"; nome?: string };

function formaPagamentoPdv(p: PedidoSalvo): string {
  if (p.pagamento?.metodo !== "pos") return "Dinheiro";
  const pos = (p.pagamento.extras as { pos?: PosExtras } | undefined)?.pos;
  const tipo = pos?.tipo === "debito" ? "débito" : pos?.tipo === "credito" ? "crédito" : null;
  return ["Maquininha", pos?.bandeira, tipo].filter(Boolean).join(" · ");
}

/**
 * Comprovante interno de pedido pago no balcão pelo "Novo Pedido" (dinheiro/POS).
 * Não há cobrança no Asaas, então mostramos o resumo do pedido com o aviso de venda no PDV.
 */
export function ComprovantePdv({ p }: { p: PedidoSalvo }) {
  const cartoes = p.pagamento?.extras?.cartoes ?? [];
  const polaroids = p.pagamento?.extras?.polaroids ?? [];
  const desconto = Number(p.pagamento?.desconto ?? 0);
  const linhas = [
    ...(p.cesta
      ? [
          {
            label: `${formatItemPedidoLabel(p.cesta)} × ${p.cesta.quantidade}`,
            valor: p.cesta.preco * p.cesta.quantidade,
          },
        ]
      : []),
    ...p.sobremesas.map((s) => ({
      label: `${formatItemPedidoLabel(s)} × ${s.quantidade}`,
      valor: s.preco * s.quantidade,
    })),
    ...cartoes.map((c) => ({ label: c.nome, valor: c.preco })),
    ...polaroids.map((po) => ({ label: po.nome, valor: po.preco })),
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-olive/40 bg-olive/5 px-4 py-2.5 text-sm font-semibold text-olive transition-colors hover:bg-olive/10">
          <FileText className="h-4 w-4" /> Ver comprovante de pagamento
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Comprovante de pagamento</DialogTitle>
          <DialogDescription>
            Pedido #{p.id.slice(-6).toUpperCase()} · {new Date(p.criadoEm).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">
          <Store className="h-4 w-4 shrink-0" />
          Venda feita no PDV
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
            <p className="font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
          </div>

          <div className="space-y-1 border-t border-border pt-2">
            {linhas.map((l, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="min-w-0 text-charcoal">{l.label}</span>
                <span className="shrink-0 tabular-nums">{formatBRL(l.valor)}</span>
              </div>
            ))}
            {desconto > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Desconto{p.pagamento?.cupom ? ` (${p.pagamento.cupom})` : ""}</span>
                <span className="tabular-nums">−{formatBRL(desconto)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold text-charcoal">Total pago</span>
            <span className="text-lg font-bold tabular-nums text-charcoal">
              {formatBRL(p.total)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Forma de pagamento</span>
            <span>{formaPagamentoPdv(p)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
