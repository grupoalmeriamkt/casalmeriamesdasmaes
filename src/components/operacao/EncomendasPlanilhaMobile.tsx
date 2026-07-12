import { useMemo, useState } from "react";
import { Calendar, ChevronRight, Clock, MapPin } from "lucide-react";
import type { EncomendaLinha } from "@/lib/encomendasTable";
import {
  resolveLocalOptionId,
  SETOR_BADGE_PLANILHA,
  SETORES_OPCOES,
  type LocalOpcao,
} from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { cn } from "@/lib/utils";
import { prazoStatus, PRAZO_LABEL, type PrazoStatus } from "@/lib/pedidoPrazo";

const PRAZO_BADGE: Record<Exclude<PrazoStatus, null>, string> = {
  concluido: "bg-olive/15 text-olive",
  atrasado: "bg-red-100 text-red-700",
  hoje: "bg-amber-100 text-amber-800",
  no_prazo: "bg-emerald-50 text-emerald-700",
};

function hojeIsoLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type Props = {
  linhas: EncomendaLinha[];
  selectedIds: Set<string>;
  locaisOpcoes: LocalOpcao[];
  salvandoPedidoId: string | null;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
  onAlterarSetor: (pedidoId: string, setor: SetorOperacional) => void;
  onAlterarLocal: (pedidoId: string, unidadeId: string, label: string) => void;
  hideDateRail?: boolean;
};

type GrupoPedido = {
  pedidoId: string;
  linhas: EncomendaLinha[];
  base: EncomendaLinha;
  dataRetirada: string;
};

const LEGACY_PREFIX = "__legacy:";

function badgeClass(map: Record<string, string>, key: string) {
  return map[key] ?? map.outro;
}

function resolveSetorValue(l: EncomendaLinha): string {
  if (l.productionSector) return l.productionSector;
  const byLabel = SETORES_OPCOES.find(
    (s) => s.label.toLowerCase() === l.setor.toLowerCase() || s.key === l.setorKey,
  );
  return byLabel?.value ?? "";
}

function resolveLocalSelectValue(
  l: EncomendaLinha,
  locaisOpcoes: LocalOpcao[],
): { value: string; label: string; key: string } {
  const id = resolveLocalOptionId(l.unidadeId, l.localRetirada, l.localKey, locaisOpcoes);
  if (id) {
    const opt = locaisOpcoes.find((o) => o.id === id);
    return {
      value: id,
      label: opt?.label ?? l.localRetirada,
      key: opt?.key ?? l.localKey,
    };
  }
  if (l.localRetirada && l.localRetirada !== "—") {
    return {
      value: `${LEGACY_PREFIX}${l.localRetirada}`,
      label: l.localRetirada,
      key: l.localKey,
    };
  }
  return { value: "", label: "Definir local", key: "outro" };
}

function agruparPorPedido(linhas: EncomendaLinha[]): GrupoPedido[] {
  const map = new Map<string, EncomendaLinha[]>();
  for (const l of linhas) {
    const arr = map.get(l.pedidoId) ?? [];
    arr.push(l);
    map.set(l.pedidoId, arr);
  }
  return [...map.entries()].map(([pedidoId, grupo]) => ({
    pedidoId,
    linhas: grupo,
    base: grupo[0],
    dataRetirada: grupo[0].dataRetirada || "Sem data",
  }));
}

function parseDataOrdenacao(data: string): number {
  const [d, m, y] = data.split("/").map(Number);
  if (!d || !m || !y) return Number.MAX_SAFE_INTEGER;
  return y * 10000 + m * 100 + d;
}

