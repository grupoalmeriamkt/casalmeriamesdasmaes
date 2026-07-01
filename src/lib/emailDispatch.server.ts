import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import type { EmailTipo } from "@/lib/emailTypes";
import { rowToPedidoSalvo, type PedidoRow } from "@/lib/pedidos";
import { pedidoConfirmacaoEmail } from "@/lib/emailTemplates/pedidoConfirmacao";

export type DispatchEmailInput = {
  tipo: EmailTipo;
  to: string;
  subject: string;
  html: string;
  text?: string;
  pedidoId?: string;
  metadata?: Record<string, unknown>;
};

export type DispatchEmailResult =
  | { ok: true; logId: string; resendId: string }
  | { ok: false; logId?: string; error: string };

export async function dispatchEmail(
  admin: SupabaseClient,
  input: DispatchEmailInput,
): Promise<DispatchEmailResult> {
  const { data: logRow, error: insertErr } = await admin
    .from("email_logs")
    .insert({
      tipo: input.tipo,
      pedido_id: input.pedidoId ?? null,
      destinatario: input.to,
      assunto: input.subject,
      status: "pending",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertErr || !logRow) {
    console.error("[emailDispatch] insert log", insertErr);
    return { ok: false, error: insertErr?.message ?? "log_insert_failed" };
  }

  const result = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (!result.ok) {
    await admin
      .from("email_logs")
      .update({ status: "failed", erro: result.error })
      .eq("id", logRow.id);
    return { ok: false, logId: logRow.id, error: result.error };
  }

  await admin
    .from("email_logs")
    .update({
      status: "sent",
      resend_id: result.id,
      enviado_em: new Date().toISOString(),
      erro: null,
    })
    .eq("id", logRow.id);

  return { ok: true, logId: logRow.id, resendId: result.id };
}

export async function jaEnviouConfirmacaoPedido(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("email_logs")
    .select("id")
    .eq("pedido_id", pedidoId)
    .eq("tipo", "pedido_confirmacao")
    .eq("status", "sent")
    .maybeSingle();
  return Boolean(data);
}

export async function enviarConfirmacaoPedido(
  admin: SupabaseClient,
  pedidoId: string,
): Promise<DispatchEmailResult | { ok: true; skipped: true; reason: string }> {
  if (await jaEnviouConfirmacaoPedido(admin, pedidoId)) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const { data: row, error } = await admin
    .from("pedidos")
    .select(
      `
      id, criado_em, cliente_nome, cliente_whatsapp, cliente_email,
      cesta, sobremesas, tipo, endereco_ou_unidade, data_entrega, horario,
      pagamento, total, status,
      recipient_name, recipient_phone, recipient_is_buyer,
      is_test, archived_at,
      pagamentos ( id, status, metodo, valor, cupom_codigo, cupom_desconto, criado_em )
    `,
    )
    .eq("id", pedidoId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: error?.message ?? "pedido_not_found" };
  }

  const pedidoRow = row as PedidoRow;
  if (pedidoRow.is_test) {
    return { ok: true, skipped: true, reason: "test_order" };
  }

  const email = pedidoRow.cliente_email?.trim();
  if (!email) {
    return { ok: true, skipped: true, reason: "no_email" };
  }

  const pedido = rowToPedidoSalvo(pedidoRow);
  const template = pedidoConfirmacaoEmail(pedido);

  return dispatchEmail(admin, {
    tipo: "pedido_confirmacao",
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    pedidoId,
    metadata: { pedido_ref: pedido.id.slice(0, 8) },
  });
}

export async function reenviarEmailLog(
  admin: SupabaseClient,
  logId: string,
): Promise<DispatchEmailResult> {
  const { data: log, error } = await admin
    .from("email_logs")
    .select("*")
    .eq("id", logId)
    .maybeSingle();

  if (error || !log) {
    return { ok: false, error: error?.message ?? "log_not_found" };
  }

  if (log.tipo === "pedido_confirmacao" && log.pedido_id) {
    return enviarConfirmacaoPedido(admin, log.pedido_id) as Promise<DispatchEmailResult>;
  }

  const metadata = (log.metadata ?? {}) as { html?: string; text?: string };
  if (!metadata.html) {
    return { ok: false, error: "retry_not_supported" };
  }

  return dispatchEmail(admin, {
    tipo: log.tipo as EmailTipo,
    to: log.destinatario,
    subject: log.assunto,
    html: metadata.html,
    text: metadata.text,
    pedidoId: log.pedido_id ?? undefined,
    metadata: log.metadata as Record<string, unknown>,
  });
}
