import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAdmin } from "@/store/admin";
import { ArrowRight, Search, X } from "lucide-react";

type Props = {
  search: string;
  onSearch: (v: string) => void;
};

export function HomeBanner({ search, onSearch }: Props) {
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
  const subtitulo = textos.heroSubtitulo || "Fermentação lenta, ingredientes selecionados e a tradição mediterrânea no coração de Brasília.";
  const ctaLabel = textos.ctaPrincipal || "Explorar cardápio";
  const eyebrow = primeiraCampanha?.textos?.eyebrow || "Cardápio digital";

  return (
    <>
      {/* ── Mobile hero ── */}
      <section className="relative overflow-hidden bg-charcoal text-white md:hidden">
        {banner.imagemUrl && (
          <img
            src={banner.imagemUrl}
            alt={titulo}
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            loading="eager"
          />
        )}
        <div className="relative px-5 pb-10 pt-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
            {eyebrow}
          </p>
          <h1
            className="font-serif text-[2.2rem] font-semibold leading-[1.05] text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            {titulo}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">{subtitulo}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#cardapio"
              className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-charcoal transition-all hover:bg-terracotta/90 active:scale-95"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </a>
            {primeiraCampanha && (
              <Link
                to="/$slug"
                params={{ slug: primeiraCampanha.slug }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-2.5 text-sm font-medium text-white/90 transition-all hover:border-white/50 hover:text-white active:scale-95"
              >
                {primeiraCampanha.textos?.titulo || primeiraCampanha.nome}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Desktop hero — card arredondado ── */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-6xl px-6 pt-8 lg:px-8">
          <section
            className="relative mb-10 grid min-h-[360px] overflow-hidden rounded-[28px] bg-charcoal text-white"
            style={{ gridTemplateColumns: "1.2fr 1fr", gap: 40, padding: "64px 56px" }}
          >
            {/* Texto */}
            <div className="flex flex-col justify-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
                {eyebrow}
              </p>
              <h1
                className="font-serif font-semibold leading-[1.05] text-white"
                style={{ fontSize: 56, letterSpacing: "-0.02em", marginBottom: 20, textWrap: "balance" } as React.CSSProperties}
              >
                {titulo}
              </h1>
              <p
                className="text-base leading-[1.55] text-white/80"
                style={{ maxWidth: 460, marginBottom: 32 }}
              >
                {subtitulo}
              </p>
              <div className="flex gap-3">
                <a
                  href="#cardapio"
                  className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-[26px] py-3.5 text-[14px] font-semibold text-charcoal transition-all hover:bg-terracotta/90 active:scale-95"
                >
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to={primeiraCampanha ? "/$slug" : "/"}
                  params={primeiraCampanha ? { slug: primeiraCampanha.slug } : {}}
                  className="inline-flex items-center rounded-xl border border-white/25 px-[22px] py-3.5 text-[14px] font-medium text-white transition-all hover:border-white/50 active:scale-95"
                >
                  {primeiraCampanha?.textos?.titulo || primeiraCampanha?.nome || "Combos & cestas"}
                </Link>
              </div>
            </div>

            {/* Imagem */}
            <div
              className="relative overflow-hidden rounded-[22px]"
              style={{ minHeight: 280 }}
            >
              {banner.imagemUrl ? (
                <img
                  src={banner.imagemUrl}
                  alt={titulo}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="h-full w-full bg-charcoal/40" />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Search bar (ambos) ── */}
      <div className="bg-background px-5 py-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div
            className="flex items-center gap-3 border border-charcoal/8 bg-white"
            style={{ height: 56, maxWidth: 560, borderRadius: 16, padding: "0 20px" }}
          >
            <Search className="h-5 w-5 shrink-0 text-charcoal/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar pães, doces, salgados, cafés…"
              className="flex-1 bg-transparent text-[15px] text-charcoal outline-none placeholder:text-charcoal/35"
            />
            {search && (
              <button
                onClick={() => onSearch("")}
                className="flex items-center justify-center p-1 text-charcoal/40 transition-colors hover:text-charcoal"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