function PlanilhaDateRail({
  grupos,
  focus,
  onFocus,
}: {
  grupos: GrupoPedido[];
  focus: string;
  onFocus: (data: string) => void;
}) {
  const datas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grupos) {
      counts.set(g.dataRetirada, (counts.get(g.dataRetirada) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => parseDataOrdenacao(a[0]) - parseDataOrdenacao(b[0]),
    );
  }, [grupos]);

  return (
    <div className="pedidos-lista-rail scrollbar-hide">
      <button
        type="button"
        onClick={() => onFocus("all")}
        className={cn(
          "pedidos-lista-rail__chip",
          focus === "all" && "pedidos-lista-rail__chip--active",
        )}
      >
        Todos
        <span className="pedidos-lista-rail__count">{grupos.length}</span>
      </button>
      {datas.map(([data, count]) => (
        <button
          key={data}
          type="button"
          onClick={() => onFocus(data)}
          className={cn(
            "pedidos-lista-rail__chip",
            focus === data && "pedidos-lista-rail__chip--active",
          )}
        >
          {data === "Sem data" ? "Sem data" : data}
          <span className="pedidos-lista-rail__count">{count}</span>
        </button>
      ))}
    </div>
  );
}

function PlanilhaMobileCard({
  grupo,
  selectedIds,
  locaisOpcoes,
  salvandoPedidoId,
  onTogglePedido,
  onAbrirPedido,
  onAlterarSetor,
  onAlterarLocal,
}: {
  grupo: GrupoPedido;
  selectedIds: Set<string>;
  locaisOpcoes: LocalOpcao[];
  salvandoPedidoId: string | null;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
  onAlterarSetor: (pedidoId: string, setor: SetorOperacional) => void;
  onAlterarLocal: (pedidoId: string, unidadeId: string, label: string) => void;
}) {
  const { pedidoId, linhas: itens, base: l } = grupo;
  const setorAtual = resolveSetorValue(l);
  const setorMeta = SETORES_OPCOES.find((s) => s.value === setorAtual);
  const localState = resolveLocalSelectValue(l, locaisOpcoes);
  const salvando = salvandoPedidoId === pedidoId;
  const selecionado = selectedIds.has(pedidoId);
  const prazo = prazoStatus({ data: l.dataIso, concluidoAt: l.concluidoAt }, hojeIsoLocal());
  const formatItemResumo = (item: EncomendaLinha) =>
    item.tamanho ? `${item.produto} (${item.tamanho}) × ${item.qtd}` : `${item.produto} × ${item.qtd}`;
  const resumoProdutos =
    itens.length === 1
      ? formatItemResumo(itens[0])
      : `${formatItemResumo(itens[0])} +${itens.length - 1}`;

  return (
    <article
      className={cn(
        "pedidos-lista-card",
        selecionado && "pedidos-lista-card--selected",
        salvando && "opacity-60",
      )}
    >
      <button
        type="button"
        className="pedidos-lista-card__body"
        onClick={() => onAbrirPedido(pedidoId)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                badgeClass(SETOR_BADGE_PLANILHA, setorMeta?.key ?? l.setorKey),
              )}
            >
              {setorMeta?.label ?? l.setor}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              #{pedidoId.slice(-6).toUpperCase()}
            </span>
            {prazo && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  PRAZO_BADGE[prazo],
                )}
              >
                {PRAZO_LABEL[prazo]}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <p className="font-semibold text-charcoal">{l.dataRetirada}</p>
            <p>{l.horarioRetirada.slice(0, 5)}</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-charcoal">
              {l.nomeCliente}
            </p>
            <p className="mt-0.5 truncate text-sm text-charcoal/70">{resumoProdutos}</p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-charcoal/25" aria-hidden />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-charcoal/40" />
          <span className="line-clamp-2">{localState.label}</span>
        </p>

        {l.diaSemana && (
          <p className="mt-1 flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-charcoal/40" />
            {l.diaSemana}
            {l.horarioRetirada ? (
              <>
                <span>·</span>
                <Clock className="h-3.5 w-3.5 shrink-0 text-charcoal/40" />
                {l.horarioRetirada}
              </>
            ) : null}
          </p>
        )}
      </button>

      <div
        className="grid grid-cols-1 gap-2 border-t border-black/6 bg-black/[0.02] px-3 py-3 sm:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Setor
          </span>
          <select
            value={setorAtual}
            disabled={salvando}
            onChange={(e) => onAlterarSetor(pedidoId, e.target.value as SetorOperacional)}
            className="h-10 w-full rounded-xl border border-black/8 bg-white px-3 text-xs font-semibold text-charcoal outline-none focus:ring-2 focus:ring-charcoal/20"
            aria-label="Setor responsável"
          >
            <option value="" disabled>
              Escolher setor
            </option>
            {SETORES_OPCOES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Retirada / Entrega
          </span>
          <select
            value={localState.value}
            disabled={salvando}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith(LEGACY_PREFIX)) return;
              const opt = locaisOpcoes.find((o) => o.id === val);
              if (opt) onAlterarLocal(pedidoId, opt.id, opt.label);
            }}
            className="h-10 w-full rounded-xl border border-black/8 bg-white px-3 text-xs font-semibold text-charcoal outline-none focus:ring-2 focus:ring-charcoal/20"
            aria-label="Retirada ou entrega"
          >
            {!localState.value && (
              <option value="" disabled>
                Escolher local
              </option>
            )}
            {localState.value.startsWith(LEGACY_PREFIX) && (
              <option value={localState.value}>{localState.label}</option>
            )}
            {locaisOpcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pedidos-lista-card__footer">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={() => onTogglePedido(pedidoId)}
            className="h-[18px] w-[18px] rounded border-border accent-charcoal"
            aria-label={`Selecionar pedido ${pedidoId.slice(-6)}`}
          />
          Selecionar
        </label>
        {itens.length > 1 && (
          <span className="text-[11px] text-muted-foreground">{itens.length} itens</span>
        )}
      </div>
    </article>
  );
}

