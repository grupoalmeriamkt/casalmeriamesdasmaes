import { useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  Gift,
  MapPin,
  MessageCircle,
  Printer,
} from "lucide-react";
import type { PedidoSalvo } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { labelTipoPedido } from "@/lib/asaasStatus";
import { cn } from "@/lib/utils";

export type PedidoStatusKey = "aprovado" | "pendente" | "rascunho" | "abandonado";

export type PedidoStatusConfig = Record<
  PedidoStatusKey,
  { label: string; bg: string; header: string; dot: string }
>;

type Props = {
  porStatus: Record<PedidoStatusKey, PedidoSalvo[]>;
  pedidosFiltrados: PedidoSalvo[];
  temFiltro: boolean;
  selectedIds: Set<string>;
  statusConfig: PedidoStatusConfig;
  getStatus: (p: PedidoSalvo) => PedidoStatusKey;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
  onToggle: (id: string) => void;
};

const STATUS_ORDER: PedidoStatusKey[] = [
  "aprovado",
  "pendente",
  "rascunho",
  "abandonado",
];

function resumoItens(p: PedidoSalvo): string {
  const partes: string[] = [];
  if (p.cesta?.nome) {
    partes.push(`${p.cesta.nome} × ${p.cesta.quantidade}`);
  }
  if (!p.cesta && p.sobremesas.length > 0) {
    const [primeiro, ...resto] = p.sobremesas;
    partes.push(`${primeiro.nome} × ${primeiro.quantidade}`);
    if (resto.length > 0) partes.push(`+${resto.length}`);
  } else if (p.sobremesas.length > 0) {
    partes.push(`+${p.sobremesas.length} item${p.sobremesas.length !== 1 ? "ns" : ""}`);
  }
  return partes.join(" · ") || "Sem itens";
}

