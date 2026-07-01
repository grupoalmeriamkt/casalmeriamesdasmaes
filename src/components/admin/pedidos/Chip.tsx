import type { Chip as ChipData } from "@/lib/etapaPedido";

/** Chip de status no visual do handoff (padding 3×11, radius 999). */
export function Chip({ chip }: { chip: ChipData | null | undefined }) {
  if (!chip) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-[3px] text-xs font-semibold"
      style={{ backgroundColor: chip.bg, color: chip.fg }}
    >
      {chip.label}
    </span>
  );
}
