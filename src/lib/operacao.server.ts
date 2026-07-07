import type { SupabaseClient } from "@supabase/supabase-js";
import { getOperacaoPortalToken } from "@/lib/authServer";

export async function obterTokenPortalOperacao(
  admin: SupabaseClient,
): Promise<string | null> {
  return getOperacaoPortalToken(admin);
}

export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[operacao.server] listUsers error", error);
      return null;
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

function isEmailAlreadyRegisteredError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already registered")
  );
}

export async function grantOperacaoAccess(
  admin: SupabaseClient,
  params: { email: string; password: string },
): Promise<
  | { ok: true; userId: string; userEmail: string; createdNew: boolean; alreadyHadAccess: boolean; createdAt: string }
  | { ok: false; error: string }
> {
  const email = params.email.trim();
  const { password } = params;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId: string;
  let userEmail: string;
  let createdNew = false;

  if (createErr || !created.user) {
    if (!isEmailAlreadyRegisteredError(createErr?.message)) {
      return { ok: false, error: createErr?.message ?? "create_failed" };
    }

    const existing = await findAuthUserByEmail(admin, email);
    if (!existing) {
      return { ok: false, error: "usuario_existe_mas_nao_encontrado" };
    }

    userId = existing.id;
    userEmail = existing.email ?? email;

    const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, { password });
    if (pwdErr) {
      console.warn("[operacao.server] password update on existing user", pwdErr);
      return { ok: false, error: pwdErr.message };
    }
  } else {
    userId = created.user.id;
    userEmail = created.user.email ?? email;
    createdNew = true;
  }

  const { data: existingRole, error: roleReadErr } = await admin
    .from("user_roles")
    .select("created_at")
    .eq("user_id", userId)
    .eq("role", "operacao")
    .maybeSingle();

  if (roleReadErr) {
    console.error("[operacao.server] role read error", roleReadErr);
    if (createdNew) await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: roleReadErr.message };
  }

  if (existingRole) {
    return {
      ok: true,
      userId,
      userEmail,
      createdNew: false,
      alreadyHadAccess: true,
      createdAt: existingRole.created_at,
    };
  }

  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "operacao" })
    .select("created_at")
    .single();

  if (roleErr) {
    console.error("[operacao.server] role insert error", roleErr);
    if (createdNew) await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: roleErr.message };
  }

  return {
    ok: true,
    userId,
    userEmail,
    createdNew,
    alreadyHadAccess: false,
    createdAt: roleRow?.created_at ?? new Date().toISOString(),
  };
}
