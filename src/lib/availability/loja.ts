/**
 * Dias em que a loja NÃO recebe novos pedidos.
 *
 * Domingo é fechado para captação: o cliente não consegue finalizar pagamento
 * enquanto for domingo em São Paulo. A retirada/entrega no domingo continua
 * permitida (pedido feito em outro dia).
 *
 * Lógica pura, em horário de São Paulo, compartilhada entre UI e servidor.
 */

import { TZ_SP } from "@/lib/timezone";

/** Dias da semana (0 = domingo) bloqueados para NOVOS pedidos. */
export const DIAS_SEM_NOVOS_PEDIDOS = [0];

export const MSG_LOJA_FECHADA =
  "Não recebemos novos pedidos aos domingos. Volte na segunda-feira para finalizar o seu.";

const fmtWeekday = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ_SP,
  weekday: "short",
});

const INDICE_POR_SIGLA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Dia da semana (0 = domingo) do instante informado, no fuso de São Paulo. */
export function diaDaSemanaSP(agora: Date = new Date()): number {
  return INDICE_POR_SIGLA[fmtWeekday.format(agora)] ?? 0;
}

/** A loja está bloqueada para receber novos pedidos neste instante? */
export function novosPedidosBloqueados(agora: Date = new Date()): boolean {
  return DIAS_SEM_NOVOS_PEDIDOS.includes(diaDaSemanaSP(agora));
}
