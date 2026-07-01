import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { reenviarEmailLog } from "@/lib/emailDispatch.server";

const PostSchema = z.object({
  action: z.literal("reenviar"),
  logId: z.string().uuid(),
});

export const Route = createFileRoute("/api/admin/email-logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const tipo = url.searchParams.get("tipo");
        const busca = url.searchParams.get("q")?.trim();
        const limite = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

        let query = auth.admin
          .from("email_logs")
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(limite);

        if (status && status !== "todos") {
          query = query.eq("status", status);
        }
        if (tipo && tipo !== "todos") {
          query = query.eq("tipo", tipo);
        }
        if (busca) {
          query = query.or(`destinatario.ilike.%${busca}%,assunto.ilike.%${busca}%`);
        }

        const { data, error } = await query;
        if (error) {
          console.error("[email-logs] list", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        const logs = data ?? [];
        const stats = {
          total: logs.length,
          enviados: logs.filter((l) => l.status === "sent").length,
          falhas: logs.filter((l) => l.status === "failed").length,
          pendentes: logs.filter((l) => l.status === "pending").length,
        };

        return Response.json({ logs, stats });
      },

      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400 });
        }

        const parsed = PostSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const result = await reenviarEmailLog(auth.admin, parsed.data.logId);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 400 });
        }
        return Response.json({ ok: true, logId: result.logId, resendId: result.resendId });
      },
    },
  },
});
