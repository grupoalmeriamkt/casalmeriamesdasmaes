import { supabase } from "@/integrations/supabase/client";
import { checkoutAccessHeaders } from "@/lib/checkoutAccess";

export type SituacaoPrazoPagamento = {
  status: string;
  expiraEm: string | null;
  expirado: boolean;
  pago: boolean;
  /** Relógio do servidor, para a contagem não depender do relógio do aparelho. */
  agora: string;
};

/**
 * Inicia (`iniciar: true`) ou confere o cronômetro de pagamento do pedido. Conferir depois
 * do fim do prazo faz o servidor expirar o pedido.
 */
export async function consultarPrazoPagamento(
  pedidoId: string,
  opts: { iniciar?: boolean; headers?: Record<string, string> } = {},
): Promise<SituacaoPrazoPagamento | null> {
  try {
    const res = await fetch(`/api/public/prazo-pagamento/${pedidoId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...checkoutAccessHeaders(pedidoId),
        ...opts.headers,
      },
      body: JSON.stringify({ iniciar: !!opts.iniciar }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SituacaoPrazoPagamento;
  } catch {
    return null;
  }
}

/**
 * Chamado quando a contagem zera. Tenta de novo por alguns segundos caso o servidor ainda
 * não tenha virado o prazo (diferença de relógio/latência).
 */
export async function confirmarFimDoPrazo(
  pedidoId: string,
  opts: { headers?: Record<string, string> } = {},
): Promise<SituacaoPrazoPagamento | null> {
  let situacao: SituacaoPrazoPagamento | null = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    situacao = await consultarPrazoPagamento(pedidoId, opts);
    if (situacao && (situacao.expirado || situacao.pago || !situacao.expiraEm)) return situacao;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return situacao;
}

/** Cabeçalho de sessão da equipe (pedido manual no admin). */
export async function headersEquipe(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
