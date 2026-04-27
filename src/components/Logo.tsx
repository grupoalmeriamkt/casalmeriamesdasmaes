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
        className={`h-10 w-auto object-contain sm:h-12 ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex flex-col items-start leading-none ${className}`}>
      <span
        className="text-[1.1rem] sm:text-[1.25rem] font-bold tracking-[0.22em] uppercase"
        style={{ color: main, fontFamily: "var(--font-serif)" }}
      >
        CASA
      </span>
      <span
        className="-mt-1 text-[0.95rem] sm:text-[1.05rem]"
        style={{ color: accent, fontFamily: "var(--font-script)", lineHeight: 1 }}
      >
        almeria
      </span>
    </div>
  );
}
