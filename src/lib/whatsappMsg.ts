import type { EnderecoEntrega, Unidade } from "@/lib/types";
import { formatBRL } from "@/store/pedido";

type Args = {
  cliente: { nome: string; whatsapp: string };
  cesta?: { cesta: { nome: string; preco: number }; quantidade: number };
  sobremesas: Record<string, { sobremesa: { nome: string; preco: number }; quantidade: number }>;
  entregaTipo: "delivery" | "retirada" | null;
  endereco?: EnderecoEntrega;
  unidade?: Unidade;
  data?: string;
  horario?: string;
  total: number;
  pedidoId?: string;
};

/** Monta a mensagem do pedido para envio pelo WhatsApp. */
export function montarMensagemWhats(p: Args): string {
  const linhas: string[] = [];
  linhas.push("🌸 *Novo pedido — Casa Almeria*");
  if (p.pedidoId) linhas.push(`Pedido: *${p.pedidoId}*`);
  linhas.push("");
  linhas.push(`*Cliente:* ${p.cliente.nome}`);
  linhas.push(`*WhatsApp:* ${p.cliente.whatsapp}`);
  linhas.push("");

  linhas.push("*Itens:*");
  if (p.cesta) {
    linhas.push(
      `• ${p.cesta.cesta.nome} — ${p.cesta.quantidade}x — ${formatBRL(p.cesta.cesta.preco * p.cesta.quantidade)}`,
    );
  }
  Object.values(p.sobremesas).forEach((s) => {
    linhas.push(
      `• ${s.sobremesa.nome} — ${s.quantidade}x — ${formatBRL(s.sobremesa.preco * s.quantidade)}`,
    );
  });

  linhas.push("");
  if (p.entregaTipo === "delivery" && p.endereco) {
    linhas.push("*Entrega:* Delivery");
    const e = p.endereco;
    linhas.push(
      `*Endereço:* ${e.rua}, ${e.numero}${e.complemento ? `, ${e.complemento}` : ""} — ${e.bairro}, ${e.cidade}-${e.estado}${e.cep ? ` (CEP ${e.cep})` : ""}`,
    );
  } else if (p.entregaTipo === "retirada" && p.unidade) {
    linhas.push("*Entrega:* Retirada");
    linhas.push(`*Unidade:* ${p.unidade.nome}${p.unidade.endereco ? ` — ${p.unidade.endereco}` : ""}`);
  }

  if (p.data || p.horario) {
    linhas.push(`*Data/horário:* ${p.data ?? ""}${p.horario ? ` · ${p.horario}` : ""}`);
  }

  linhas.push("");
  linhas.push(`*Total:* ${formatBRL(p.total)}`);
  return linhas.join("\n");
}

/** Limpa o número (somente dígitos) e garante DDI 55. */
export function normalizarNumeroWhats(numero: string): string {
  const apenasDigitos = numero.replace(/\D/g, "");
  if (!apenasDigitos) return "";
  if (apenasDigitos.startsWith("55")) return apenasDigitos;
  return `55${apenasDigitos}`;
}

/** Monta a URL final wa.me. */
export function montarLinkWhats(numeroDestino: string, mensagem: string): string {
  const num = normalizarNumeroWhats(numeroDestino);
  return `https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`;
}
