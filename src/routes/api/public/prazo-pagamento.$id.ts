import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { makeAsaasClient } from "@/integrations/asaas/client.server";
import { checkoutAccessDenied, verifyPedidoAccessOrStaff } from "@/lib/checkoutAccess.server";
import { expirarPedidoSeVencido, iniciarPrazoPagamento } from "@/lib/prazoPagamento.server";
import { rateLimit } from "@/lib/rateLimit.server";

const ParamSchema = z.string().uuid();
const BodySchema = z.object({ iniciar: z.boolean().optional() });

// Cronômetro de pagamento. `iniciar: true` grava o prazo (uma vez por pedido). Sempre
// confere o prazo: se acabou, expira o pedido e cancela as cobranças abertas no Asaas.
export const Route = createFileRoute("/api/public/prazo-pagamento/$id")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const limited = rateLimit(request, "public/prazo-pagamento", {
          max: 60,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const parsed = ParamSchema.safeParse(params.id);
        if (!parsed.success) {
          return Response.json({ error: "invalid_id" }, { status: 400 });
        }

        let body: z.infer<typeof BodySchema> = {};
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          /* corpo vazio = só consulta */
        }

        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db_unavailable" }, { status: 503 });

        if (!(await verifyPedidoAccessOrStaff(request, admin, parsed.data))) {
          return checkoutAccessDenied();
        }

        if (body.iniciar) await iniciarPrazoPagamento(admin, parsed.data);

        const { asaasApiKey } = await getAppSecrets();
        const asaas = asaasApiKey ? makeAsaasClient(asaasApiKey as string) : null;
        const situacao = await expirarPedidoSeVencido(admin, asaas, parsed.data);
        if (!situacao) return Response.json({ error: "not_found" }, { status: 404 });

        return Response.json({ ...situacao, agora: new Date().toISOString() });
      },
    },
  },
});
