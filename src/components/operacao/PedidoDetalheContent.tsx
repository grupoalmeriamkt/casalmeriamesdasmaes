import { Calendar, Clock, MapPin, MessageCircle, Truck } from "lucide-react";
import type { PedidoSalvo } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { labelStatusPagamento, labelTipoPedido } from "@/lib/asaasStatus";
import { PedidoExtrasView } from "@/components/PedidoExtrasView";
import { ComprovanteAsaas } from "./ComprovanteAsaas";
import { cn } from "@/lib/utils";

type StatusKey = "aprovado" | "pendente" | "rascunho" | "abandonado";

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string }> = {
  aprovado: { label: "Aprovado", bg: "bg-olive/15 text-olive" },
  pendente: { label: "Aguardando pagamento", bg: "bg-terracotta/20 text-charcoal" },
  rascunho: { label: "Em preenchimento", bg: "bg-charcoal/10 text-charcoal" },
  abandonado: { label: "Abandonado", bg: "bg-terracotta/15 text-terracotta" },
};

const STATUS_ALIASES: Record<string, StatusKey> = {
  CONFIRMED: "aprovado",
  RECEIVED: "aprovado",
  PENDING: "pendente",
  OVERDUE: "pendente",
  REFUNDED: "abandonado",
  PAYMENT_DELETED: "abandonado",
  CHARGEBACK_REQUESTED: "abandonado",
  CHARGEBACK_DISPUTE: "abandonado",
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

export function destinatarioEntrega(p: PedidoSalvo): { nome: string; whatsapp: string } {
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

function formatDataEntregaLegivel(data?: string | null, compact = false): string {
  if (!data) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const d = new Date(`${data}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", compact
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
  }
  return data;
}

function usePedidoDetalhe(p: PedidoSalvo) {
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
  const status = getStatus(p);
  const temDestinatarioDiferente =
    !!p.destinatario?.nome && p.destinatario.nome !== p.cliente.nome;

  return {
    dest,
    telDest,
    isDelivery,
    cartoes,
    polaroids,
    desconto,
    cupom,
    metodoLabel,
    itensSoma,
    frete,
    status,
    temDestinatarioDiferente,
  };
}

function DetalheSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-black/6 bg-white p-3", className)}>
      {title ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function DetalhesPedido({
  p,
  variant = "desktop",
}: {
  p: PedidoSalvo;
  variant?: "desktop" | "mobile";
}) {
  const {
    dest,
    telDest,
    isDelivery,
    cartoes,
    polaroids,
    desconto,
    cupom,
    metodoLabel,
    itensSoma,
    frete,
    status,
    temDestinatarioDiferente,
  } = usePedidoDetalhe(p);

  if (variant === "mobile") {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_CONFIG[status].bg)}>
            {STATUS_CONFIG[status].label}
          </span>
          <span className="text-xs text-muted-foreground">{labelTipoPedido(p.tipo)}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {labelStatusPagamento(p.pagamento?.status)}
          </span>
        </div>

        <DetalheSection>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {isDelivery ? "Entregar para" : temDestinatarioDiferente ? "Presente para" : "Cliente"}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-charcoal">{dest.nome}</p>
          {telDest ? (
            <a
              href={`https://wa.me/55${telDest}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-olive"
            >
              <MessageCircle className="h-4 w-4" />
              {dest.whatsapp}
            </a>
          ) : null}
          {temDestinatarioDiferente && (
            <p className="mt-2 border-t border-black/6 pt-2 text-xs text-muted-foreground">
              Comprador: <span className="font-medium text-charcoal">{p.cliente.nome}</span>
              {p.cliente.whatsapp ? ` · ${p.cliente.whatsapp}` : ""}
            </p>
          )}
        </DetalheSection>

        {status === "aprovado" && <ComprovanteAsaas pedidoId={p.id} />}

        <DetalheSection>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              {isDelivery ? (
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/50" />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/50" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isDelivery ? "Endereço" : "Retirada"}
                </p>
                <p className="mt-0.5 font-medium leading-snug text-charcoal">
                  {p.enderecoOuUnidade || "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 border-t border-black/6 pt-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/50" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Data
                  </p>
                  <p className="mt-0.5 font-medium capitalize text-charcoal">
                    {formatDataEntregaLegivel(p.data, true)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/50" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Horário
                  </p>
                  <p className="mt-0.5 font-medium text-charcoal">{p.horario || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </DetalheSection>

        <DetalheSection title="Itens">
          <div className="space-y-2">
            {p.cesta && (
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-charcoal">
                  {p.cesta.nome} × {p.cesta.quantidade}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatBRL(p.cesta.preco * p.cesta.quantidade)}
                </span>
              </div>
            )}
            {p.sobremesas.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-charcoal">
                  {item.nome} × {item.quantidade}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatBRL(item.preco * item.quantidade)}
                </span>
              </div>
            ))}
            {cartoes.map((c, i) => (
              <div key={`c-${i}`} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-charcoal">{c.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatBRL(c.preco)}</span>
              </div>
            ))}
            {polaroids.map((pol, i) => (
              <div key={`p-${i}`} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-charcoal">{pol.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatBRL(pol.preco)}</span>
              </div>
            ))}
            {!p.cesta && p.sobremesas.length === 0 && cartoes.length === 0 && polaroids.length === 0 && (
              <p className="text-muted-foreground">Sem itens</p>
            )}
          </div>
        </DetalheSection>

        {(cartoes.length > 0 || polaroids.length > 0) && (
          <DetalheSection title="Fotos e mensagens">
            <PedidoExtrasView cartoes={cartoes} polaroids={polaroids} variant="admin" />
          </DetalheSection>
        )}

        <div className="rounded-xl bg-charcoal/[0.03] px-3 py-3">
          {desconto > 0 && (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatBRL(itensSoma + desconto)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-emerald-700">
                <span>Desconto{cupom ? ` (${cupom})` : ""}</span>
                <span>−{formatBRL(desconto)}</span>
              </div>
            </>
          )}
          {frete > 0 && (
            <div className="mt-1 flex justify-between text-xs text-charcoal/70">
              <span>Taxa de entrega</span>
              <span className="font-semibold">{formatBRL(frete)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-black/6 pt-2">
            <span className="font-semibold text-charcoal">Total</span>
            <span className="text-lg font-bold tabular-nums text-charcoal">{formatBRL(p.total)}</span>
          </div>
          {metodoLabel && (
            <p className="mt-1 text-xs text-muted-foreground">Pagamento via {metodoLabel}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_CONFIG[status].bg)}>
          {STATUS_CONFIG[status].label}
        </span>
        <span className="font-mono text-sm font-bold text-charcoal">
          #{p.id.slice(-6).toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(p.criadoEm).toLocaleString("pt-BR")}
        </span>
      </div>

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

      <div className="rounded-lg border border-border bg-white px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">💳 Quem pagou</p>
        <p className="mt-0.5 text-base font-semibold text-charcoal">{p.cliente.nome || "—"}</p>
        <p className="text-xs text-muted-foreground">
          {p.cliente.whatsapp ? `${p.cliente.whatsapp} · ` : ""}nome que consta no Asaas
        </p>
      </div>

      {status === "aprovado" && <ComprovanteAsaas pedidoId={p.id} />}

      <div className="space-y-2 rounded-lg border border-border bg-linen/60 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {isDelivery ? "📍 Endereço de entrega" : "📍 Local de retirada"}
          </p>
          <p className="mt-0.5 text-base font-semibold leading-snug text-charcoal">
            {p.enderecoOuUnidade || "—"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {isDelivery ? "📅 Entregar em" : "📅 Retirar em"}
            </p>
            <p className="mt-0.5 font-semibold capitalize text-charcoal">
              {formatDataEntregaLegivel(p.data)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">🕐 Horário</p>
            <p className="mt-0.5 font-semibold text-charcoal">{p.horario || "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Itens</p>
        <div className="mt-1 space-y-1 text-charcoal">
          {p.cesta && (
            <div className="flex justify-between">
              <span>{p.cesta.nome} × {p.cesta.quantidade}</span>
              <span className="font-semibold">{formatBRL(p.cesta.preco * p.cesta.quantidade)}</span>
            </div>
          )}
          {p.sobremesas.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.nome} × {item.quantidade}</span>
              <span className="font-semibold">{formatBRL(item.preco * item.quantidade)}</span>
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

      {(cartoes.length > 0 || polaroids.length > 0) && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Fotos e Mensagens</p>
          <PedidoExtrasView cartoes={cartoes} polaroids={polaroids} variant="admin" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
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
