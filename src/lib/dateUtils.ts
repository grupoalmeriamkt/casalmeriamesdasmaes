function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "Domingo, 10 de Junho de 2026"
export function formatDatePtBR(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);

  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  return `${capitalize(p.weekday ?? "")}, ${p.day ?? ""} de ${capitalize(p.month ?? "")} de ${p.year ?? ""}`;
}

// All dates from start to end (inclusive), at noon local time
export function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  while (cur <= last) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// "2026-06-10" from a local Date
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse ISO date id "YYYY-MM-DD" → card display parts, null for legacy ids
export function parseDateId(id: string): { dia: string; semana: string; mesAno: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  const [y, m, d] = id.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);

  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;

  return {
    dia: p.day ?? String(d),
    semana: capitalize(p.weekday ?? ""),
    mesAno: `${capitalize(p.month ?? "")} de ${p.year ?? y}`,
  };
}
