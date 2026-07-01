import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { obterOuCriarTokenGeralCozinha } from "@/lib/cozinha.server";
import { dispatchEmail } from "@/lib/emailDispatch.server";
import { cozinhaWelcomeEmail } from "@/lib/emailTemplates/cozinhaWelcome";

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("criar"),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  z.object({
    action: z.literal("remover"),
    userId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("alterar_senha"),
    userId: z.string().uuid(),
    password: z.string().min(8),
  }),
]);

export const Route = createFileRoute("/api/admin/cozinha-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const { data, error } = await auth.admin.rpc("listar_usuarios_cozinha");
        if (error) {
          console.warn("[cozinha-users] list RPC fallback", error.message);
          const { data: rows, error: readErr } = await auth.admin
            .from("user_roles")
            .select("user_id, created_at, role")
            .eq("role", "cozinha")
            .order("created_at", { ascending: false });
          if (readErr) {
            console.error("[cozinha-users] list error", readErr);
            return Response.json({ error: readErr.message }, { status: 500 });
          }
          const users = await Promise.all(
            (rows ?? []).map(async (row) => {
              const { data: userData } = await auth.admin.auth.admin.getUserById(row.user_id);
              return {
                user_id: row.user_id,
                email: userData.user?.email ?? "",
                created_at: row.created_at,
              };
            }),
          );
          return Response.json({ users });
        }
        return Response.json({ users: data ?? [] });
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

        if (parsed.data.action === "criar") {
          const { email, password } = parsed.data;

          const { data: created, error: createErr } = await auth.admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (createErr || !created.user) {
            console.error("[cozinha-users] create error", createErr);
            return Response.json(
              { error: createErr?.message ?? "create_failed" },
              { status: 400 },
            );
          }

          const { data: roleRow, error: roleErr } = await auth.admin
            .from("user_roles")
            .insert({
              user_id: created.user.id,
              role: "cozinha",
            })
            .select("created_at")
            .single();
          if (roleErr) {
            console.error("[cozinha-users] role insert error", roleErr);
            await auth.admin.auth.admin.deleteUser(created.user.id);
            return Response.json({ error: roleErr.message }, { status: 500 });
          }

          const portalToken = await obterOuCriarTokenGeralCozinha(auth.admin);
          if (!portalToken) {
            console.warn("[cozinha-users] token geral indisponível após criar usuário");
          }

          let emailSent = false;
          if (created.user.email) {
            const origin =
              request.headers.get("origin") ??
              process.env.PUBLIC_SITE_URL ??
              (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:8080");
            const portalUrl = `${origin.replace(/\/$/, "")}/cozinha`;
            const welcome = cozinhaWelcomeEmail({
              email: created.user.email,
              password,
              portalUrl,
            });
            const mail = await dispatchEmail(auth.admin, {
              tipo: "cozinha_boas_vindas",
              to: created.user.email,
              subject: welcome.subject,
              html: welcome.html,
              text: welcome.text,
              metadata: { html: welcome.html, text: welcome.text, portal_url: portalUrl },
            });
            emailSent = mail.ok;
            if (!mail.ok) {
              console.warn("[cozinha-users] welcome email failed", mail.error);
            }
          }

          return Response.json({
            ok: true,
            emailSent,
            user: {
              user_id: created.user.id,
              email: created.user.email,
              created_at: roleRow?.created_at ?? new Date().toISOString(),
            },
          });
        }

        if (parsed.data.action === "alterar_senha") {
          const { userId, password } = parsed.data;

          const { data: roleRow, error: roleErr } = await auth.admin
            .from("user_roles")
            .select("user_id")
            .eq("user_id", userId)
            .eq("role", "cozinha")
            .maybeSingle();
          if (roleErr || !roleRow) {
            return Response.json({ error: "usuario_nao_encontrado" }, { status: 404 });
          }

          const { error: updateErr } = await auth.admin.auth.admin.updateUserById(userId, {
            password,
          });
          if (updateErr) {
            console.error("[cozinha-users] update password error", updateErr);
            return Response.json({ error: updateErr.message }, { status: 400 });
          }

          return Response.json({ ok: true });
        }

        const { userId } = parsed.data;
        const { error: delRoleErr } = await auth.admin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "cozinha");
        if (delRoleErr) {
          console.error("[cozinha-users] remove role error", delRoleErr);
          return Response.json({ error: delRoleErr.message }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
