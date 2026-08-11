import { useAdmin } from "@/store/admin";

type Props = { variant?: "dark" | "light"; className?: string };

export function Logo({ variant = "dark", className = "" }: Props) {
  const logoUrl = useAdmin((s) => s.tema.logoUrl);
  const logoUrlAlt = useAdmin((s) => s.tema.logoUrlAlt);
  const main = variant === "light" ? "#FFFFFF" : "var(--charcoal)";
  const accent = "var(--terracotta)";

  // Em variant="light" (fundo escuro), preferimos a logo alternativa se existir.
  const activeLogo = variant === "light" ? logoUrlAlt || logoUrl : logoUrl;

  if (activeLogo) {
    return (
      <img
        src={activeLogo}
        alt="Casa Almeria"
        className={`h-14 w-auto object-contain sm:h-[4.25rem] ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex flex-col items-start leading-none ${className}`}>
      <span
        className="text-[1.45rem] sm:text-[1.7rem] font-bold tracking-[0.22em] uppercase"
        style={{ color: main, fontFamily: "var(--font-serif)" }}
      >
        CASA
      </span>
      <span
        className="-mt-1 text-[1.15rem] sm:text-[1.3rem]"
        style={{ color: accent, fontFamily: "var(--font-script)", lineHeight: 1 }}
      >
        almeria
      </span>
    </div>
  );
}
