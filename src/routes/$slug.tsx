import { createFileRoute, useParams, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { loadCloudConfig } from "@/lib/cloudConfig";
import { RESERVED_SLUGS } from "@/lib/slugs";

export const Route = createFileRoute("/$slug")({
  head: () => ({
    meta: [{ title: "Monte seu pedido — Casa Almeria" }],
  }),
  component: CampanhaPage,
});

function CampanhaPage() {
  const { slug } = useParams({ from: "/$slug" });
  const campanhas = useAdmin((s) => s.campanhas);
  const setCampanhaAtivaId = useAdmin((s) => s.setCampanhaAtivaId);
  const reset = usePedido((s) => s.reset);
  const cestaSelecionada = usePedido((s) => s.cesta);
  const [concluido, setConcluido] = useState(false);
  const [slugResolvido, setSlugResolvido] = useState(false);

  const reservado = RESERVED_SLUGS.has(slug);
  const campanha = reservado ? undefined : campanhas.find((c) => c.slug === slug);

  // Hook SEMPRE chamado antes de qualquer return — evita "rendered fewer hooks"
  useEffect(() => {
    if (campanha) setCampanhaAtivaId(campanha.id);
  }, [campanha, setCampanhaAtivaId]);

  useEffect(() => {
    if (reservado || campanha) {
      setSlugResolvido(true);
      return;
    }

    let cancelled = false;
    setSlugResolvido(false);

    loadCloudConfig()
      .catch((error) => {
        console.warn("[campanha] falha ao recarregar configuração publicada", error);
      })
      .finally(() => {
        if (!cancelled) setSlugResolvido(true);
      });

    return () => {
      cancelled = true;
    };
  }, [campanha, reservado, slug]);

  if (!reservado && !campanha && !slugResolvido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal/20 border-t-charcoal" />
      </div>
    );
  }

  if (reservado || !campanha) {
    return <Navigate to="/" />;
  }

  if (campanha.status === "pausada") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
        <Logo />
        <p className="mt-8 max-w-md text-lg text-charcoal">
          Esta campanha está pausada no momento.
        </p>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Sucesso
          onVoltar={() => {
            reset();
            setConcluido(false);
          }}
        />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeApplier />
      <Quiz
        initialStep={cestaSelecionada ? 2 : 1}
        onConcluir={() => setConcluido(true)}
        onVoltar={() => reset()}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}
