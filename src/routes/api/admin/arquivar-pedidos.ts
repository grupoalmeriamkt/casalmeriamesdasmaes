import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/integrations/supabase/client.server";

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

export const Route = createFileRoute("/api/admin/arquivar-pedidos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { data, error } = await auth.admin.rpc("arquivar_pedidos_vencidos");
        if (error) {
          console.error("[arquivar-pedidos]", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, arquivados: data ?? 0 });
      },
    },
  },
});
