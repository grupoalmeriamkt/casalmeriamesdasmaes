import { TZ_SP } from "@/lib/timezone";

/** Extrai hora inicial de rótulos como "Entre 08h e 09h". */
export function parseHorarioInicio(horario: string | null | undefined): number {
  if (!horario) return 12;
  const m = horario.match(/Entre\s+(\d{1,2})h/i);
  if (m) return Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const hm = horario.match(/(\d{1,2}):(\d{2})/);
  if (hm) return Math.min(23, Math.max(0, parseInt(hm[1], 10)));
  return 12;
}

/** Calcula execution_at a partir de data_entrega (YYYY-MM-DD ou texto PT) e horario. */
export function computeExecutionAt(
  dataEntrega: string | null | undefined,
  horario: string | null | undefined,
): string | null {
  if (!dataEntrega) return null;

  let iso = dataEntrega;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEntrega)) {
    const match = dataEntrega.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (!match) return null;
    const months: Record<string, string> = {
      janeiro: "01",
      fevereiro: "02",
      março: "03",
      marco: "03",
      abril: "04",
      maio: "05",
      junho: "06",
      julho: "07",
      agosto: "08",
      setembro: "09",
      outubro: "10",
      novembro: "11",
      dezembro: "12",
    };
    const month = months[match[2].toLowerCase()];
    if (!month) return null;
    iso = `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
  }

  const hour = parseHorarioInicio(horario);
  const minute = 0;
  const d = new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatExecutionTimeSP(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ_SP,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
