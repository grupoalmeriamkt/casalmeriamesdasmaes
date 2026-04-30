import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const ParamSchema = z.string().uuid();

// Endpoint público para a página de sucesso buscar todos os dados do pagamento
// (incluindo QR Code PIX). Usa service_role pra bypassar RLS — não vaza dados sensíveis
// (não retorna cartao_token, raw_response, asaas_customer_id).
export const Route = createFileRoute("/api/public/pagamento/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = ParamSchema.safeParse(params.id);
        if (!parsed.success) {
          return Response.json({ error: "invalid_id" }, { status: 400 });
        }
        const admin = getAdminClient();
        if (!admin) {
          return Response.json({ error: "db_unavailable" }, { status: 503 });
        }

        const { data, error } = await admin
          .from("pagamentos")
          .select(
            "id, pedido_id, metodo, status, valor, pix_qrcode_payload, pix_qrcode_image, pix_expira_em, cartao_last4, cartao_brand, atualizado_em, criado_em",
          )
          .eq("id", parsed.data)
          .maybeSingle();

        if (error) {
          console.error("[pagamento/$id] erro", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        if (!data) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        return Response.json({ pagamento: data });
      },
    },
  },
});
