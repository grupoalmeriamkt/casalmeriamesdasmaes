import { usePedido, formatBRL, selectTotal } from "@/store/pedido";
import { useAdmin } from "@/store/admin";
import { Logo } from "@/components/Logo";

export function Sucesso({ onVoltar }: { onVoltar: () => void }) {
  const cliente = usePedido((s) => s.cliente);
  const cesta = usePedido((s) => s.cesta);
  const data = usePedido((s) => s.data);
  const horario = usePedido((s) => s.horario);
  const entregaTipo = usePedido((s) => s.entregaTipo);
  const endereco = usePedido((s) => s.endereco);
  const unidade = usePedido((s) => s.unidade);
  const total = usePedido(selectTotal);
  const wppNumero = useAdmin((s) => s.textos.whatsapp);

  const msgWa = encodeURIComponent(
    `Olá! Acabei de enviar meu pedido no Casa Almeria 🌸 ${cesta?.cesta.nome ?? ""}`,
  );

  return (
    <div className="flex min-h-screen flex-col bg-charcoal">
      <header className="bg-charcoal/40 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <Logo variant="light" />
          <span className="badge-mae">🌸 Dia das Mães</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="text-6xl animate-heart">🌸</div>

        <h1 className="mt-5 font-serif text-3xl font-bold text-white sm:text-4xl">
          Pedido <em className="italic text-terracotta">enviado!</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Obrigado, <strong className="text-white">{cliente.nome.split(" ")[0]}</strong>!
          Seu pedido foi enviado pelo WhatsApp. Vamos confirmar todos os detalhes
          e o pagamento por lá.
        </p>

        <div className="mt-6 w-full rounded-2xl bg-white/10 p-4 text-left text-sm text-white/80 backdrop-blur-sm">
          {cesta && (
            <p className="flex gap-2 py-1.5">
              📦 <strong className="text-white">{cesta.cesta.nome}</strong>
            </p>
          )}
          <p className="flex gap-2 py-1.5">
            📅 <strong className="text-white">{data} · {horario}</strong>
          </p>
          <p className="flex gap-2 py-1.5">
            📍{" "}
            <strong className="text-white">
              {entregaTipo === "delivery" && endereco
                ? `${endereco.rua}, ${endereco.numero} — ${endereco.cidade}`
                : `Retirada — ${unidade?.nome ?? ""}`}
            </strong>
          </p>
          <p className="flex gap-2 py-1.5">
            💰 <strong className="text-terracotta">{formatBRL(total)}</strong>
          </p>
        </div>

        <a
          href={`https://wa.me/${wppNumero}?text=${msgWa}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.885l6.162-1.617A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.007-1.371l-.36-.214-3.655.958.975-3.564-.235-.367A9.818 9.818 0 1112 21.818z" />
          </svg>
          Falar no WhatsApp
        </a>
        <button
          onClick={onVoltar}
          className="mt-3 text-xs text-white/60 underline-offset-4 hover:text-terracotta hover:underline"
        >
          Voltar ao início
        </button>
      </main>
    </div>
  );
}
