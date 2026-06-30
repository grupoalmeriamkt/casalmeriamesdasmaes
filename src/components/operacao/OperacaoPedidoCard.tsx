import type { PedidoOperacional } from "@/lib/operacaoPedido";
import { SETOR_BADGE } from "@/lib/operacaoPedido";
import {
  badgeKeySetorOperacao,
  labelSetorOperacao,
  SETOR_OPERACAO_BADGE_PLANILHA,
} from "@/lib/setoresOperacao";
import { labelTipoPedido } from "@/lib/asaasStatus";
import { PAYMENT_STATUS_LABEL } from "@/lib/paymentStatus";
import { labelGrupoExecucao } from "@/lib/timezone";
import { formatBRL } from "@/store/pedido";
import type { PedidoSalvo } from "@/store/admin";
import { Button } from "@/components/ui/button";
import { Eye, MessageCircle, Printer } from "lucide-react";

type Props = {
  p: PedidoOperacional;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
};

export function OperacaoPedidoCard({ p, onDetalhe, onImprimir }: Props) {
  const tel = p.recipientPhone.replace(/\D/g, "");
  const status = p.paymentStatusNormalized ?? "aguardando";

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-olive/15 px-2 py-0.5 text-xs font-semibold text-olive">
              {PAYMENT_STATUS_LABEL[status]}
            </span>
            <span className="font-mono text-xs font-bold text-charcoal">
              #{p.id.slice(-6).toUpperCase()}
            </span>
            {p.productionSector && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  SETOR_OPERACAO_BADGE_PLANILHA[badgeKeySetorOperacao(p.productionSector)] ??
                  SETOR_BADGE[p.productionSector as keyof typeof SETOR_BADGE] ??
                  SETOR_OPERACAO_BADGE_PLANILHA.outro
                }`}
              >
                {labelSetorOperacao(p.productionSector)}
              </span>
            )}
          </div>

          <p className="mt-2 font-serif text-xl font-bold text-charcoal leading-tight">
            {p.recipientName || "(sem destinatário)"}
          </p>
          {tel && (
            <a
              href={`https://wa.me/55${tel}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-olive hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {p.recipientPhone}
            </a>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-charcoal">
            {p.cesta?.nome && (
              <span className="font-medium">
                {p.cesta.nome} × {p.cesta.quantidade}
              </span>
            )}
            {p.sobremesas.length > 0 && (
              <span className="text-charcoal/60">
                +{p.sobremesas.length} item(ns)
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {[labelTipoPedido(p.tipo), p.enderecoOuUnidade, p.data, p.horario]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <p className="mt-1 text-xs text-charcoal/50">
            Comprador: {p.cliente.nome}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm text-charcoal/50">{formatBRL(p.total)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDetalhe(p)}>
              <Eye className="mr-1 h-4 w-4" /> Detalhes
            </Button>
            <Button
              size="sm"
              onClick={() => onImprimir(p)}
              className="bg-charcoal text-white hover:bg-charcoal/90"
            >
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function OperacaoGrupoExecucao({
  label,
  pedidos,
  onDetalhe,
  onImprimir,
}: {
  label: string;
  pedidos: PedidoOperacional[];
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
}) {
  if (pedidos.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-bold text-charcoal">{label}</h2>
      {pedidos.map((p) => (
        <OperacaoPedidoCard
          key={p.id}
          p={p}
          onDetalhe={onDetalhe}
          onImprimir={onImprimir}
        />
      ))}
    </section>
  );
}

export function grupoLabelFromIso(iso: string): string {
  if (iso === "sem-data") return "Sem data de execução";
  return labelGrupoExecucao(`${iso}T12:00:00-03:00`);
}
