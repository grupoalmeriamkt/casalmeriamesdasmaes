import { supabase } from "@/integrations/supabase/client";

export type ShareToken = {
  token: string;
  scope: string;
  criado_em: string;
};

function gerarToken(): string {
  // 32 chars hex
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listarTokensPedidos(): Promise<ShareToken[]> {
  const { data, error } = await supabase
    .from("share_tokens")
    .select("*")
    .eq("scope", "pedidos")
    .order("criado_em", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as ShareToken[];
}

export async function criarTokenPedidos(): Promise<ShareToken | null> {
  const token = gerarToken();
  const { data, error } = await supabase
    .from("share_tokens")
    .insert({ token, scope: "pedidos" })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data as ShareToken;
}

export async function revogarToken(token: string): Promise<boolean> {
  const { error } = await supabase
    .from("share_tokens")
    .delete()
    .eq("token", token);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

export function urlPublicaPedidos(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pedidos/${token}`;
}
