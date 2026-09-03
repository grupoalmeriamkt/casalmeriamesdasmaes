import { useEffect, useState } from "react";
import { loadCloudConfig } from "@/lib/cloudConfig";
import { garantirCestasCafePorTamanho, garantirSobremesas, garantirTamanhosBolo } from "@/store/admin";

/**
 * Carrega as configurações compartilhadas (tema, textos, produtos, etc.)
 * do Supabase no boot da app. Enquanto carrega, não renderiza children
 * para evitar flash de defaults antigos.
 *
 * Falha silenciosamente: se não conseguir carregar, segue com defaults
 * locais (localStorage / código).
 */
export function CloudConfigLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCloudConfig().finally(() => {
      try {
        garantirSobremesas();
        garantirCestasCafePorTamanho();
        garantirTamanhosBolo();
      } catch (e) {
        console.warn("[CloudConfigLoader] garantir produtos falhou", e);
      }
      if (!cancelled) setReady(true);
    });
    // Timeout de segurança: não trava o app se Supabase estiver lento.
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/20 border-t-charcoal" />
      </div>
    );
  }

  return <>{children}</>;
}
