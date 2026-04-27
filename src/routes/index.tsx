import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin, isEncerrado } from "@/store/admin";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Monte seu pedido — Casa Almeria" },
      {
        name: "description",
        content:
          "Escolha sua cesta, defina entrega e horário, e envie seu pedido Casa Almeria pelo WhatsApp.",
      },
    ],
  }),
  component: Index,
});

function Manutencao({ msg }: { msg: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
      <Logo />
      <p className="mt-8 max-w-md text-balance text-lg text-charcoal">{msg}</p>
    </div>
  );
}

function Index() {
  const geral = useAdmin((s) => s.geral);
  const reset = usePedido((s) => s.reset);
  const cestaSelecionada = usePedido((s) => s.cesta);
  const [concluido, setConcluido] = useState(false);

  if (!geral.ativa) {
    return (
      <>
        <ThemeApplier />
        <Manutencao msg={geral.msgManutencao} />
      </>
    );
  }

  if (isEncerrado(geral.encerramento)) {
    return (
      <>
        <ThemeApplier />
        <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
          <Logo />
          <h1 className="mt-8 font-serif text-3xl text-charcoal">
            Encomendas encerradas
          </h1>
          <p className="mt-4 max-w-md text-ink/70">
            Agradecemos o carinho. Volte em breve para a próxima data.
          </p>
        </div>
      </>
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
        onVoltar={() => {
          reset();
        }}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}
