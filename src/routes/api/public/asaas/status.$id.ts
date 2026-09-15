import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient } from "@/integrations/asaas/client.server";
import { ASAAS_FINAL_DONE, ASAAS_FINAL_PAID } from "@/lib/asaasStatus";
import {
  checkoutAccessDenied,
  verifyPagamentoAccessOrStaff,
} from "@/lib/checkoutAccess.server";
import { syncPedidoPaymentFields } from "@/lib/pedidoSync";
import { PEDIDO_EXPIRADO } from "@/lib/prazoPagamento";
import {
  aplicarPrazoNaConfirmacao,
  expirarPedidoSeVencido,
  lerPrazoPedido,
  type PrazoPedido,
} from "@/lib/prazoPagamento.server";
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
        const pedidoId = row.pedido_id as string;
        const secrets = await getAppSecrets();
        const asaas = secrets.asaasApiKey ? makeAsaasClient(secrets.asaasApiKey as string) : null;

        // Fallback: consulta a API do Asaas diretamente quando o status ainda está pendente.
        // Isso corrige casos em que o webhook não foi entregue.
        if (asaas && !ASAAS_FINAL_DONE.has(currentStatus) && row.asaas_payment_id) {
          try {
            const asaasPayment = await asaas.getPayment(row.asaas_payment_id as string);

            if (asaasPayment.status !== currentStatus) {
              currentStatus = asaasPayment.status;

              await admin
                .from("pagamentos")
                .update({
                  status: currentStatus,
                  raw_response: asaasPayment as unknown as Record<string, unknown>,
                })
                .eq("id", parsed.data);

              if (ASAAS_FINAL_PAID.has(currentStatus)) {
                await aplicarPrazoNaConfirmacao(
                  admin,
                  asaas,
                  pedidoId,
                  row.asaas_payment_id as string,
                  { statusAsaas: currentStatus },
                );
              }
              await syncPedidoPaymentFields(admin, pedidoId);
            }
          } catch (e) {
            console.error("[asaas/status] fallback Asaas poll erro", e);
            // Não falha — retorna o status atual do banco
          }
        }

        let prazo: PrazoPedido | null = null;
        if (!ASAAS_FINAL_PAID.has(currentStatus)) {
          try {
            prazo = await expirarPedidoSeVencido(admin, asaas, pedidoId);
          } catch (e) {
            console.error("[asaas/status] prazo de pagamento", e);
          }
        }
        prazo ??= await lerPrazoPedido(admin, pedidoId);
        const expirado = prazo?.status === PEDIDO_EXPIRADO;

        return Response.json({
          status: currentStatus,
          metodo: row.metodo,
          atualizadoEm: row.atualizado_em,
          pedidoId,
          pago: ASAAS_FINAL_PAID.has(currentStatus) && !expirado,
          expirado,
          prazoExpiraEm: prazo?.expiraEm ?? null,
          agora: new Date().toISOString(),
        });
      },
    },
  },
});
