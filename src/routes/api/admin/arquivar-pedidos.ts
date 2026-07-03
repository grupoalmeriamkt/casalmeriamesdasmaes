import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessCozinha } from "@/lib/authServer";

export const Route = createFileRoute("/api/admin/arquivar-pedidos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await canAccessCozinha(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

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
