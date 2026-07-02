import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const ParamSchema = z.string().uuid();

// Retorna a URL do comprovante de pagamento do Asaas (transactionReceiptUrl) de um pedido.
// A URL já vem guardada no raw_response da linha de pagamentos (gravada pelo webhook na
// confirmação). Whitelist: só devolve as URLs, nada de dados sensíveis.
export const Route = createFileRoute("/api/public/comprovante/$id")({
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
          .select("status, raw_response, criado_em")
          .eq("pedido_id", parsed.data)
          .order("criado_em", { ascending: false });

        if (error) {
          console.error("[comprovante/$id] erro", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }

        // Pega o primeiro pagamento que tenha o comprovante (prioriza os já pagos).
        const pago = new Set(["CONFIRMED", "RECEIVED"]);
        const rows = (data ?? []) as { status: string; raw_response: Record<string, unknown> | null }[];
        const ordenado = [...rows].sort((a, b) => {
          const ap = pago.has(a.status) ? 0 : 1;
          const bp = pago.has(b.status) ? 0 : 1;
          return ap - bp;
        });
        const hit = ordenado.find((r) => (r.raw_response as { transactionReceiptUrl?: string } | null)?.transactionReceiptUrl);
        const raw = (hit?.raw_response ?? {}) as { transactionReceiptUrl?: string; invoiceUrl?: string };

        return Response.json({
          receiptUrl: raw.transactionReceiptUrl ?? null,
          invoiceUrl: raw.invoiceUrl ?? null,
        });
      },
    },
  },
});
