import { useAdmin } from "@/store/admin";
import { Instagram, MessageCircle, Facebook } from "lucide-react";

export function HomeFooter() {
  const rodape = useAdmin((s) => s.home.rodape);
  const unidades = useAdmin((s) => s.unidades);
  const tagline = useAdmin((s) => s.textos.taglineFooter);

  return (
    <footer className="mt-12 bg-charcoal text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 md:grid-cols-3 md:px-8">
        <div>
          <h3 className="mb-3 font-serif text-lg font-bold">Endereços</h3>
          {rodape.enderecos ? (
            <p className="whitespace-pre-line text-sm text-white/80">
              {rodape.enderecos}
            </p>
          ) : (
            <ul className="space-y-2 text-sm text-white/80">
              {unidades
                .filter((u) => u.status === "ativa")
                .map((u) => (
                  <li key={u.id}>
                    <strong className="block text-white">{u.nome}</strong>
                    {u.endereco}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-serif text-lg font-bold">Funcionamento</h3>
          <ul className="space-y-2 text-sm text-white/80">
            {unidades
              .filter((u) => u.status === "ativa")
              .slice(0, 2)
              .map((u) => {
                const dias = Object.entries(u.horarioFuncionamento).filter(
                  ([, v]) => v.ativo,
                );
                return (
                  <li key={u.id}>
                    <strong className="block text-white">{u.nome}</strong>
                    {dias.length > 0
                      ? `${dias[0][1].inicio} – ${dias[0][1].fim}`
                      : "Fechado"}
                  </li>
                );
              })}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-serif text-lg font-bold">Redes</h3>
          <div className="flex gap-3">
            {rodape.redes.instagram && (
              <a
                href={rodape.redes.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
              >
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {rodape.redes.whatsapp && (
              <a
                href={rodape.redes.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
            {rodape.redes.facebook && (
              <a
                href={rodape.redes.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
              >
                <Facebook className="h-5 w-5" />
              </a>
            )}
          </div>
          {rodape.textoLivre && (
            <p className="mt-4 whitespace-pre-line text-xs text-white/60">
              {rodape.textoLivre}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Casa Almeria — {tagline}
      </div>
    </footer>
  );
}
