import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, canAccessPedidosToken } from "@/lib/authServer";

const PEDIDOS_SELECT = `
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
    invoice_url,
    pix_expira_em,
    criado_em
  )
`;

export const Route = createFileRoute("/api/operacao/pedidos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim();
        if (!token) {
          return Response.json({ error: "token_required" }, { status: 400 });
        }

        if (!(await canAccessPedidosToken(auth.admin, auth.user.id, token))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const { data: share, error: shareErr } = await auth.admin
          .from("share_tokens")
          .select("token, campanha_id, senha")
          .eq("token", token)
          .eq("scope", "pedidos")
          .maybeSingle();

        if (shareErr) {
          console.error("[operacao/pedidos] share_tokens error", shareErr);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        if (!share) {
          return Response.json({ error: "token_not_found" }, { status: 404 });
        }

        let query = auth.admin
          .from("pedidos")
          .select(PEDIDOS_SELECT)
          .order("criado_em", { ascending: false })
          .limit(500);

        if (share.campanha_id) {
          query = query.eq("campanha_id", share.campanha_id);
        }

        const { data, error } = await query;
        if (error) {
          console.error("[operacao/pedidos] pedidos error", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }

        return Response.json({ pedidos: data ?? [] });
      },
    },
  },
});
