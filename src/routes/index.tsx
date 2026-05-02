import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { HomeBanner } from "@/components/home/HomeBanner";
import { HomeCampanhasDestaque } from "@/components/home/HomeCampanhasDestaque";
import { HomeCategoriasCarousel } from "@/components/home/HomeCategoriasCarousel";
import { HomeProdutosPorCategoria } from "@/components/home/HomeProdutosPorCategoria";
import { HomeFooter } from "@/components/home/HomeFooter";
import { CartDrawer } from "@/components/home/CartDrawer";
import { HomeHeader } from "@/components/home/HomeHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casa Almeria — Cardápio digital" },
      {
        name: "description",
        content:
          "Cardápio completo do Casa Almeria: cestas, sobremesas e produtos artesanais com entrega ou retirada em Brasília.",
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
  const [search, setSearch] = useState("");

  if (!geral.ativa) {
    return (
      <>
        <ThemeApplier />
        <Manutencao msg="Estamos preparando algo especial. Volte em breve." />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ThemeApplier />
      <HomeHeader />
      <main>
        <HomeBanner search={search} onSearch={setSearch} />
        {!search.trim() && (
          <>
            <HomeCampanhasDestaque />
            <HomeCategoriasCarousel />
          </>
        )}
        <HomeProdutosPorCategoria search={search} />
      </main>
      <HomeFooter />
      <CartDrawer />
      <Toaster position="bottom-right" />
    </div>
  );
}
