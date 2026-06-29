import { nowSP, startOfDaySP, todayISOSP, TZ_SP } from "@/lib/timezone";
import type {
  CarrinhoItem,
  DisponibilidadeInput,
  DisponibilidadeResult,
  JanelaDisponivel,
  ProdutoRegras,
} from "./types";
import { defaultRegras, mergeRegras, regraMaisRestritiva } from "./rules";

const DEFAULT_WINDOWS: JanelaDisponivel[] = [
  { label: "Entre 06h e 07h", inicioHora: 6, fimHora: 7 },
  { label: "Entre 07h e 08h", inicioHora: 7, fimHora: 8 },
  { label: "Entre 08h e 09h", inicioHora: 8, fimHora: 9 },
  { label: "Entre 09h e 10h", inicioHora: 9, fimHora: 10 },
  { label: "Entre 10h e 12h", inicioHora: 10, fimHora: 12 },
  { label: "Entre 12h e 14h", inicioHora: 12, fimHora: 14 },
  { label: "Entre 14h e 16h", inicioHora: 14, fimHora: 16 },
  { label: "Entre 16h e 18h", inicioHora: 16, fimHora: 18 },
  { label: "Entre 18h e 20h", inicioHora: 18, fimHora: 20 },
];

function parseSlotHour(t: string): number {
  const [h] = t.split(":").map(Number);
  return h ?? 12;
}

function isWeekendSP(d: Date): boolean {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ_SP, weekday: "short" }).format(d);
  return wd === "Sat" || wd === "Sun";
}

function isMondaySP(iso: string): boolean {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ_SP,
    weekday: "short",
  }).format(startOfDaySP(iso));
  return wd === "Mon";
}

function effectiveLeadHours(regra: ProdutoRegras, orderNow: Date, targetIso: string): number {
  let lead = regra.minimum_lead_time_hours;
  if (isWeekendSP(orderNow) && isMondaySP(targetIso)) {
    lead = Math.max(lead, 24 + (regra.weekend_extra_hours ?? 0));
  }
  return lead;
}

function earliestExecution(orderNow: Date, leadHours: number): Date {
  return new Date(orderNow.getTime() + leadHours * 60 * 60 * 1000);
}

export function buildRegrasForItens(
  itens: CarrinhoItem[],
  dbRules?: Map<string, Partial<ProdutoRegras>>,
): ProdutoRegras[] {
  return itens.map((item) => {
    const key = `${item.produto_tipo}:${item.produto_id}`;
    return mergeRegras(item, dbRules?.get(key) ?? null);
  });
}

export function validateDisponibilidade(
  input: DisponibilidadeInput,
  dbRules?: Map<string, Partial<ProdutoRegras>>,
  horariosCampanha?: string[],
): DisponibilidadeResult {
  const errors: string[] = [];
  if (input.itens.length === 0) {
    return { valid: false, errors: ["Carrinho vazio"] };
  }

  const regras = buildRegrasForItens(input.itens, dbRules);
  const restritiva = regraMaisRestritiva(regras);

  if (!restritiva.allowed_fulfillment_modes.includes(input.fulfillmentMode)) {
    errors.push("Modo de entrega não permitido para um ou mais itens do carrinho.");
  }

  if (
    input.unidadeId &&
    restritiva.allowed_unit_ids?.length &&
    !restritiva.allowed_unit_ids.includes(input.unidadeId)
  ) {
    errors.push("Unidade não autorizada para este pedido.");
  }

  const orderNow = nowSP();
  const today = todayISOSP(orderNow);

  if (input.candidateDate) {
    const targetStart = startOfDaySP(input.candidateDate);
    const lead = effectiveLeadHours(restritiva, orderNow, input.candidateDate);
    const earliest = earliestExecution(orderNow, lead);

    if (!restritiva.same_day_allowed && input.candidateDate === today) {
      errors.push("Este pedido não pode ser agendado para o mesmo dia.");
    }

    if (targetStart.getTime() < startOfDaySP(today).getTime()) {
      errors.push("Data de execução no passado.");
    }

    if (targetStart.getTime() + 23 * 3600000 < earliest.getTime()) {
      errors.push(
        `Antecedência mínima de ${lead}h não atendida para a data selecionada.`,
      );
    }

    if (input.candidateHorario) {
      const windows = getAvailableWindows(
        restritiva,
        input.candidateDate,
        orderNow,
        horariosCampanha,
      );
      const ok = windows.some((w) => w.label === input.candidateHorario);
      if (!ok) errors.push("Horário indisponível para a data selecionada.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    availableDates: listAvailableDates(restritiva, orderNow, 14),
    availableWindows: input.candidateDate
      ? getAvailableWindows(restritiva, input.candidateDate, orderNow, horariosCampanha)
      : undefined,
  };
}

export function listAvailableDates(
  regra: ProdutoRegras,
  orderNow: Date,
  daysAhead: number,
): string[] {
  const today = todayISOSP(orderNow);
  const out: string[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(startOfDaySP(today));
    d.setDate(d.getDate() + i);
    const iso = todayISOSP(d);
    if (!regra.same_day_allowed && iso === today) continue;
    const lead = effectiveLeadHours(regra, orderNow, iso);
    const earliest = earliestExecution(orderNow, lead);
    if (startOfDaySP(iso).getTime() + 20 * 3600000 >= earliest.getTime()) {
      out.push(iso);
    }
  }
  return out;
}

export function getAvailableWindows(
  regra: ProdutoRegras,
  isoDate: string,
  orderNow: Date,
  horariosCampanha?: string[],
): JanelaDisponivel[] {
  const labels =
    horariosCampanha?.length ? horariosCampanha : DEFAULT_WINDOWS.map((w) => w.label);
  const windows: JanelaDisponivel[] = labels.map((label) => {
    const m = label.match(/Entre\s+(\d{1,2})h\s+e\s+(\d{1,2})h/i);
    return {
      label,
      inicioHora: m ? parseInt(m[1], 10) : 12,
      fimHora: m ? parseInt(m[2], 10) : 13,
    };
  });

  const lead = effectiveLeadHours(regra, orderNow, isoDate);
  const earliest = earliestExecution(orderNow, lead);
  const mondayMin = parseSlotHour(regra.monday_first_slot ?? "12:00");
  const isMon = isMondaySP(isoDate);

  return windows.filter((w) => {
    if (isMon && w.inicioHora < mondayMin) return false;
    const slotStart = new Date(`${isoDate}T${String(w.inicioHora).padStart(2, "0")}:00:00-03:00`);
    return slotStart >= earliest;
  });
}

export { defaultRegras, regraMaisRestritiva, resolveProductionSector } from "./rules";
