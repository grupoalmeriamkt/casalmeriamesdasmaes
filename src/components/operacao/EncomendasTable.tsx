import type { EncomendaLinha } from "@/lib/encomendasTable";
import {
  LOCAL_BADGE,
  resolveLocalOptionId,
  SETOR_BADGE_PLANILHA,
  SETORES_OPCOES,
} from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";
import { EncomendasPlanilhaMobile } from "@/components/operacao/EncomendasPlanilhaMobile";
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

export type LocalOpcao = { id: string; label: string; key: string };

type Props = {
  linhas: EncomendaLinha[];
  selectedIds: Set<string>;
  locaisOpcoes: LocalOpcao[];
  salvandoPedidoId: string | null;
  fillViewport?: boolean;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
  onAlterarSetor: (pedidoId: string, setor: SetorOperacional) => void;
  onAlterarLocal: (pedidoId: string, unidadeId: string, label: string) => void;
};

function badgeClass(map: Record<string, string>, key: string) {
  return map[key] ?? map.outro;
}

function selectBadgeClass(base: string) {
  return `${base} w-full min-w-[7.5rem] max-w-full cursor-pointer appearance-none rounded-md border-0 px-2 py-1 text-xs font-semibold outline-none ring-offset-1 focus:ring-2 focus:ring-charcoal/30`;
}

function resolveSetorValue(l: EncomendaLinha): string {
  if (l.productionSector) return l.productionSector;
  const byLabel = SETORES_OPCOES.find(
    (s) => s.label.toLowerCase() === l.setor.toLowerCase() || s.key === l.setorKey,
  );
  return byLabel?.value ?? "";
}

