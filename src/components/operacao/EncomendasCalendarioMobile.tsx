import { useMemo } from "react";
import { ChevronRight, Package } from "lucide-react";
import { DayButton, getDefaultClassNames } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { EncomendasPlanilhaMobile } from "@/components/operacao/EncomendasPlanilhaMobile";
import type { LocalOpcao } from "@/components/operacao/EncomendasTable";
import type { EncomendaLinha } from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { cn } from "@/lib/utils";

type Props = {
  contagemPorDia: Record<string, number>;
  dataSelecionada: string;
  onSelecionarData: (iso: string) => void;
  linhas: EncomendaLinha[];
  selectedIds: Set<string>;
  locaisOpcoes: LocalOpcao[];
  salvandoPedidoId: string | null;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
  onAlterarSetor: (pedidoId: string, setor: SetorOperacional) => void;
  onAlterarLocal: (pedidoId: string, unidadeId: string, label: string) => void;
};

function isoToDate(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDiaLegivel(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function createDayButton(contagemPorDia: Record<string, number>) {
  return function CalendarDayWithCount({
    className,
    day,
    modifiers,
    ...props
  }: React.ComponentProps<typeof DayButton>) {
    const defaultClassNames = getDefaultClassNames();
    const iso = dateToIso(day.date);
    const count = contagemPorDia[iso] ?? 0;
    const hasOrders = count > 0;

    return (
      <Button
        variant="ghost"
        size="icon"
        data-selected-single={
          modifiers.selected &&
          !modifiers.range_start &&
          !modifiers.range_end &&
          !modifiers.range_middle
        }
        className={cn(
          "flex aspect-square h-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-0.5 rounded-xl p-0 font-normal leading-none",
          "data-[selected-single=true]:bg-charcoal data-[selected-single=true]:text-white",
          hasOrders && !modifiers.selected && "bg-terracotta/8 font-semibold text-charcoal",
          defaultClassNames.day,
          className,
        )}
        {...props}
      >
        <span className="text-sm">{day.date.getDate()}</span>
        {hasOrders ? (
          <span
            className={cn(
              "min-w-[1.125rem] rounded-full px-1 text-[9px] font-bold leading-tight",
              modifiers.selected ? "bg-white/20 text-white" : "bg-terracotta/20 text-terracotta",
            )}
          >
            {count}
          </span>
        ) : (
          <span className="h-3.5" aria-hidden />
        )}
      </Button>
    );
  };
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-black/6 bg-white px-2 py-2.5 text-center shadow-sm">
      <p className="text-lg font-bold tabular-nums text-charcoal">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function EncomendasCalendarioMobile({
  contagemPorDia,
  dataSelecionada,
  onSelecionarData,
  linhas,
  selectedIds,
  locaisOpcoes,
  salvandoPedidoId,
  onTogglePedido,
  onAbrirPedido,
  onAlterarSetor,
  onAlterarLocal,
}: Props) {
  const selected = useMemo(() => isoToDate(dataSelecionada), [dataSelecionada]);
  const DayButtonComponent = useMemo(
    () => createDayButton(contagemPorDia),
    [contagemPorDia],
  );

  const diasComPedidos = useMemo(
    () =>
      Object.entries(contagemPorDia)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [contagemPorDia],
  );

  const totalAgendados = useMemo(
    () => diasComPedidos.reduce((acc, [, n]) => acc + n, 0),
    [diasComPedidos],
  );

  const totalNoDia = dataSelecionada ? (contagemPorDia[dataSelecionada] ?? 0) : 0;

  return (
    <div className="pedidos-calendario-mobile flex min-h-0 flex-1 flex-col">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <KpiCard label="Agendados" value={totalAgendados} />
        <KpiCard label="Dias c/ pedidos" value={diasComPedidos.length} />
        <KpiCard
          label={dataSelecionada ? "No dia" : "Selecionado"}
          value={dataSelecionada ? totalNoDia : "—"}
        />
      </div>

      <div className="mb-3 shrink-0 rounded-2xl border border-black/6 bg-white p-2 shadow-sm">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={(d) => onSelecionarData(d ? dateToIso(d) : "")}
          components={{ DayButton: DayButtonComponent }}
          className="w-full p-1 [--cell-size:2.65rem]"
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full gap-3",
            table: "w-full",
            weekdays: "w-full",
            week: "w-full mt-1",
            day: "flex-1",
            weekday: "flex-1 text-[11px] font-medium text-muted-foreground",
            caption_label: "text-sm font-semibold capitalize text-charcoal",
            button_previous: "h-9 w-9 rounded-full",
            button_next: "h-9 w-9 rounded-full",
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {dataSelecionada ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-charcoal">
                  {totalNoDia} pedido{totalNoDia !== 1 ? "s" : ""}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {selected?.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelecionarData("")}
                className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-charcoal"
              >
                Ver agenda
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {linhas.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum pedido neste dia com os filtros atuais.
                </p>
              ) : (
                <EncomendasPlanilhaMobile
                  linhas={linhas}
                  selectedIds={selectedIds}
                  locaisOpcoes={locaisOpcoes}
                  salvandoPedidoId={salvandoPedidoId}
                  onTogglePedido={onTogglePedido}
                  onAbrirPedido={onAbrirPedido}
                  onAlterarSetor={onAlterarSetor}
                  onAlterarLocal={onAlterarLocal}
                  hideDateRail
                />
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <p className="text-sm font-semibold text-charcoal">Próximas entregas</p>
              <span className="text-[11px] text-muted-foreground">
                {diasComPedidos.length} dia{diasComPedidos.length !== 1 ? "s" : ""}
              </span>
            </div>

            {diasComPedidos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/80 px-4 py-10 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-charcoal/25" />
                <p className="text-sm text-muted-foreground">
                  Nenhum pedido com data de entrega nos filtros atuais.
                </p>
              </div>
            ) : (
              <ul className="space-y-2 pb-24">
                {diasComPedidos.map(([iso, count]) => (
                  <li key={iso}>
                    <button
                      type="button"
                      onClick={() => onSelecionarData(iso)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-black/6 bg-white px-4 py-3 text-left shadow-sm transition-transform active:scale-[0.99]"
                    >
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                        <span className="text-[10px] font-bold uppercase leading-none">
                          {isoToDate(iso)?.toLocaleDateString("pt-BR", { month: "short" })}
                        </span>
                        <span className="text-base font-bold leading-tight">
                          {isoToDate(iso)?.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold capitalize text-charcoal">
                          {formatDiaLegivel(iso)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count} pedido{count !== 1 ? "s" : ""} agendado{count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-charcoal/25" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
