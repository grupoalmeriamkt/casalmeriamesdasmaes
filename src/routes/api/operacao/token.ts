import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessPedidos } from "@/lib/authServer";
import { obterTokenPortalOperacao } from "@/lib/operacao.server";

export const Route = createFileRoute("/api/operacao/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await canAccessPedidos(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const token = await obterTokenPortalOperacao(auth.admin);
        if (!token) {
          return Response.json({ error: "token_unavailable" }, { status: 404 });
        }

        return Response.json({ token });
      },
    },
  },
});
