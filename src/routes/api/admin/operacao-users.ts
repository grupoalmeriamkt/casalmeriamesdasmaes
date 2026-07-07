import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, requireAdmin } from "@/lib/authServer";
import { obterTokenPortalOperacao, grantOperacaoAccess } from "@/lib/operacao.server";
import { dispatchEmail } from "@/lib/emailDispatch.server";
import { operacaoWelcomeEmail } from "@/lib/emailTemplates/operacaoWelcome";

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
  z.object({
    action: z.literal("atualizar_token"),
    shareToken: z.string().trim().min(16).max(128),
  }),
]);

export const Route = createFileRoute("/api/admin/operacao-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!(await requireAdmin(auth.admin, auth.user.id))) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const { data, error } = await auth.admin.rpc("listar_usuarios_operacao");
        if (error) {
          console.warn("[operacao-users] list RPC fallback", error.message);
          const { data: rows, error: readErr } = await auth.admin
            .from("user_roles")
            .select("user_id, created_at, role")
            .eq("role", "operacao")
            .order("created_at", { ascending: false });
          if (readErr) {
            console.error("[operacao-users] list error", readErr);
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

        if (parsed.data.action === "atualizar_token") {
          const { shareToken } = parsed.data;
          const { data: share, error: shareErr } = await auth.admin
            .from("share_tokens")
            .select("token")
            .eq("token", shareToken)
            .eq("scope", "pedidos")
            .maybeSingle();
          if (shareErr || !share) {
            return Response.json({ error: "token_invalido" }, { status: 400 });
          }

          const { error } = await auth.admin
            .from("operacao_portal")
            .upsert({
              id: 1,
              share_token: shareToken,
              atualizado_em: new Date().toISOString(),
            });
          if (error) {
            console.error("[operacao-users] update token error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ ok: true });
        }

        if (parsed.data.action === "criar") {
          const { email, password } = parsed.data;

          const granted = await grantOperacaoAccess(auth.admin, { email, password });
          if (!granted.ok) {
            const desc =
              granted.error === "usuario_existe_mas_nao_encontrado"
                ? "O e-mail já existe no sistema, mas não foi possível localizar o usuário. Tente novamente."
                : granted.error;
            return Response.json({ error: desc }, { status: 400 });
          }

          const portalToken = await obterTokenPortalOperacao(auth.admin);
          if (!portalToken) {
            console.warn("[operacao-users] token portal indisponível após criar usuário");
          }

          let emailSent = false;
          if (!granted.alreadyHadAccess && granted.userEmail) {
            const origin =
              request.headers.get("origin") ??
              process.env.PUBLIC_SITE_URL ??
              (process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:8080");
            const portalUrl = `${origin.replace(/\/$/, "")}/operacao`;
            const welcome = operacaoWelcomeEmail({
              email: granted.userEmail,
              password,
              portalUrl,
            });
            const mail = await dispatchEmail(auth.admin, {
              tipo: "operacao_boas_vindas",
              to: granted.userEmail,
              subject: welcome.subject,
              html: welcome.html,
              text: welcome.text,
              metadata: { html: welcome.html, text: welcome.text, portal_url: portalUrl },
            });
            emailSent = mail.ok;
            if (!mail.ok) {
              console.warn("[operacao-users] welcome email failed", mail.error);
            }
          }

          return Response.json({
            ok: true,
            emailSent,
            alreadyHadAccess: granted.alreadyHadAccess,
            linkedExistingUser: !granted.createdNew,
            user: {
              user_id: granted.userId,
              email: granted.userEmail,
              created_at: granted.createdAt,
            },
          });
        }

        if (parsed.data.action === "alterar_senha") {
          const { userId, password } = parsed.data;

          const { data: roleRow, error: roleErr } = await auth.admin
            .from("user_roles")
            .select("user_id")
            .eq("user_id", userId)
            .eq("role", "operacao")
            .maybeSingle();
          if (roleErr || !roleRow) {
            return Response.json({ error: "usuario_nao_encontrado" }, { status: 404 });
          }

          const { error: updateErr } = await auth.admin.auth.admin.updateUserById(userId, {
            password,
          });
          if (updateErr) {
            console.error("[operacao-users] update password error", updateErr);
            return Response.json({ error: updateErr.message }, { status: 400 });
          }

          return Response.json({ ok: true });
        }

        const { userId } = parsed.data;
        const { error: delRoleErr } = await auth.admin
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "operacao");
        if (delRoleErr) {
          console.error("[operacao-users] remove role error", delRoleErr);
          return Response.json({ error: delRoleErr.message }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
