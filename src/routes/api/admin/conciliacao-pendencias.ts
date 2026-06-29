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

export const Route = createFileRoute("/api/admin/conciliacao-pendencias")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { data, error } = await auth.admin
          .from("pedidos")
          .select(
            "id, criado_em, cliente_nome, status, payment_status_raw, payment_status_normalized, payment_confirmed_at, conciliacao_pendente, total",
          )
          .eq("conciliacao_pendente", true)
          .order("criado_em", { ascending: false })
          .limit(100);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ pendencias: data ?? [] });
      },
    },
  },
});
