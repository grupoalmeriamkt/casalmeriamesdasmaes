import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessCozinha } from "@/lib/authServer";
import { obterOuCriarTokenGeralCozinha } from "@/lib/cozinha.server";

export const Route = createFileRoute("/api/cozinha/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        if (!(await canAccessCozinha(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const token = await obterOuCriarTokenGeralCozinha(auth.admin);
        if (!token) {
          return Response.json({ error: "token_unavailable" }, { status: 503 });
        }

        return Response.json({ token });
      },
    },
  },
});
