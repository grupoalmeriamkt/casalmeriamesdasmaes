import { useEffect } from "react";
import { useAdmin } from "@/store/admin";

// Converte hex (#RRGGBB) para oklch aproximado via canvas + cálculo simples.
// Para o admin, usamos uma estratégia mais simples: aplicar como CSS var direta.
// Tailwind usa as vars --charcoal/--terracotta, então sobrescrevemos elas.
function hexToOklchString(hex: string): string {
  // Fallback: deixa o navegador converter para a cor — usamos hex direto.
  // Como nosso design system espera oklch, o navegador moderno aceita hex
  // em qualquer var, e bg-/text- via Tailwind v4 funciona normalmente.
  return hex;
}

export function ThemeApplier() {
  const tema = useAdmin((s) => s.tema);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--charcoal", hexToOklchString(tema.primary));
    root.style.setProperty("--terracotta", hexToOklchString(tema.accent));
    root.style.setProperty("--linen", hexToOklchString(tema.background));
    // primary/accent semantic tokens também
    root.style.setProperty("--primary", hexToOklchString(tema.primary));
    root.style.setProperty("--accent", hexToOklchString(tema.accent));
    root.style.setProperty("--ring", hexToOklchString(tema.accent));

    if (tema.modo === "escuro") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [tema]);

  return null;
}
