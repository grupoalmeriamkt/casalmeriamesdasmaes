import type { EncomendaLinha } from "@/lib/encomendasTable";
import {
  LOCAL_BADGE,
  SETOR_BADGE_PLANILHA,
  SETORES_OPCOES,
} from "@/lib/encomendasTable";
import type { SetorOperacional } from "@/lib/setoresOperacao";

export type LocalOpcao = { id: string; label: string; key: string };

type Props = {
  linhas: EncomendaLinha[];
  selectedIds: Set<string>;
  locaisOpcoes: LocalOpcao[];
  salvandoPedidoId: string | null;
  onTogglePedido: (pedidoId: string) => void;
  onAbrirPedido: (pedidoId: string) => void;
  onAlterarSetor: (pedidoId: string, setor: SetorOperacional) => void;
  onAlterarLocal: (pedidoId: string, unidadeId: string, label: string) => void;
};

function badgeClass(map: Record<string, string>, key: string) {
  return map[key] ?? map.outro;
}

function selectBadgeClass(base: string) {
  return `${base} cursor-pointer appearance-none rounded-md border-0 px-2 py-0.5 text-xs font-semibold outline-none ring-offset-1 focus:ring-2 focus:ring-charcoal/30`;
}

export function EncomendasTable({
  linhas,
  selectedIds,
  locaisOpcoes,
  salvandoPedidoId,
  onTogglePedido,
  onAbrirPedido,
  onAlterarSetor,
  onAlterarLocal,
}: Props) {
  if (linhas.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma linha para exibir na planilha.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#1e1b4b] text-left text-[11px] font-semibold uppercase tracking-wide text-white">
            <th className="w-10 px-2 py-2.5" aria-label="Selecionar" />
            <th className="px-3 py-2.5 whitespace-nowrap">Data de retirada</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Horário da retirada</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Dia da semana</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Nome do cliente</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Setor responsável</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Produto</th>
            <th className="px-3 py-2.5 whitespace-nowrap text-center">Qtd</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Local de retirada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const setorAtual = l.productionSector ?? "";
            const setorMeta = SETORES_OPCOES.find((s) => s.value === setorAtual);
            const localAtual =
              l.unidadeId ??
              locaisOpcoes.find((o) => o.label.toLowerCase() === l.localRetirada.toLowerCase())?.id ??
              "";
            const localMeta =
              locaisOpcoes.find((o) => o.id === localAtual) ??
              locaisOpcoes.find((o) => o.label.toLowerCase() === l.localRetirada.toLowerCase());
            const salvando = salvandoPedidoId === l.pedidoId;

            return (
              <tr
                key={l.linhaId}
                onClick={() => onAbrirPedido(l.pedidoId)}
                className={`cursor-pointer border-b border-border/40 transition-colors ${
                  selectedIds.has(l.pedidoId) ? "bg-olive/10" : "bg-[#edf7ee] hover:bg-[#dcefdc]"
                } ${salvando ? "opacity-60" : ""}`}
                title="Clique para abrir o pedido"
              >
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(l.pedidoId)}
                    onChange={() => onTogglePedido(l.pedidoId)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 cursor-pointer rounded border-border accent-charcoal"
                    aria-label={`Selecionar pedido ${l.pedidoId.slice(-6)}`}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-medium text-charcoal">
                  {l.dataRetirada}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-charcoal">{l.horarioRetirada}</td>
                <td className="px-3 py-2 whitespace-nowrap capitalize text-charcoal">{l.diaSemana}</td>
                <td className="px-3 py-2 font-semibold text-charcoal">{l.nomeCliente}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                      Selecionar setor
                    </option>
                    {SETORES_OPCOES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 font-medium text-charcoal">{l.produto}</td>
                <td className="px-3 py-2 text-center font-semibold text-charcoal">{l.qtd}</td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                    aria-label="Local de retirada"
                  >
                    <option value="" disabled>
                      Selecionar local
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