export function EncomendasTable({
  linhas,
  selectedIds,
  locaisOpcoes,
  salvandoPedidoId,
  fillViewport = false,
  onTogglePedido,
  onAbrirPedido,
  onAlterarSetor,
  onAlterarLocal,
}: Props) {
  const hojeIso = hojeIsoLocal();

  if (linhas.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma linha para exibir na planilha.
      </p>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <EncomendasPlanilhaMobile
          linhas={linhas}
          selectedIds={selectedIds}
          locaisOpcoes={locaisOpcoes}
          salvandoPedidoId={salvandoPedidoId}
          onTogglePedido={onTogglePedido}
          onAbrirPedido={onAbrirPedido}
          onAlterarSetor={onAlterarSetor}
          onAlterarLocal={onAlterarLocal}
        />
      </div>

      <div
        className={
          fillViewport
            ? "hidden min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm md:flex"
            : "hidden overflow-x-auto rounded-xl border border-border shadow-sm md:block"
        }
      >
        <div className={fillViewport ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto"}>
          <table className="w-full min-w-[800px] border-collapse text-sm xl:min-w-0 xl:table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[5.5rem] sm:w-[6.5rem]" />
            <col className="w-[5.5rem] sm:w-[6.5rem]" />
            <col className="w-[4.5rem] sm:w-[5.5rem]" />
            <col className="hidden w-[6rem] md:table-column sm:table-column" />
            <col className="min-w-[8rem]" />
            <col className="w-[9.5rem] lg:w-[11rem]" />
            <col />
            <col className="w-12" />
            <col className="w-[8.5rem] lg:w-[10rem]" />
            <col className="w-[7rem] lg:w-[8rem]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e1b4b] text-left text-[10px] font-semibold uppercase tracking-wide text-white sm:text-[11px]">
              <th className="px-1.5 py-2 sm:px-2 sm:py-2.5" aria-label="Selecionar" />
              <th className="px-2 py-2 sm:px-3 sm:py-2.5" title="Data em que o pedido chegou">
                Chegou
              </th>
              <th
                className="px-2 py-2 sm:px-3 sm:py-2.5"
                title="Data da Entrega"
              >
                <span className="hidden lg:inline">Data da Entrega</span>
                <span className="lg:hidden">Dt. Entrega</span>
              </th>
              <th
                className="px-2 py-2 sm:px-3 sm:py-2.5"
                title="Hora da Entrega"
              >
                <span className="hidden sm:inline">Hora da Entrega</span>
                <span className="sm:hidden">Hora</span>
              </th>
              <th
                className="hidden px-2 py-2 sm:table-cell sm:px-3 sm:py-2.5"
                title="Dia da Entrega"
              >
                <span className="hidden lg:inline">Dia da Entrega</span>
                <span className="lg:hidden">Dia</span>
              </th>
              <th className="px-2 py-2 sm:px-3 sm:py-2.5">Cliente</th>
              <th className="px-2 py-2 sm:px-3 sm:py-2.5">Setor</th>
              <th className="px-2 py-2 sm:px-3 sm:py-2.5">Produto</th>
              <th className="px-2 py-2 text-center sm:px-3 sm:py-2.5">Qtd</th>
              <th className="px-2 py-2 sm:px-3 sm:py-2.5">Local</th>
              <th className="px-2 py-2 sm:px-3 sm:py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const setorAtual = resolveSetorValue(l);
              const setorMeta = SETORES_OPCOES.find((s) => s.value === setorAtual);
              const localAtual = resolveLocalOptionId(
                l.unidadeId,
                l.localRetirada,
                l.localKey,
                locaisOpcoes,
              );
              const localMeta =
                locaisOpcoes.find((o) => o.id === localAtual) ??
                locaisOpcoes.find((o) => o.label.toLowerCase() === l.localRetirada.toLowerCase());
              const salvando = salvandoPedidoId === l.pedidoId;
              const prazo = prazoStatus({ data: l.dataIso, concluidoAt: l.concluidoAt }, hojeIso);

              return (
                <tr
                  key={l.linhaId}
                  onClick={() => onAbrirPedido(l.pedidoId)}
                  className={`cursor-pointer border-b border-border/40 transition-colors ${
                    selectedIds.has(l.pedidoId) ? "bg-olive/10" : "bg-[#edf7ee] hover:bg-[#dcefdc]"
                  } ${salvando ? "opacity-60" : ""}`}
                  title="Clique para abrir o pedido"
                >
                  <td className="px-1.5 py-1.5 text-center sm:px-2 sm:py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.pedidoId)}
                      onChange={() => onTogglePedido(l.pedidoId)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer rounded border-border accent-charcoal"
                      aria-label={`Selecionar pedido ${l.pedidoId.slice(-6)}`}
                    />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-charcoal sm:px-3 sm:py-2 sm:text-sm">
                    {l.dataChegada}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-charcoal sm:px-3 sm:py-2 sm:text-sm">
                    {l.dataRetirada}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-charcoal sm:px-3 sm:py-2 sm:text-sm">
                    {l.horarioRetirada.slice(0, 5)}
                  </td>
                  <td className="hidden px-2 py-1.5 whitespace-nowrap text-xs capitalize text-charcoal sm:table-cell sm:px-3 sm:py-2 sm:text-sm">
                    {l.diaSemana}
                  </td>
                  <td className="max-w-[10rem] truncate px-2 py-1.5 text-xs font-semibold text-charcoal sm:max-w-none sm:px-3 sm:py-2 sm:text-sm" title={l.nomeCliente}>
                    {l.nomeCliente}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={setorAtual}
                      disabled={salvando}
                      onChange={(e) =>
                        onAlterarSetor(l.pedidoId, e.target.value as SetorOperacional)
                      }
                      className={selectBadgeClass(
                        badgeClass(SETOR_BADGE_PLANILHA, setorMeta?.key ?? l.setorKey),
                      )}
                      aria-label="Setor responsável"
                    >
                      <option value="" disabled>
                        Setor
                      </option>
                      {SETORES_OPCOES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5 text-xs font-medium text-charcoal sm:max-w-none sm:px-3 sm:py-2 sm:text-sm" title={l.produto}>
                    {l.produto}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs font-semibold text-charcoal sm:px-3 sm:py-2 sm:text-sm">
                    {l.qtd}
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={localAtual}
                      disabled={salvando}
                      onChange={(e) => {
                        const opt = locaisOpcoes.find((o) => o.id === e.target.value);
                        if (opt) onAlterarLocal(l.pedidoId, opt.id, opt.label);
                      }}
                      className={selectBadgeClass(
                        badgeClass(LOCAL_BADGE, localMeta?.key ?? l.localKey),
                      )}
                      aria-label="Retirada ou entrega"
                    >
                      <option value="" disabled>
                        Local
                      </option>
                      {locaisOpcoes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                      {!localAtual && l.localRetirada && l.localRetirada !== "—" && (
                        <option value={l.localRetirada}>{l.localRetirada}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    {prazo && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRAZO_BADGE[prazo]}`}
                      >
                        {PRAZO_LABEL[prazo]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
