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
      <header className="bg-charcoal">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <Logo variant="light" />
        </div>
      </header>
      <main>
        <HomeBanner />
        <HomeCampanhasDestaque />
        <HomeCategoriasCarousel />
        <HomeProdutosPorCategoria />
      </main>
      <HomeFooter />
      <CartDrawer />
      <Toaster position="bottom-right" />
    </div>
  );
}
