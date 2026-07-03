import { emailLayout, escapeHtml } from "@/lib/emailTemplates/layout";

export type PedidoOperacaoEmailItem = {
  nome: string;
  quantidade: number;
  preco: number;
};

export type PedidoOperacaoEmailData = {
  id: string;
  numero: string;
  criadoEm: string;
  clienteNome: string;
  clienteWhatsapp: string;
  tipo: string;
  dataEntrega: string;
  horario?: string | null;
  endereco: string;
  itens: PedidoOperacaoEmailItem[];
  total: number;
  formaPagamento: string;
  quemPagou: string;
};

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatData(data: string): string {
  const [y, m, d] = data.split("-");
  return d && m && y ? `${d}/${m}/${y}` : data;
}

function labelTipo(tipo: string): string {
  if (tipo === "delivery" || tipo === "entrega") return "Entrega";
  if (tipo === "retirada" || tipo === "pickup") return "Retirada";
  return tipo;
}

function linhaItem(item: PedidoOperacaoEmailItem): string {
  return `<tr>
    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(item.nome)}</td>
    <td style="padding: 8px 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantidade}x</td>
  </tr>`;
}

export function renderPedidoOperacaoEmail(p: PedidoOperacaoEmailData): {
  subject: string;
  html: string;
} {
  const dataEntregaFmt = `${formatData(p.dataEntrega)} (${p.dataEntrega})`;
  const subject = `Novo pedido pago — ${p.clienteNome} (entrega ${p.dataEntrega})`;

  const bodyHtml = `
    <p>Um novo pedido foi <strong>pago e aprovado</strong>. Confira os detalhes para a operação:</p>

    <div style="background: #f8f5f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Pedido</p>
      <p style="margin: 4px 0 0;"><strong>Nº ${escapeHtml(p.numero)}</strong></p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #666;">Comprado em ${escapeHtml(formatDataHora(p.criadoEm))}</p>
    </div>

    <div style="background: #fff6e5; border: 2px solid #8b7355; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-size: 13px; color: #8b7355; text-transform: uppercase; letter-spacing: 0.05em;">Para quando é este pedido</p>
      <p style="margin: 6px 0 0; font-size: 20px;"><strong>${escapeHtml(dataEntregaFmt)}</strong>${
        p.horario ? ` · <strong>${escapeHtml(p.horario)}</strong>` : ""
      }</p>
      <p style="margin: 6px 0 0;">${escapeHtml(labelTipo(p.tipo))} — ${escapeHtml(p.endereco || "—")}</p>
    </div>

    <p style="margin: 16px 0 4px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Cliente</p>
    <p style="margin: 0;"><strong>${escapeHtml(p.clienteNome)}</strong> · ${escapeHtml(p.clienteWhatsapp)}</p>

    <p style="margin: 16px 0 4px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Itens</p>
    <table style="width: 100%; border-collapse: collapse; margin: 4px 0 16px; font-size: 15px;">
      <tbody>${p.itens.map(linhaItem).join("")}</tbody>
    </table>

    <p style="font-size: 18px; margin: 16px 0;"><strong>Total: ${formatBRL(p.total)}</strong></p>

    <p style="margin: 16px 0 4px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Pagamento</p>
    <p style="margin: 0;">Forma: <strong>${escapeHtml(p.formaPagamento)}</strong></p>
    <p style="margin: 4px 0 0;">Pago por: <strong>${escapeHtml(p.quemPagou)}</strong></p>
  `;

  return {
    subject,
    html: emailLayout("Novo pedido pago e aprovado", bodyHtml),
  };
}
