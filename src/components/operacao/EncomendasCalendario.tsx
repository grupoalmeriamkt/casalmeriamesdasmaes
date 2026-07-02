import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { EncomendasTable, type LocalOpcao } from "@/components/operacao/EncomendasTable";
import { EncomendasCalendarioMobile } from "@/components/operacao/EncomendasCalendarioMobile";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EncomendaLinha } from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { ptBR } from "date-fns/locale";

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

export function EncomendasCalendario({
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
  const isMobile = useIsMobile();
  const selected = useMemo(() => isoToDate(dataSelecionada), [dataSelecionada]);

  const diasComPedidos = useMemo(
    () =>
      Object.entries(contagemPorDia)
        .filter(([, n]) => n > 0)
        .map(([iso]) => isoToDate(iso))
        .filter((d): d is Date => !!d),
    [contagemPorDia],
  );

  if (isMobile) {
    return (
      <EncomendasCalendarioMobile
        contagemPorDia={contagemPorDia}
        dataSelecionada={dataSelecionada}
        onSelecionarData={onSelecionarData}
        linhas={linhas}
        selectedIds={selectedIds}
        locaisOpcoes={locaisOpcoes}
        salvandoPedidoId={salvandoPedidoId}
        onTogglePedido={onTogglePedido}
        onAbrirPedido={onAbrirPedido}
        onAlterarSetor={onAlterarSetor}
        onAlterarLocal={onAlterarLocal}
      />
    );
  }

  const totalNoDia = dataSelecionada ? (contagemPorDia[dataSelecionada] ?? 0) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
      <div className="shrink-0 rounded-lg border border-border bg-white p-2 shadow-sm lg:w-auto">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={(d) => onSelecionarData(d ? dateToIso(d) : "")}
          modifiers={{ comPedidos: diasComPedidos }}
          modifiersClassNames={{
            comPedidos:
              "relative font-semibold after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-terracotta after:content-['']",
          }}
          className="mx-auto"
        />
        <p className="mt-1 border-t border-border/60 px-2 pt-2 text-center text-[10px] text-muted-foreground">
          Dias com ponto laranja têm pedidos agendados
        </p>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {dataSelecionada ? (
          <>
            <p className="mb-2 shrink-0 text-sm font-semibold text-charcoal">
              {totalNoDia} pedido{totalNoDia !== 1 ? "s" : ""} em{" "}
              {selected?.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <EncomendasTable
              fillViewport
              linhas={linhas}
              selectedIds={selectedIds}
              locaisOpcoes={locaisOpcoes}
              salvandoPedidoId={salvandoPedidoId}
              onTogglePedido={onTogglePedido}
              onAbrirPedido={onAbrirPedido}
              onAlterarSetor={onAlterarSetor}
              onAlterarLocal={onAlterarLocal}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-white/60 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Selecione um dia no calendário para ver os pedidos com data de entrega.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