function formatDataCurta(data?: string | null): string | null {
  if (!data) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const d = new Date(`${data}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }
  }
  return data;
}

function linhaEntrega(p: PedidoSalvo): string {
  return [
    labelTipoPedido(p.tipo),
    p.enderecoOuUnidade,
    formatDataCurta(p.data),
    p.horario,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PedidoListaMobileCard({
  p,
  status,
  statusConfig,
  selected,
  onDetalhe,
  onImprimir,
  onToggle,
}: {
  p: PedidoSalvo;
  status: PedidoStatusKey;
  statusConfig: PedidoStatusConfig;
  selected: boolean;
  onDetalhe: (p: PedidoSalvo) => void;
  onImprimir: (p: PedidoSalvo) => void;
  onToggle: () => void;
}) {
  const tel = p.cliente.whatsapp.replace(/\D/g, "");
  const cfg = statusConfig[status];
  const entrega = linhaEntrega(p);
  const temDestinatario =
    p.destinatario?.nome && p.destinatario.nome !== p.cliente.nome;

  return (
    <article
      className={cn(
        "pedidos-lista-card",
        selected && "pedidos-lista-card--selected",
      )}
    >
      <button
        type="button"
        className="pedidos-lista-card__body"
        onClick={() => onDetalhe(p)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("pedidos-lista-status-dot", cfg.dot)} aria-hidden />
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.bg)}>
              {cfg.label}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              #{p.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-charcoal">
            {formatBRL(p.total)}
          </span>
        </div>

        <div className="mt-2.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-charcoal">
              {p.cliente.nome || "(sem nome)"}
            </p>
            <p className="mt-0.5 truncate text-sm text-charcoal/70">{resumoItens(p)}</p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/25" aria-hidden />
        </div>

        {entrega && (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-charcoal/40" />
            <span className="line-clamp-2">{entrega}</span>
          </p>
        )}

        {temDestinatario && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-terracotta">
            <Gift className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Para {p.destinatario!.nome}</span>
          </p>
        )}
      </button>

      <div className="pedidos-lista-card__footer">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-[18px] w-[18px] rounded border-border accent-charcoal"
            aria-label={`Selecionar pedido ${p.id.slice(-6)}`}
          />
          Selecionar
        </label>

        <div className="flex items-center gap-1">
          {tel ? (
            <a
              href={`https://wa.me/55${tel}`}
              target="_blank"
              rel="noreferrer"
              className="pedidos-lista-icon-btn text-olive"
              aria-label="WhatsApp do cliente"
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          ) : null}
          <button
            type="button"
            className="pedidos-lista-icon-btn"
            onClick={() => onDetalhe(p)}
            aria-label="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="pedidos-lista-icon-btn pedidos-lista-icon-btn--primary"
            onClick={() => onImprimir(p)}
            aria-label="Imprimir"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function StatusRail({
  porStatus,
  statusConfig,
  focus,
  onFocus,
  total,
}: {
  porStatus: Record<PedidoStatusKey, PedidoSalvo[]>;
  statusConfig: PedidoStatusConfig;
  focus: PedidoStatusKey | "all";
  onFocus: (key: PedidoStatusKey | "all") => void;
  total: number;
}) {
  return (
    <div className="pedidos-lista-rail scrollbar-hide">
      <button
        type="button"
        onClick={() => onFocus("all")}
        className={cn("pedidos-lista-rail__chip", focus === "all" && "pedidos-lista-rail__chip--active")}
      >
        Todos
        <span className="pedidos-lista-rail__count">{total}</span>
      </button>
      {STATUS_ORDER.map((key) => {
        const count = porStatus[key].length;
        if (count === 0) return null;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFocus(key)}
            className={cn(
              "pedidos-lista-rail__chip",
              focus === key && "pedidos-lista-rail__chip--active",
            )}
          >
            {statusConfig[key].label}
            <span className="pedidos-lista-rail__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PedidosListaMobile({
  porStatus,
  pedidosFiltrados,
  temFiltro,
  selectedIds,
  statusConfig,
  getStatus,
  onDetalhe,
  onImprimir,
  onToggle,
}: Props) {
  const [focus, setFocus] = useState<PedidoStatusKey | "all">("all");

  const totalVisivel = pedidosFiltrados.length;

  const grupos = useMemo(() => {
    if (temFiltro || focus !== "all") {
      const lista =
        focus === "all"
          ? pedidosFiltrados
          : pedidosFiltrados.filter((p) => getStatus(p) === focus);
      return lista.length > 0 ? [{ key: focus === "all" ? ("mixed" as const) : focus, pedidos: lista }] : [];
    }
    return STATUS_ORDER.map((key) => ({ key, pedidos: porStatus[key] })).filter(
      (g) => g.pedidos.length > 0,
    );
  }, [temFiltro, focus, pedidosFiltrados, porStatus, getStatus]);

  if (totalVisivel === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhum pedido corresponde aos filtros.
      </p>
    );
  }

  return (
    <div className="pedidos-lista-mobile">
      <StatusRail
        porStatus={porStatus}
        statusConfig={statusConfig}
        focus={focus}
        onFocus={setFocus}
        total={totalVisivel}
      />

      <div className="pedidos-lista-mobile__content space-y-6">
        {grupos.map(({ key, pedidos }) => (
          <section key={String(key)} className="space-y-2">
            {!temFiltro && focus === "all" && key !== "mixed" && (
              <div className="flex items-center justify-between px-1">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    statusConfig[key as PedidoStatusKey].bg,
                  )}
                >
                  {statusConfig[key as PedidoStatusKey].label}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            <div className="space-y-2">
              {pedidos.map((p) => (
                <PedidoListaMobileCard
                  key={p.id}
                  p={p}
                  status={getStatus(p)}
                  statusConfig={statusConfig}
                  selected={selectedIds.has(p.id)}
                  onDetalhe={onDetalhe}
                  onImprimir={onImprimir}
                  onToggle={() => onToggle(p.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
