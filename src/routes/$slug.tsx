import { createFileRoute, useParams, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Quiz } from "@/components/Quiz";
import { Sucesso } from "@/components/Sucesso";
import { ThemeApplier } from "@/components/ThemeApplier";
import { Toaster } from "@/components/ui/sonner";
import { usePedido } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import type { Campanha } from "@/store/admin";
import { Logo } from "@/components/Logo";
import { loadCloudConfig } from "@/lib/cloudConfig";
import { RESERVED_SLUGS } from "@/lib/slugs";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a757c35e-60cb-4c5a-8c7a-bcae910168c6/id-preview-b1a18bad--04fc775e-2e76-4061-b66c-29560aa9eff1.lovable.app-1777266918125.png";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    try {
      const { data } = await supabase
        .from("app_config")
        .select("payload")
        .eq("id", "default")
        .maybeSingle();
      const campanhas = (data?.payload as { campanhas?: Campanha[] })?.campanhas ?? [];
      const campanha = campanhas.find((c) => c.slug === params.slug);
      return { campanha: campanha ?? null };
    } catch {
      return { campanha: null };
    }
  },
  head: ({ loaderData }) => {
    const c = loaderData?.campanha;
    const titulo = c
      ? `${c.textos?.titulo ?? c.nome} — Casa Almeria`
      : "Monte seu pedido — Casa Almeria";
    const descricao = c?.textos?.subtitulo ?? "Cestas, sobremesas e produtos artesanais. Brasília-DF.";
    const ogImage = c?.socialImageUrl ?? DEFAULT_OG_IMAGE;
    return {
      meta: [
        { title: titulo },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { name: "description", content: descricao },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  component: CampanhaPage,
});

function CampanhaPage() {
  const { slug } = useParams({ from: "/$slug" });
  const { campanha: campanhaCloud } = Route.useLoaderData();
  const campanhas = useAdmin((s) => s.campanhas);
  const setCampanhaAtivaId = useAdmin((s) => s.setCampanhaAtivaId);
  const setCampanha = useAdmin((s) => s.setCampanha);
  const reset = usePedido((s) => s.reset);
  const [concluido, setConcluido] = useState(false);
  const [slugResolvido, setSlugResolvido] = useState(false);

  const reservado = RESERVED_SLUGS.has(slug);
  const campanha = reservado ? undefined : campanhas.find((c) => c.slug === slug);

  // Sincroniza dados publicados (Supabase) para o store local ao carregar o quiz.
  // Isso garante que a versão publicada seja sempre exibida no link público.
  // O admin usa QuizPreviewMobile para testar sem publicar.
  useEffect(() => {
    if (!campanhaCloud) return;
    const local = useAdmin.getState().campanhas.find((c) => c.id === campanhaCloud.id);
    if (local) {
      // Mescla: mantém campos do local que não vieram do cloud (ex.: campanhas locais)
      setCampanha(campanhaCloud.id, campanhaCloud as Partial<Campanha>);
    } else {
      // Campanha ainda não existe localmente — adiciona ao store
      useAdmin.setState((s) => ({
        campanhas: [...s.campanhas, campanhaCloud as Campanha],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaCloud?.id]);

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
      <MensagemBloqueio>Esta campanha está pausada no momento.</MensagemBloqueio>
    );
  }

  const agora = Date.now();
  if (campanha.dataInicio && new Date(campanha.dataInicio).getTime() > agora) {
    const inicio = new Date(campanha.dataInicio).toLocaleDateString("pt-BR");
    return (
      <MensagemBloqueio>
        Esta campanha começa em <strong>{inicio}</strong>. Volte em breve!
      </MensagemBloqueio>
    );
  }
  const fimEfetivo =
    campanha.dataLimitePedidos ?? campanha.dataFim ?? undefined;
  if (fimEfetivo && new Date(fimEfetivo).getTime() < agora) {
    return (
      <MensagemBloqueio>
        Esta campanha foi encerrada — não estamos mais aceitando pedidos.
      </MensagemBloqueio>
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
        initialStep={1}
        onConcluir={() => setConcluido(true)}
        onVoltar={() => reset()}
      />
      <Toaster position="bottom-right" />
    </div>
  );
}

function MensagemBloqueio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
      <Logo />
      <p className="mt-8 max-w-md text-lg text-charcoal">{children}</p>
    </div>
  );
}
