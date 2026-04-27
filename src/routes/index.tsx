import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Experiencia } from "@/components/Experiencia";
import { ComoFunciona } from "@/components/ComoFunciona";
import { Depoimentos } from "@/components/Depoimentos";
import { Produtos } from "@/components/Produtos";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { Informacoes } from "@/components/Informacoes";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin, isEncerrado } from "@/store/admin";
import { Logo } from "@/components/Logo";

type Etapa = "produtos" | "quiz" | "sucesso";

export const Route = createFileRoute("/")({
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
  const [etapa, setEtapa] = useState<Etapa>("produtos");
  const fluxoRef = useRef<HTMLDivElement>(null);
  const reset = usePedido((s) => s.reset);
  const cestaSelecionada = usePedido((s) => s.cesta);

  const irPara = (e: Etapa) => {
    setEtapa(e);
    setTimeout(
      () => fluxoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  useEffect(() => {
    if (etapa === "sucesso") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [etapa]);

  if (!geral.ativa) {
    return (
      <>
        <ThemeApplier />
        <Manutencao msg={geral.msgManutencao} />
      </>
    );
  }

  const encerrado = isEncerrado(geral.encerramento);

  if (etapa === "sucesso") {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Header />
        <Sucesso
          onVoltar={() => {
            reset();
            setEtapa("produtos");
          }}
        />
        <Footer />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  // Quiz em "página própria" — sem Header/Hero/Footer
  if (!encerrado && etapa === "quiz") {
    return (
      <div className="min-h-screen bg-background">
        <ThemeApplier />
        <Quiz
          // se já há uma cesta escolhida na vitrine, começa direto no passo 2
          initialStep={cestaSelecionada ? 2 : 1}
          onConcluir={() => setEtapa("sucesso")}
          onVoltar={() => irPara("produtos")}
        />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeApplier />
      <Header />
      <Hero />

      {!encerrado && <Experiencia />}

      <div ref={fluxoRef}>
        {!encerrado && <Produtos onContinuar={() => irPara("quiz")} />}
      </div>

      {!encerrado && (
        <>
          <ComoFunciona />
          <Depoimentos />
        </>
      )}

      {geral.mostrarInformacoes && <Informacoes />}
      <Footer />
      <Toaster position="bottom-right" />
    </div>
  );
}
