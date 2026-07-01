import type { PedidoSalvo } from "@/store/admin";
import { formatBRL } from "@/store/pedido";
import { labelTipoPedido } from "@/lib/asaasStatus";
import { emailLayout, escapeHtml } from "@/lib/emailTemplates/layout";

function formatDataEntrega(data?: string, horario?: string): string {
  if (!data) return "A combinar";
  const [y, m, d] = data.split("-");
  const dataFmt = d && m && y ? `${d}/${m}/${y}` : data;
  return horario ? `${dataFmt} às ${horario}` : dataFmt;
}

function linhaItem(nome: string, qtd: number, preco: number): string {
  return `<tr>
    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(nome)}</td>
    <td style="padding: 8px 8px; border-bottom: 1px solid #eee; text-align: center;">${qtd}</td>
    <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatBRL(preco * qtd)}</td>
  </tr>`;
}

export function pedidoConfirmacaoEmail(pedido: PedidoSalvo): {
  subject: string;
  html: string;
  text: string;
} {
  const itens: string[] = [];
  const linhasHtml: string[] = [];

  if (pedido.cesta) {
    itens.push(`${pedido.cesta.quantidade}x ${pedido.cesta.nome} — ${formatBRL(pedido.cesta.preco * pedido.cesta.quantidade)}`);
    linhasHtml.push(linhaItem(pedido.cesta.nome, pedido.cesta.quantidade, pedido.cesta.preco));
  }
  for (const s of pedido.sobremesas ?? []) {
    itens.push(`${s.quantidade}x ${s.nome} — ${formatBRL(s.preco * s.quantidade)}`);
    linhasHtml.push(linhaItem(s.nome, s.quantidade, s.preco));
  }
  const extras = pedido.pagamento?.extras;
  for (const c of extras?.cartoes ?? []) {
    itens.push(`Cartão: ${c.nome} — ${formatBRL(c.preco)}`);
    linhasHtml.push(linhaItem(`Cartão — ${c.nome}`, 1, c.preco));
  }
  for (const p of extras?.polaroids ?? []) {
    itens.push(`Polaroid: ${p.nome} — ${formatBRL(p.preco)}`);
    linhasHtml.push(linhaItem(`Polaroid — ${p.nome}`, 1, p.preco));
  }

  const destinatario = pedido.destinatario;
  const cupom = pedido.pagamento?.cupom;
  const desconto = pedido.pagamento?.desconto;
  const pedidoRef = pedido.id.slice(0, 8).toUpperCase();
  const entrega = formatDataEntrega(pedido.data, pedido.horario);

  const bodyHtml = `
    <p>Olá, <strong>${escapeHtml(pedido.cliente.nome)}</strong>!</p>
    <p>Recebemos seu pedido <strong>#${pedidoRef}</strong> e o pagamento foi confirmado.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
      <thead>
        <tr style="color: #666; font-size: 13px;">
          <th style="text-align: left; padding-bottom: 8px;">Item</th>
          <th style="text-align: center; padding-bottom: 8px;">Qtd</th>
          <th style="text-align: right; padding-bottom: 8px;">Valor</th>
        </tr>
      </thead>
      <tbody>${linhasHtml.join("")}</tbody>
    </table>

    ${cupom && desconto ? `<p style="font-size: 14px;">Cupom <strong>${escapeHtml(cupom)}</strong>: −${formatBRL(desconto)}</p>` : ""}

    <p style="font-size: 18px; margin: 16px 0;"><strong>Total: ${formatBRL(pedido.total)}</strong></p>

    <div style="background: #f8f5f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Entrega / retirada</p>
      <p style="margin: 0;"><strong>${escapeHtml(labelTipoPedido(pedido.tipo))}</strong></p>
      <p style="margin: 4px 0 0;">${escapeHtml(pedido.enderecoOuUnidade || "—")}</p>
      <p style="margin: 8px 0 0;"><strong>Data:</strong> ${escapeHtml(entrega)}</p>
      ${
        destinatario
          ? `<p style="margin: 8px 0 0;"><strong>Presenteado:</strong> ${escapeHtml(destinatario.nome)} · ${escapeHtml(destinatario.whatsapp)}</p>`
          : ""
      }
    </div>

    <p style="font-size: 14px; color: #555;">
      Qualquer dúvida, responda este e-mail ou fale conosco pelo WhatsApp informado no site.
    </p>
  `;

  const text = [
    `Olá, ${pedido.cliente.nome}!`,
    "",
    `Pedido #${pedidoRef} confirmado.`,
    "",
    "Itens:",
    ...itens.map((i) => `- ${i}`),
    "",
    `Total: ${formatBRL(pedido.total)}`,
    "",
    `${labelTipoPedido(pedido.tipo)}: ${pedido.enderecoOuUnidade || "—"}`,
    `Data: ${entrega}`,
    destinatario ? `Presenteado: ${destinatario.nome} · ${destinatario.whatsapp}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: `Pedido confirmado #${pedidoRef} — Casa Almeria`,
    html: emailLayout("Seu pedido foi confirmado", bodyHtml),
    text,
  };
}
