import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient } from "@/integrations/asaas/client.server";
import {
  ASAAS_FINAL_DONE,
  ASAAS_FINAL_PAID,
  pedidoStatusFromAsaas,
} from "@/lib/asaasStatus";
import {
  checkoutAccessDenied,
  verifyPagamentoAccessOrStaff,
} from "@/lib/checkoutAccess.server";
import { rateLimit } from "@/lib/rateLimit.server";

const ParamSchema = z.string().uuid();

export const Route = createFileRoute("/api/public/asaas/status/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const limited = rateLimit(request, "public/asaas/status", { max: 120, windowMs: 60_000 });
        if (limited) return limited;

        const parsed = ParamSchema.safeParse(params.id);
        if (!parsed.success) {
          return Response.json({ error: "invalid_id" }, { status: 400 });
        }
        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db" }, { status: 503 });

        const access = await verifyPagamentoAccessOrStaff(request, admin, parsed.data);
        if (!access.ok) return checkoutAccessDenied();

        const { data: row, error } = await admin
          .from("pagamentos")
          .select("id, asaas_payment_id, status, metodo, atualizado_em, pedido_id")
          .eq("id", parsed.data)
          .maybeSingle();

        if (error) {
          console.error("[asaas/status] db", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        if (!row) return Response.json({ error: "not_found" }, { status: 404 });

        let currentStatus = row.status as string;

        // Fallback: consulta a API do Asaas diretamente quando o status ainda está pendente.
        // Isso corrige casos em que o webhook não foi entregue.
        if (!ASAAS_FINAL_DONE.has(currentStatus) && row.asaas_payment_id) {
          try {
            const secrets = await getAppSecrets();
            if (secrets.asaasApiKey) {
              const asaas = makeAsaasClient(secrets.asaasApiKey as string);
              const asaasPayment = await asaas.getPayment(row.asaas_payment_id as string);

              if (asaasPayment.status !== currentStatus) {
                currentStatus = asaasPayment.status;
                const novoStatusPedido = pedidoStatusFromAsaas(currentStatus);

                await admin
                  .from("pagamentos")
                  .update({
                    status: currentStatus,
                    raw_response: asaasPayment as unknown as Record<string, unknown>,
                  })
                  .eq("id", parsed.data);

                const { data: pedidoRow } = await admin
                  .from("pedidos")
                  .select("pagamento")
                  .eq("id", row.pedido_id as string)
                  .maybeSingle();

                const existingPag =
                  (pedidoRow?.pagamento as Record<string, unknown>) ?? {};

                await admin
                  .from("pedidos")
                  .update({
                    status: novoStatusPedido,
                    pagamento: {
                      ...existingPag,
                      status: currentStatus,
                      asaas_payment_id: row.asaas_payment_id,
                      pagamento_id: row.id,
                    },
                  })
                  .eq("id", row.pedido_id as string);
              }
            }
          } catch (e) {
            console.error("[asaas/status] fallback Asaas poll erro", e);
            // Não falha — retorna o status atual do banco
          }
        }

        return Response.json({
          status: currentStatus,
          metodo: row.metodo,
          atualizadoEm: row.atualizado_em,
          pedidoId: row.pedido_id,
          pago: ASAAS_FINAL_PAID.has(currentStatus),
        });
      },
    },
  },
});
