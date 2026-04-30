import { createFileRoute, useParams, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";

const RESERVED_SLUGS = new Set([
  "admin",
  "pedido",
  "pedidos",
  "api",
  "q",
  "",
]);

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

  if (RESERVED_SLUGS.has(slug)) {
    return <Navigate to="/" />;
  }

  const campanha = campanhas.find((c) => c.slug === slug);

  useEffect(() => {
    if (campanha) setCampanhaAtivaId(campanha.id);
  }, [campanha?.id, setCampanhaAtivaId]);

  if (!campanha) {
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
