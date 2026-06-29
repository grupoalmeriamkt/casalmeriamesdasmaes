import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getAppSecrets } from "@/integrations/supabase/client.server";
import { conciliarPagamentosAsaas } from "@/integrations/asaas/reconcile.server";

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { admin, user: data.user };
}

export const Route = createFileRoute("/api/admin/conciliar-asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

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
