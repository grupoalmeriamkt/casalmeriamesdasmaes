import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { conciliarPagamentosAsaas } from "@/integrations/asaas/reconcile.server";

// Rede de segurança agendada: reconcilia pagamentos sem depender de alguém abrir o
// painel. O Vercel Cron chama com header "Authorization: Bearer <CRON_SECRET>".
export const Route = createFileRoute("/api/cron/conciliar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return Response.json({ error: "cron_not_configured" }, { status: 503 });
        }
        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("forbidden", { status: 403 });
        }

        const admin = getAdminClient();
        if (!admin) return new Response("db unavailable", { status: 503 });

        const { asaasApiKey } = await getAppSecrets();
        if (!asaasApiKey) {
          return Response.json({ error: "asaas_not_configured" }, { status: 503 });
        }

        try {
          const resultado = await conciliarPagamentosAsaas(admin, asaasApiKey);
          return Response.json({ ok: true, ...resultado });
        } catch (e) {
          console.error("[cron/conciliar] erro", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "reconcile_failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
