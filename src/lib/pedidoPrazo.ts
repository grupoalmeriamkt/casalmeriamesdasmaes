export type PrazoStatus = "concluido" | "atrasado" | "hoje" | "no_prazo" | null;

export function prazoStatus(
  p: { data?: string | null; concluidoAt?: string | null },
  hojeIso: string, // "YYYY-MM-DD" local today, passed by caller for determinism
): PrazoStatus {
  if (p.concluidoAt) return "concluido";
  const d = p.data ? p.data.slice(0, 10) : "";
  if (!d) return null;
  if (d < hojeIso) return "atrasado";
  if (d === hojeIso) return "hoje";
  return "no_prazo";
}

export const PRAZO_LABEL: Record<Exclude<PrazoStatus, null>, string> = {
  concluido: "Concluído",
  atrasado: "Atrasado",
  hoje: "Para hoje",
  no_prazo: "No prazo",
};
