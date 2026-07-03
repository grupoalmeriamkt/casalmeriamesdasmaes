import { getAdminClient } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email";
import {
  renderPedidoOperacaoEmail,
  type PedidoOperacaoEmailData,
  type PedidoOperacaoEmailItem,
} from "@/lib/emailTemplates/pedidoOperacao";

const OPS_EMAILS = [
  "juliana.oliveira@grupoalmeria.com.br",
  "chef.casanoro@grupoalmeria.com.br",
  "gerente.casanoro@grupoalmeria.com.br",
];

type PedidoOperacaoRow = {
  id: string;
  criado_em: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  cesta: { nome: string; quantidade: number; preco: number } | null;
  sobremesas: { nome: string; quantidade: number; preco: number }[] | null;
  tipo: string;
  endereco_ou_unidade: string;
  data_entrega: string | null;
  horario: string | null;
  pagamento: {
    metodo?: string;
    status?: string;
    extras?: {
      pos?: { nome?: string; bandeira?: string; tipo?: string };
    };
  } | null;
  total: number;
  ops_notificado_em: string | null;
};

function labelFormaPagamento(metodo?: string): string {
  switch (metodo) {
    case "dinheiro":
      return "Dinheiro";
    case "pos":
      return "Cartão (maquininha)";
    case "PIX":
    case "pix":
      return "Pix";
    case "CREDIT_CARD":
      return "Cartão de crédito";
    case "BOLETO":
      return "Boleto";
    default:
      return metodo || "Não informado";
  }
}

function mapPedidoParaEmail(row: PedidoOperacaoRow): PedidoOperacaoEmailData {
  const itens: PedidoOperacaoEmailItem[] = [];
  if (row.cesta) {
    itens.push({ nome: row.cesta.nome, quantidade: row.cesta.quantidade, preco: row.cesta.preco });
  }
  for (const s of row.sobremesas ?? []) {
    itens.push({ nome: s.nome, quantidade: s.quantidade, preco: s.preco });
  }

  const pagamento = row.pagamento ?? {};
  const quemPagou = pagamento.extras?.pos?.nome || row.cliente_nome;

  return {
    id: row.id,
    numero: row.id.slice(0, 8).toUpperCase(),
    criadoEm: row.criado_em,
    clienteNome: row.cliente_nome,
    clienteWhatsapp: row.cliente_whatsapp,
    tipo: row.tipo,
    dataEntrega: row.data_entrega ?? "A combinar",
    horario: row.horario,
    endereco: row.endereco_ou_unidade,
    itens,
    total: Number(row.total ?? 0),
    formaPagamento: labelFormaPagamento(pagamento.metodo),
    quemPagou,
  };
}

export async function notificarOpsPedidoPago(pedidoId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  const { data: row, error } = await admin
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .maybeSingle();

  if (error) {
    console.error("[opsNotify] erro ao ler pedido", error);
    return;
  }
  if (!row) return;

  const pedido = row as PedidoOperacaoRow;
  if (pedido.ops_notificado_em) return; // dedupe: já notificado

  const { subject, html } = renderPedidoOperacaoEmail(mapPedidoParaEmail(pedido));

  const result = await sendEmail({ to: OPS_EMAILS, subject, html });
  if (!result.ok) {
    console.error("[opsNotify] falha ao enviar e-mail de operação", result.error);
    return;
  }

  const { error: updateError } = await admin
    .from("pedidos")
    .update({ ops_notificado_em: new Date().toISOString() })
    .eq("id", pedidoId);
  if (updateError) {
    console.error("[opsNotify] falha ao marcar ops_notificado_em", updateError);
  }
}
