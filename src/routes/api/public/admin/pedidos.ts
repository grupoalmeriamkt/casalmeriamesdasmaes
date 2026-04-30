import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/integrations/supabase/client.server";

// Lista pedidos via service_role (bypassa RLS).
// IMPORTANTE: como /admin não tem login, este endpoint é PÚBLICO.
// Quem souber a URL acessa todos os pedidos — incluindo CPF, email, endereço.
// Se quiser proteção, adicione um secret no header e valide aqui.
export const Route = createFileRoute("/api/public/admin/pedidos")({
  server: {
    handlers: {
      GET: async () => {
        const admin = getAdminClient();
        if (!admin) {
          return Response.json({ error: "db_unavailable" }, { status: 503 });
        }
        const { data, error } = await admin
          .from("pedidos")
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(500);
        if (error) {
          console.error("[admin/pedidos] erro", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        return Response.json({ pedidos: data ?? [] });
      },
    },
  },
});
