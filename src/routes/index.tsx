import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { VitrineProdutos } from "@/components/VitrineProdutos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casa Almeria — Cestas e produtos artesanais" },
      {
        name: "description",
        content:
          "Conheça nossos produtos e monte seu pedido com entrega ou retirada.",
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
  const textos = useAdmin((s) => s.textos);
  const reset = usePedido((s) => s.reset);
  const setCesta = usePedido((s) => s.setCesta);
  const cestaSelecionada = usePedido((s) => s.cesta);
  const [concluido, setConcluido] = useState(false);
  const [emQuiz, setEmQuiz] = useState(!!cestaSelecionada);

  if (!geral.ativa) {
    return (
      <>
        <ThemeApplier />
        <Manutencao msg="Estamos preparando algo especial. Volte em breve." />
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
            setEmQuiz(false);
          }}
        />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  if (emQuiz) {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Quiz
          initialStep={cestaSelecionada ? 2 : 1}
          onConcluir={() => setConcluido(true)}
          onVoltar={() => {
            reset();
            setEmQuiz(false);
          }}
        />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeApplier />
      <header className="bg-charcoal">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <Logo variant="light" />
          <span className="badge-mae">🌸 Dia das Mães</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:px-8 md:py-14">
        <section className="mb-10 max-w-2xl">
          <p className="eyebrow-gold mb-2">Casa Almeria</p>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-charcoal sm:text-4xl">
            {textos.heroTitulo}
          </h1>
          <p className="mt-3 text-base text-ink/70">{textos.heroSubtitulo}</p>
          {textos.badgePrazo && (
            <div className="tag-prazo mt-4 inline-block">
              📦 {textos.badgePrazo}
            </div>
          )}
        </section>

        <VitrineProdutos
          onEscolher={(p) => {
            setCesta(p);
            setEmQuiz(true);
          }}
        />
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
