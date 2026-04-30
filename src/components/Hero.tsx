import { useAdmin } from "@/store/admin";

export function Hero() {
  const t = useAdmin((s) => s.textos);
  const encerrado = false;

  return (
    <section className="relative isolate w-full overflow-hidden bg-charcoal">
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1558985250-27a406d64cb3?auto=format&fit=crop&w=2400&q=85"
        alt="Mesa de café da manhã artesanal Casa Almeria com luz natural da manhã"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        loading="eager"
        fetchPriority="high"
      />

      {/* Gradiente mais escuro no mobile para garantir leitura */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.14 0.04 260 / 0.55) 0%, oklch(0.14 0.04 260 / 0.7) 55%, oklch(0.10 0.04 260 / 0.88) 100%)",
        }}
      />

      <div className="container relative mx-auto flex min-h-[auto] flex-col px-5 py-16 sm:px-6 sm:py-24 md:min-h-[88vh] md:px-10 md:py-28">
        {/* Bloco principal */}
        <div className="mt-auto max-w-3xl">
          {/* Eyebrow agora ancorado ao texto, com tracking menor no mobile */}
          <span className="inline-block text-[0.65rem] sm:text-[0.7rem] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.28em] text-terracotta">
            Dia das Mães · 10 e 11 de maio
          </span>

          <div className="my-5 h-px w-12 sm:w-20 bg-terracotta" />

          {/* Headline com tamanhos controlados, sem clamp agressivo */}
          <h1 className="text-balance font-serif text-[2.4rem] leading-[1.05] font-light text-linen sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Neste Dia das Mães,{" "}
            <em className="italic text-terracotta">faça a manhã dela mais especial.</em>
          </h1>

          <p className="mt-6 sm:mt-8 max-w-xl text-pretty font-serif text-[1.05rem] sm:text-lg italic leading-relaxed text-linen/90 md:text-xl">
            {encerrado
              ? "As reservas para esta edição se encerraram. Inscreva-se para a próxima estação."
              : "Uma cesta de café da manhã preparada à mão na madrugada da entrega, levada à porta dela entre 06h e 10h. Pães quentes, queijos curados, geleias da casa — o presente que ela vai sentir antes de provar."}
          </p>

          {!encerrado && (
            <div className="mt-6">
              <span className="tag-prazo-dark">
                Pedidos até quinta, 07/05
              </span>
            </div>
          )}

          {!encerrado && (
            <>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-x-6 sm:gap-y-4">
                <a
                  href="#produtos"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-7 py-4 text-[0.78rem] sm:text-[0.8rem] font-semibold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-charcoal shadow-warm transition-all hover:bg-linen hover:text-charcoal"
                >
                  <span className="whitespace-nowrap">Escolher a melhor opção</span>
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                </a>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-linen/70 px-7 py-4 text-[0.78rem] sm:text-[0.8rem] font-medium uppercase tracking-[0.16em] sm:tracking-[0.2em] text-linen transition-all hover:border-terracotta hover:text-terracotta"
                >
                  Ver como funciona
                </a>
              </div>

              {/* Selo de confiança */}
              <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] sm:text-xs text-linen/75">
                <span className="text-terracotta tracking-widest">★★★★★</span>
                <span>+200 mães presenteadas em Brasília</span>
              </p>
            </>
          )}
        </div>

        {/* Linha de meta condensada — só uma linha discreta */}
        {!encerrado && (
          <div className="mt-10 sm:mt-14 border-t border-linen/15 pt-5 sm:pt-6">
            <p className="text-[0.62rem] sm:text-[0.65rem] uppercase tracking-[0.18em] sm:tracking-[0.26em] text-linen/65">
              Brasília · 104 Sul · Noroeste · Entrega 06h–10h
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
