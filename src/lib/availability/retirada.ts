/**
 * Regra de antecedência de entrega/retirada, configurável por campanha.
 *
 * Aplicada em todas as páginas de campanha (Quiz + cobrança):
 *  - Sem entrega/retirada no mesmo dia → primeira data disponível é o dia seguinte.
 *  - Pedido até 16:00 → no dia seguinte, janelas de manhã e tarde.
 *  - Pedido após 17:00 → no dia seguinte só janelas a partir de `inicioTardeHora`h (14h).
 *  - Entre 16:01 e 17:00 → trata como dia completo no dia seguinte (zona de transição).
 *  - Sexta após 12:00 → sábado inteiro bloqueado (corte da confeitaria/CPD).
 *
 * Lógica pura (sem efeitos), em horário de São Paulo (datas ISO/minutos já em SP),
 * compartilhada entre o seletor do Quiz e o portão do servidor.
 */

import { TZ_SP } from "@/lib/timezone";

export type RegraAntecedenciaRetirada = {
  /** Após este horário (ex.: 17), a manhã do dia seguinte fica indisponível. */
  corteHora: number;
  /** Primeira hora liberada no dia seguinte após o corte (ex.: 14). */
  inicioTardeHora: number;
};

export const REGRA_RETIRADA_PADRAO: RegraAntecedenciaRetirada = {
  corteHora: 17,
  inicioTardeHora: 14,
};

/** Sexta após este horário (minutos do dia) → sábado de retirada bloqueado. */
export const CORTE_SEXTA_SABADO_MINUTOS = 12 * 60; // 12:00

export type CtxAntecedencia = {
  minutosAgoraSP: number;
  amanhaISO: string;
};

/** Usa a regra da campanha ou o padrão global (sempre ativo no checkout). */
export function resolveRegraAntecedencia(
  regra?: RegraAntecedenciaRetirada,
): RegraAntecedenciaRetirada {
  return regra ?? REGRA_RETIRADA_PADRAO;
}

/** Extrai a hora de início de um label "Entre 06h e 08h". */
function inicioHoraDoLabel(label: string): number | null {
  const m = label.match(/Entre\s+(\d{1,2})h\s+e\s+(\d{1,2})h/i);
  return m ? parseInt(m[1], 10) : null;
}

function weekdayShortSP(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ_SP,
    weekday: "short",
  }).format(new Date(`${iso}T12:00:00-03:00`));
}

/**
 * A data de entrega/retirada está bloqueada?
 * Bloqueia o mesmo dia, o passado e — na sexta após 12h — o sábado seguinte
 * (produção da confeitaria/CPD encerra o expediente).
 * `dataISO` e `hojeISO` no formato "YYYY-MM-DD" em SP.
 */
export function dataRetiradaBloqueada(
  dataISO: string,
  hojeISO: string,
  _regra?: RegraAntecedenciaRetirada,
  ctx?: CtxAntecedencia,
): boolean {
  if (dataISO <= hojeISO) return true;

  // Sexta após 12:00 → sábado (amanhã) indisponível.
  if (
    ctx &&
    weekdayShortSP(hojeISO) === "Fri" &&
    ctx.minutosAgoraSP > CORTE_SEXTA_SABADO_MINUTOS &&
    dataISO === ctx.amanhaISO
  ) {
    return true;
  }

  return false;
}

/**
 * A janela de horário está bloqueada para a data de entrega/retirada?
 * Bloqueia apenas a MANHÃ do DIA SEGUINTE quando o pedido foi feito após o corte.
 */
export function horarioRetiradaBloqueado(
  label: string,
  dataISO: string,
  ctx: CtxAntecedencia,
  regra: RegraAntecedenciaRetirada = REGRA_RETIRADA_PADRAO,
): boolean {
  if (dataISO !== ctx.amanhaISO) return false; // corte só afeta o dia seguinte
  if (ctx.minutosAgoraSP <= regra.corteHora * 60) return false; // até 17h00 libera tudo
  const ini = inicioHoraDoLabel(label);
  return ini !== null && ini < regra.inicioTardeHora; // após corte: bloqueia manhã
}
