import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin, isEncerrado } from "@/store/admin";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/pedido")({
  head: () => ({
    meta: [
      { title: "Monte seu pedido — Casa Almeria" },
      {
        name: "description",
        content:
          "Escolha sua cesta, defina entrega e horário, e finalize seu pedido Casa Almeria em poucos passos.",
      },
      { property: "og:title", content: "Monte seu pedido — Casa Almeria" },
      {
        property: "og:description",
        content: "Reserve sua cesta Casa Almeria com afeto, em poucos passos.",
      },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const navigate = useNavigate();
  const geral = useAdmin((s) => s.geral);
  const reset = usePedido((s) => s.reset);
  const cestaSelecionada = usePedido((s) => s.cesta);
  const [concluido, setConcluido] = useState(false);

  if (!geral.ativa) {
    return (
      <>
        <ThemeApplier />
        <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
          <Logo />
          <p className="mt-8 max-w-md text-balance text-lg text-charcoal">
            {geral.msgManutencao}
          </p>
        </div>
      </>
    );
  }

  if (isEncerrado(geral.encerramento)) {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Header />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-3xl text-charcoal">
            Encomendas encerradas
          </h1>
          <p className="mt-4 text-ink/70">
            Agradecemos o carinho. Volte em breve para a próxima data.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Header />
        <Sucesso
          onVoltar={() => {
            reset();
            setConcluido(false);
            navigate({ to: "/" });
          }}
        />
        <Footer />
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
        onVoltar={() => navigate({ to: "/" })}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}
