import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";

// Lista pedidos via service_role (bypassa RLS) com dados do Asaas via JOIN.
export const Route = createFileRoute("/api/public/admin/pedidos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        // Junta pedidos com pagamentos. Cada pedido pode ter N pagamentos (tentativas);
        // pegamos todos e o front escolhe o mais recente / relevante.
        const { data, error } = await auth.admin
          .from("pedidos")
          .select(
            `
            *,
            operador:operators ( id, name, short_name ),
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
              invoice_url,
              pix_expira_em,
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
