import { formatBRL } from "@/store/pedido";

/** Link do WhatsApp com mensagem pronta. Aceita telefone com ou sem DDI. */
export function linkWhatsApp(telefone: string, mensagem: string): string {
  const num = telefone.replace(/\D/g, "");
  const comDdi = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}

/** Mensagem da operação para retomar um pedido que ficou sem pagamento. */
export function mensagemRecuperacaoPedido(p: {
  nome: string;
  pedidoId: string;
  total: number;
}): string {
  const primeiroNome = p.nome.trim().split(/\s+/)[0];
  const saudacao = primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!";
  return [
    `${saudacao} Aqui é da Casa Almeria.`,
    `Vi que o seu pedido #${p.pedidoId.slice(0, 8).toUpperCase()} de ${formatBRL(p.total)} ficou sem confirmação de pagamento.`,
    "Posso te ajudar a finalizar?",
  ].join(" ");
}

/** "há 40 min", "há 3 h", "há 2 dias" — idade do pedido para priorizar o contato. */
export function resumoTempoDesde(iso: string, agora: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const minutos = Math.max(0, Math.floor((agora.getTime() - t) / 60_000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/**
 * Janela da lista de recuperação. Sem ela a lista cresceria sem fim: a operação só vê
 * e chama no WhatsApp, não tem como dispensar um pedido antigo que ninguém vai retomar.
 */
export const DIAS_LISTA_RECUPERACAO = 14;

export function dentroDaJanelaRecuperacao(
  criadoEm: string,
  agora: Date = new Date(),
  dias: number = DIAS_LISTA_RECUPERACAO,
): boolean {
  const t = new Date(criadoEm).getTime();
  if (Number.isNaN(t)) return false;
  return agora.getTime() - t <= dias * 24 * 3600_000;
}
