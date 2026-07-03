import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessCozinha } from "@/lib/authServer";
import { getAppSecrets } from "@/integrations/supabase/client.server";
import { conciliarPagamentosAsaas } from "@/integrations/asaas/reconcile.server";

export const Route = createFileRoute("/api/admin/conciliar-asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await canAccessCozinha(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const secrets = await getAppSecrets();
        if (!secrets.asaasApiKey) {
          return Response.json({ error: "asaas_not_configured" }, { status: 503 });
        }

        try {
          const resultado = await conciliarPagamentosAsaas(auth.admin, secrets.asaasApiKey);
          return Response.json({ ok: true, ...resultado });
        } catch (e) {
          console.error("[conciliar-asaas] erro", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "reconcile_failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
