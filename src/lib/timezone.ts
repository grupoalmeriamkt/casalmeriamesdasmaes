export const TZ_SP = "America/Sao_Paulo";

const fmtDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_SP,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ_SP,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "YYYY-MM-DD" no fuso de São Paulo. */
export function todayISOSP(date: Date = new Date()): string {
  return fmtDate.format(date);
}

/** Início do dia em SP como Date UTC-equivalente para comparações. */
export function startOfDaySP(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00-03:00`);
}

/** Minutos desde a meia-noite (hora*60 + minuto) no fuso de São Paulo. */
export function minutosDoDiaSP(date: Date = new Date()): number {
  const parts = fmtParts.formatToParts(date);
  const p: Record<string, string> = {};
  for (const x of parts) if (x.type !== "literal") p[x.type] = x.value;
  return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
}

/** "YYYY-MM-DD" do dia seguinte no fuso de São Paulo. */
export function amanhaISOSP(date: Date = new Date()): string {
  const hoje = todayISOSP(date);
  // Âncora ao meio-dia SP para não cruzar borda de fuso ao somar 1 dia.
  const d = new Date(`${hoje}T12:00:00-03:00`);
  d.setDate(d.getDate() + 1);
  return fmtDate.format(d);
}

/** Fim do dia em SP. */
export function endOfDaySP(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999-03:00`);
}

export function nowSP(): Date {
  const parts = fmtParts.formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const x of parts) if (x.type !== "literal") p[x.type] = x.value;
  return new Date(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00-03:00`,
  );
}

export function isBeforeTodaySP(executionAt: string | Date | null | undefined): boolean {
  if (!executionAt) return false;
  const d = typeof executionAt === "string" ? new Date(executionAt) : executionAt;
  const execDay = fmtDate.format(d);
  return execDay < todayISOSP();
}

export function isTodaySP(isoOrDate: string | Date): boolean {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return fmtDate.format(d) === todayISOSP();
}

export function isTomorrowSP(isoOrDate: string | Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return fmtDate.format(d) === fmtDate.format(tomorrow);
}

export function labelGrupoExecucao(executionAt: string | null | undefined): string {
  if (!executionAt) return "Sem data";
  const d = new Date(executionAt);
  if (isTodaySP(d)) return "Hoje";
  if (isTomorrowSP(d)) return "Amanhã";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
