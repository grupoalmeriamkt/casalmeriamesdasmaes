import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { ArrowRight } from "lucide-react";

export function HomeBanner() {
  const banner = useAdmin((s) => s.home.banner);
  const textos = useAdmin((s) => s.textos);
  const campanhas = useAdmin((s) => s.campanhas);
  const destaques = useAdmin((s) => s.home.campanhasDestaque);

  const primeiraCampanha = useMemo(() => {
    return campanhas
      .filter((c) => c.status === "ativa" && destaques[c.id]?.ativo)
      .sort((a, b) => (destaques[a.id]?.ordem ?? 0) - (destaques[b.id]?.ordem ?? 0))[0];
  }, [campanhas, destaques]);

  const titulo = textos.heroTitulo || "Sabores que contam histórias";
  const subtitulo = textos.heroSubtitulo || "Pães artesanais, doces e cestas com ingredientes selecionados.";
  const ctaLabel = textos.ctaPrincipal || "Explorar cardápio";

  return (
    <section className="w-full bg-charcoal text-white">
      {/* ── Mobile ── */}
      <div className="relative overflow-hidden md:hidden">
        {banner.imagemUrl && (
          <img
            src={banner.imagemUrl}
            alt={titulo}
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            loading="eager"
          />
        )}
        <div className="relative px-5 pb-12 pt-10">
          <p className="eyebrow-gold mb-3">Cardápio digital</p>
          <h1
            className="font-serif text-[2.2rem] font-semibold leading-[1.05] tracking-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            {titulo}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">{subtitulo}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#cardapio"
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-terracotta/90 active:scale-95"
            >
              {ctaLabel}
            </a>
            {primeiraCampanha && (
              <Link
                to="/$slug"
                params={{ slug: primeiraCampanha.slug }}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white/90 transition-all hover:border-white/60 hover:text-white active:scale-95"
              >
                {primeiraCampanha.textos?.titulo || primeiraCampanha.nome}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden md:block">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-20">
          {/* Left: text */}
          <div>
            <p className="eyebrow-gold mb-4">Cardápio digital</p>
            <h1
              className="font-serif text-5xl font-semibold leading-[1.05] lg:text-[3.5rem]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {titulo}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75">
              {subtitulo}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#cardapio"
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow transition-all hover:bg-terracotta/90 active:scale-95"
              >
                {ctaLabel}
              </a>
              {primeiraCampanha && (
                <Link
                  to="/$slug"
                  params={{ slug: primeiraCampanha.slug }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/85 transition-all hover:border-white/50 hover:text-white active:scale-95"
                >
                  {primeiraCampanha.textos?.titulo || primeiraCampanha.nome}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Right: banner image */}
          {banner.imagemUrl && (
            <div className="relative overflow-hidden rounded-[22px]">
              <img
                src={banner.imagemUrl}
                alt={titulo}
                className="h-64 w-full object-cover lg:h-80"
                loading="eager"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
