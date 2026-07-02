import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { ensureOperator } from "@/lib/operatorsServer";

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto") }),
  z.object({
    action: z.literal("atualizar"),
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    short_name: z.string().nullable().optional(),
    role_title: z.string().nullable().optional(),
    internal_key: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("definir_ativo"),
    id: z.string().uuid(),
    is_active: z.boolean(),
  }),
]);

export const Route = createFileRoute("/api/admin/operators")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        const { data, error } = await auth.admin
          .from("operators")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) {
          console.error("[operators] list error", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ operators: data ?? [] });
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
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        if (parsed.data.action === "auto") {
          const op = await ensureOperator(auth.admin, auth.user.id, {
            name: (auth.user.user_metadata?.name as string) ?? auth.user.email ?? "Operador",
            email: auth.user.email ?? null,
          });
          if (!op) return Response.json({ error: "ensure_failed" }, { status: 500 });
          return Response.json({ operator: op });
        }

        if (parsed.data.action === "atualizar") {
          const { id } = parsed.data;
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(parsed.data)) {
            if (k === "action" || k === "id") continue;
            if (v !== undefined) patch[k] = v;
          }
          if (Object.keys(patch).length === 0) {
            return Response.json({ error: "nenhum_campo" }, { status: 400 });
          }
          const { error } = await auth.admin.from("operators").update(patch).eq("id", id);
          if (error) {
            console.error("[operators] atualizar error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        const { id, is_active } = parsed.data;
        const { error } = await auth.admin.from("operators").update({ is_active }).eq("id", id);
        if (error) {
          console.error("[operators] definir_ativo error", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