export function EncomendasPlanilhaMobile({
  linhas,
  selectedIds,
  locaisOpcoes,
  salvandoPedidoId,
  onTogglePedido,
  onAbrirPedido,
  onAlterarSetor,
  onAlterarLocal,
  hideDateRail = false,
}: Props) {
  const [focusData, setFocusData] = useState<string>("all");
  const grupos = useMemo(() => agruparPorPedido(linhas), [linhas]);

  const gruposVisiveis = useMemo(() => {
    if (focusData === "all") return grupos;
    return grupos.filter((g) => g.dataRetirada === focusData);
  }, [grupos, focusData]);

  const secoes = useMemo(() => {
    if (focusData !== "all") {
      return gruposVisiveis.length > 0 ? [{ data: focusData, grupos: gruposVisiveis }] : [];
    }
    const map = new Map<string, GrupoPedido[]>();
    for (const g of gruposVisiveis) {
      const arr = map.get(g.dataRetirada) ?? [];
      arr.push(g);
      map.set(g.dataRetirada, arr);
    }
    return [...map.entries()]
      .sort((a, b) => parseDataOrdenacao(a[0]) - parseDataOrdenacao(b[0]))
      .map(([data, items]) => ({ data, grupos: items }));
  }, [gruposVisiveis, focusData]);

  if (grupos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma encomenda para exibir.
      </p>
    );
  }

  return (
    <div className="pedidos-planilha-mobile">
      {!hideDateRail && (
        <PlanilhaDateRail grupos={grupos} focus={focusData} onFocus={setFocusData} />
      )}

      <div className="pedidos-planilha-mobile__content space-y-5">
        {secoes.map(({ data, grupos: secaoGrupos }) => (
          <section key={data} className="space-y-2">
            {!hideDateRail && focusData === "all" && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-charcoal">
                  {data === "Sem data" ? "Sem data de entrega" : `Entrega ${data}`}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {secaoGrupos.length} pedido{secaoGrupos.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            <div className="space-y-2">
              {secaoGrupos.map((grupo) => (
                <PlanilhaMobileCard
                  key={grupo.pedidoId}
                  grupo={grupo}
                  selectedIds={selectedIds}
                  locaisOpcoes={locaisOpcoes}
                  salvandoPedidoId={salvandoPedidoId}
                  onTogglePedido={onTogglePedido}
                  onAbrirPedido={onAbrirPedido}
                  onAlterarSetor={onAlterarSetor}
                  onAlterarLocal={onAlterarLocal}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
