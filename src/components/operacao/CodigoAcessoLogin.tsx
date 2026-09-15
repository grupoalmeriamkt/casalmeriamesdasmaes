import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { codigoAcessoValido, somenteDigitos } from "@/lib/operacaoCodigo";

type CodigoAcessoLoginProps = {
  heroImageSrc?: string;
  loading?: boolean;
  onEntrar: (codigo: string) => void;
  onUsarEmail: () => void;
};

/** Login do portal /operacao pelo código pessoal (mesmo visual do SignInPage). */
export function CodigoAcessoLogin({
  heroImageSrc,
  loading = false,
  onEntrar,
  onUsarEmail,
}: CodigoAcessoLoginProps) {
  const [codigo, setCodigo] = useState("");
  const [mostrarCodigo, setMostrarCodigo] = useState(false);

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEntrar(codigo);
  };

  return (
    <div className="admin-shell flex h-[100dvh] w-full flex-col bg-[#f2f2f7] font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="admin-card w-full max-w-md p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="animate-element animate-delay-100">
              <Logo className="h-14 sm:h-16" />
            </div>
            <p className="animate-element animate-delay-200 text-muted-foreground">
              Operação — Pedidos Aprovados
            </p>

            <form className="space-y-5" onSubmit={enviar}>
              <div className="animate-element animate-delay-300">
                <label
                  htmlFor="codigo-acesso"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Código de acesso
                </label>
                <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-terracotta/70 focus-within:bg-terracotta/10">
                  <div className="relative">
                    <input
                      id="codigo-acesso"
                      name="codigo"
                      type={mostrarCodigo ? "text" : "password"}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      placeholder="Digite seu código"
                      autoFocus
                      required
                      value={codigo}
                      onChange={(e) => setCodigo(somenteDigitos(e.target.value).slice(0, 8))}
                      className="w-full rounded-2xl bg-transparent p-4 px-12 text-center font-mono text-2xl tracking-[0.4em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarCodigo(!mostrarCodigo)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      aria-label={mostrarCodigo ? "Ocultar código" : "Mostrar código"}
                    >
                      {mostrarCodigo ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !codigoAcessoValido(codigo)}
                className="animate-element animate-delay-400 h-12 w-full rounded-2xl bg-charcoal py-4 font-medium text-white transition-colors hover:bg-charcoal/90 disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <button
              type="button"
              onClick={onUsarEmail}
              className="animate-element animate-delay-600 text-sm text-muted-foreground underline-offset-4 hover:text-charcoal hover:underline"
            >
              Entrar com e-mail e senha
            </button>
          </div>
        </div>
      </section>

      {heroImageSrc && (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
        </section>
      )}
    </div>
  );
}
