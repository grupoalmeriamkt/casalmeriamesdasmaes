import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessCozinha } from "@/lib/authServer";

export const Route = createFileRoute("/api/admin/conciliacao-pendencias")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await canAccessCozinha(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

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
