import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateRequest, canAccessCozinha } from "@/lib/authServer";

const ACCESS_HEADER = "x-checkout-access";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Lê o token de acesso do checkout (header ou query `access`). */
export function readCheckoutAccessToken(request: Request): string | null {
  const header = request.headers.get(ACCESS_HEADER)?.trim();
  if (header) return header;
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("access")?.trim();
    return q || null;
  } catch {
    return null;
  }
}

/** Valida o token de acesso contra o pedido no banco. */
export async function verifyPedidoAccess(
  admin: SupabaseClient,
  pedidoId: string,
  token: string | null,
): Promise<boolean> {
  if (!token || token.length < 32) return false;
  const { data, error } = await admin
    .from("pedidos")
    .select("access_token")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error || !data?.access_token) return false;
  return safeEqual(token, data.access_token);
}

/** Valida acesso ao pedido via token de checkout OU sessão cozinha/admin. */
export async function verifyPedidoAccessOrStaff(
  request: Request,
  admin: SupabaseClient,
  pedidoId: string,
): Promise<boolean> {
  const access = readCheckoutAccessToken(request);
  if (await verifyPedidoAccess(admin, pedidoId, access)) return true;

  const auth = await authenticateRequest(request);
  if (!auth) return false;
  return canAccessCozinha(auth.admin, auth.user.id);
}

/** Valida acesso a um pagamento via token do pedido vinculado ou sessão staff. */
export async function verifyPagamentoAccessOrStaff(
  request: Request,
  admin: SupabaseClient,
  pagamentoId: string,
): Promise<{ ok: true; pedidoId: string } | { ok: false }> {
  const { data, error } = await admin
    .from("pagamentos")
    .select("pedido_id")
    .eq("id", pagamentoId)
    .maybeSingle();
  if (error || !data?.pedido_id) return { ok: false };

  const pedidoId = data.pedido_id as string;
  const allowed = await verifyPedidoAccessOrStaff(request, admin, pedidoId);
  return allowed ? { ok: true, pedidoId } : { ok: false };
}

export function checkoutAccessDenied(): Response {
  return Response.json({ error: "access_denied" }, { status: 403 });
}
