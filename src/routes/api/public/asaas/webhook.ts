import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import type { AsaasWebhookEvent } from "@/integrations/asaas/types";

const FINAL_PAID = new Set(["CONFIRMED", "RECEIVED"]);
const FINAL_FAILED = new Set([
  "REFUNDED",
  "REFUND_REQUESTED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "PAYMENT_DELETED",
]);

function pedidoStatusFromAsaas(status: string): string {
  if (FINAL_PAID.has(status)) return "pago";
  if (status === "OVERDUE") return "vencido";
  if (FINAL_FAILED.has(status)) return "cancelado";
  return "aguardando_pagamento";
}

export const Route = createFileRoute("/api/public/asaas/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secrets = await getAppSecrets();
        if (!secrets.asaasWebhookToken) {
          console.error("[asaas/webhook] webhook token não configurado");
          return new Response("not configured", { status: 503 });
        }

        const headerToken = request.headers.get("asaas-access-token");
        if (headerToken !== secrets.asaasWebhookToken) {
          console.warn("[asaas/webhook] token invalido");
          return new Response("forbidden", { status: 403 });
        }

        let event: AsaasWebhookEvent;
        try {
          event = (await request.json()) as AsaasWebhookEvent;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        if (!event?.payment?.id || !event.event) {
          return new Response("invalid payload", { status: 400 });
        }

        const admin = getAdminClient();
        if (!admin) return new Response("db unavailable", { status: 503 });

        // Idempotência: insere o evento. Se asaas_event_id duplicar, ignora.
        const eventId = event.id ?? `${event.event}:${event.payment.id}:${event.payment.status}`;
        const { error: insErr } = await admin.from("asaas_webhook_events").insert({
          asaas_event_id: eventId,
          event: event.event,
          payment_id: event.payment.id,
          payload: event as unknown as Record<string, unknown>,
        });
        if (insErr) {
          // 23505 = unique violation → replay; respondemos 200 sem reprocessar.
          if ((insErr as { code?: string }).code === "23505") {
            return Response.json({ ok: true, duplicate: true });
          }
          console.error("[asaas/webhook] insert event erro", insErr);
          return new Response("db error", { status: 500 });
        }

        try {
          const newStatus = event.payment.status;

          const { data: pagamento, error: payErr } = await admin
            .from("pagamentos")
            .update({
              status: newStatus,
              raw_response: event.payment as unknown as Record<string, unknown>,
            })
            .eq("asaas_payment_id", event.payment.id)
            .select("id, pedido_id, cupom_codigo, status")
            .maybeSingle();
          if (payErr) {
            console.error("[asaas/webhook] update pagamentos", payErr);
          }

          if (pagamento?.pedido_id) {
            const novoStatusPedido = pedidoStatusFromAsaas(newStatus);
            await admin
              .from("pedidos")
              .update({
                status: novoStatusPedido,
                pagamento: {
                  status: newStatus,
                  asaas_payment_id: event.payment.id,
                  pagamento_id: pagamento.id,
                },
              })
              .eq("id", pagamento.pedido_id);

            // Incrementa uso do cupom apenas na primeira confirmação
            if (
              pagamento.cupom_codigo &&
              FINAL_PAID.has(newStatus) &&
              !FINAL_PAID.has(pagamento.status ?? "")
            ) {
              await admin.rpc("incrementar_uso_cupom", {
                _codigo: pagamento.cupom_codigo,
              });
            }
          }

          await admin
            .from("asaas_webhook_events")
            .update({ processado: true, processado_em: new Date().toISOString() })
            .eq("asaas_event_id", eventId);

          return Response.json({ ok: true });
        } catch (e) {
          console.error("[asaas/webhook] erro processamento", e);
          await admin
            .from("asaas_webhook_events")
            .update({ erro: String(e).slice(0, 500) })
            .eq("asaas_event_id", eventId);
          return new Response("processing error", { status: 500 });
        }
      },
    },
  },
});
