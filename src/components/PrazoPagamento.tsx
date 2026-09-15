import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarContagem, MSG_PRAZO_EXPIRADO, segundosRestantes } from "@/lib/prazoPagamento";

/**
 * Segundos até o fim do prazo, corrigidos pela diferença entre o relógio do aparelho e o
 * do servidor (`agoraServidor`). Chama `onEsgotar` uma vez quando a contagem zera.
 */
export function useContagemPrazo(
  expiraEm: string | null | undefined,
  agoraServidor: string | null | undefined,
  onEsgotar?: () => void,
): number | null {
  const offset = useMemo(() => {
    const t = agoraServidor ? new Date(agoraServidor).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t - Date.now();
  }, [agoraServidor]);
  const [agora, setAgora] = useState(() => Date.now());
  const onEsgotarRef = useRef(onEsgotar);
  onEsgotarRef.current = onEsgotar;
  const disparadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!expiraEm) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [expiraEm]);

  const segundos = expiraEm ? segundosRestantes(expiraEm, new Date(agora + offset)) : null;

  useEffect(() => {
    if (segundos === 0 && expiraEm && disparadoPara.current !== expiraEm) {
      disparadoPara.current = expiraEm;
      onEsgotarRef.current?.();
    }
  }, [segundos, expiraEm]);

  return segundos;
}

export function ContagemPrazo({
  segundos,
  className = "",
}: {
  segundos: number | null;
  className?: string;
}) {
  if (segundos === null) return null;
  const urgente = segundos <= 30;
  return (
    <div
      role="timer"
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ${
        urgente
          ? "bg-terracotta/10 text-terracotta ring-terracotta/30"
          : "bg-linen text-charcoal ring-border"
      } ${className}`}
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Clock className="h-4 w-4" /> Tempo para pagar
      </span>
      <span className="font-mono text-xl font-bold tabular-nums">{formatarContagem(segundos)}</span>
    </div>
  );
}

export function PrazoEsgotado({
  onNovoPedido,
  textoBotao = "Montar novo pedido",
  descricao = MSG_PRAZO_EXPIRADO,
}: {
  onNovoPedido?: () => void;
  textoBotao?: string;
  descricao?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-border">
      <TimerOff className="mx-auto h-10 w-10 text-terracotta" />
      <h2 className="mt-3 font-serif text-2xl font-bold text-charcoal">Tempo esgotado</h2>
      <p className="mt-2 text-sm text-charcoal/70">{descricao}</p>
      {onNovoPedido && (
        <Button
          type="button"
          onClick={onNovoPedido}
          className="mt-4 bg-terracotta text-white hover:bg-terracotta/90"
        >
          {textoBotao}
        </Button>
      )}
    </div>
  );
}
