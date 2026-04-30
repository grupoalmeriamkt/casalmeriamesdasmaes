import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const ParamSchema = z.string().uuid();

export const Route = createFileRoute("/api/public/asaas/status/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = ParamSchema.safeParse(params.id);
        if (!parsed.success) {
          return Response.json({ error: "invalid_id" }, { status: 400 });
        }
        const admin = getAdminClient();
        if (!admin) return Response.json({ error: "db" }, { status: 503 });

        const { data, error } = await admin.rpc("pagamento_status", {
          _pagamento_id: parsed.data,
        });
        if (error) {
          console.error("[asaas/status] rpc", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        const row = (data ?? [])[0] as
          | { status: string; metodo: string; atualizado_em: string; pedido_id: string }
          | undefined;
        if (!row) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json({
          status: row.status,
          metodo: row.metodo,
          atualizadoEm: row.atualizado_em,
          pedidoId: row.pedido_id,
          pago: row.status === "CONFIRMED" || row.status === "RECEIVED",
        });
      },
    },
  },
});
