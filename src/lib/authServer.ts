import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminClient } from "@/integrations/supabase/client.server";

export async function authenticateRequest(
  request: Request,
): Promise<{ admin: SupabaseClient; user: User } | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = getAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  return { admin, user: data.user };
}

export async function userHasRole(
  admin: SupabaseClient,
  userId: string,
  role: "admin" | "cozinha",
): Promise<boolean> {
  const { data, error } = await admin.rpc("has_role", { _user_id: userId, _role: role });
  if (!error && data === true) return true;
  if (error) console.error(`[authServer] has_role(${role}) error`, error);

  const { data: rows, error: readErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role);

  if (readErr) {
    console.error("[authServer] user_roles read error", readErr);
    return false;
  }

  return (rows?.length ?? 0) > 0;
}

export async function requireAdmin(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return userHasRole(admin, userId, "admin");
}

export async function canAccessCozinha(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const [adminOk, cozinhaOk] = await Promise.all([
    userHasRole(admin, userId, "admin"),
    userHasRole(admin, userId, "cozinha"),
  ]);
  return adminOk || cozinhaOk;
}
