export function ordenarPorEntrega<
  T extends { data?: string | null; horario?: string | null; criadoEm?: string },
>(lista: T[]): T[] {
  const chave = (x: T) => x.data ?? "9999-12-31";
  return [...lista].sort((a, b) => {
    const d = chave(a).localeCompare(chave(b));
    if (d !== 0) return d;
    const h = (a.horario ?? "").localeCompare(b.horario ?? "");
    if (h !== 0) return h;
    return (a.criadoEm ?? "").localeCompare(b.criadoEm ?? "");
  });
}
