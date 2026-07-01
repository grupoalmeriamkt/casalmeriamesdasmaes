import { supabase } from "@/integrations/supabase/client";
import type { EmailLog } from "@/lib/emailTypes";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  return { Authorization: `Bearer ${token}` };
}

export type EmailLogsStats = {
  total: number;
  enviados: number;
  falhas: number;
  pendentes: number;
};

export async function listarEmailLogs(params?: {
  status?: string;
  tipo?: string;
  q?: string;
}): Promise<{ logs: EmailLog[]; stats: EmailLogsStats }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.tipo) qs.set("tipo", params.tipo);
  if (params?.q) qs.set("q", params.q);

  const headers = await authHeaders();
  const res = await fetch(`/api/admin/email-logs?${qs.toString()}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro ao listar e-mails");
  return json as { logs: EmailLog[]; stats: EmailLogsStats };
}

export async function reenviarEmail(logId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch("/api/admin/email-logs", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reenviar", logId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro ao reenviar");
}
