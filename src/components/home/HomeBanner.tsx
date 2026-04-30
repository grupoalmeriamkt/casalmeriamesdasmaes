import { useAdmin } from "@/store/admin";

export function HomeBanner() {
  const banner = useAdmin((s) => s.home.banner);
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative aspect-[16/7] w-full bg-charcoal sm:aspect-[16/6]">
        {banner.imagemUrl && (
          <img
            src={banner.imagemUrl}
            alt={banner.titulo}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            loading="eager"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/70 via-charcoal/30 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-4 py-8 text-white sm:px-6 md:px-8">
          {banner.titulo && (
            <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {banner.titulo}
            </h1>
          )}
          {banner.subtitulo && (
            <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">
              {banner.subtitulo}
            </p>
          )}
          {banner.ctaLabel && banner.ctaHref && (
            <a
              href={banner.ctaHref}
              className="mt-5 inline-flex w-fit items-center rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-terracotta/90"
            >
              {banner.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
