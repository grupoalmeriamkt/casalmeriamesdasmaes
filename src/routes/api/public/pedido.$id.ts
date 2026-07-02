import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/integrations/supabase/client.server";

const ParamSchema = z.string().uuid();

type ItemJson = { nome?: string; quantidade?: number; preco?: number } | null;

/** Mascara o CPF deixando só os 2 últimos dígitos: "***.***.***-45". */
function maskCpf(cpf: string | null | undefined): string | null {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.***.***-${d.slice(-2)}`;
}

// Endpoint público para o checkout transparente (/pagar/$id) buscar o pedido.
// service_role bypassa RLS. Whitelist explícito — NÃO retorna o CPF completo
// (só um hint mascarado); o cliente digita o próprio CPF no formulário.
export const Route = createFileRoute("/api/public/pedido/$id")({
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
          .from("pedidos")
          .select(
            "id, status, cliente_nome, cliente_whatsapp, cliente_email, cliente_cpf, cesta, sobremesas, total",
          )
          .eq("id", parsed.data)
          .maybeSingle();

        if (error) {
          console.error("[pedido/$id] erro", error);
          return Response.json({ error: "db_error" }, { status: 500 });
        }
        if (!data) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }

        // Gating: refresh-safe / evita recobrança
        if (data.status === "pago") {
          return Response.json({ error: "ja_pago" }, { status: 409 });
        }
        if (data.status === "cancelado") {
          return Response.json({ error: "cancelado" }, { status: 410 });
        }

        const cesta = data.cesta as ItemJson;
        const sobremesas = (data.sobremesas as ItemJson[] | null) ?? [];
        const itens = [
          ...(cesta?.nome
            ? [{ nome: cesta.nome, quantidade: cesta.quantidade ?? 1, preco: Number(cesta.preco ?? 0) }]
            : []),
          ...sobremesas
            .filter((s): s is NonNullable<ItemJson> => !!s?.nome)
            .map((s) => ({ nome: s.nome!, quantidade: s.quantidade ?? 1, preco: Number(s.preco ?? 0) })),
        ];

        return Response.json({
          pedido: {
            id: data.id,
            status: data.status,
            cliente_nome: data.cliente_nome,
            cliente_whatsapp: data.cliente_whatsapp,
            cliente_email: data.cliente_email,
            cpf_hint: maskCpf(data.cliente_cpf),
            itens,
            total: Number(data.total ?? 0),
          },
        });
      },
    },
  },
});
