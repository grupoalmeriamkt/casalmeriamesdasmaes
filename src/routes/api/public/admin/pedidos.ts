import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/integrations/supabase/client.server";

// Lista pedidos via service_role (bypassa RLS) com dados do Asaas via JOIN.
// IMPORTANTE: /admin é público — quem souber a URL acessa pedidos com PII.
export const Route = createFileRoute("/api/public/admin/pedidos")({
  server: {
    handlers: {
      GET: async () => {
        const admin = getAdminClient();
        if (!admin) {
          return Response.json({ error: "db_unavailable" }, { status: 503 });
        }
        // Junta pedidos com pagamentos. Cada pedido pode ter N pagamentos (tentativas);
        // pegamos todos e o front escolhe o mais recente / relevante.
        const { data, error } = await admin
          .from("pedidos")
          .select(
            `
            *,
            pagamentos (
              id,
              asaas_payment_id,
              metodo,
              status,
              valor,
              cupom_codigo,
              cupom_desconto,
              cartao_brand,
              cartao_last4,
              criado_em
            )
          `,
          )
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
