import { useCallback, useEffect, useState } from "react";
import { AdminSection } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, RefreshCw, RotateCcw } from "lucide-react";
import { listarEmailLogs, reenviarEmail } from "@/lib/emailLogs";
import {
  EMAIL_STATUS_LABEL,
  EMAIL_TIPO_LABEL,
  type EmailLog,
  type EmailStatus,
  type EmailTipo,
} from "@/lib/emailTypes";

const TIPOS: Array<"" | EmailTipo> = [
  "",
  "pedido_confirmacao",
  "cozinha_boas_vindas",
  "teste",
  "manual",
];

const STATUSES: Array<"" | EmailStatus> = ["", "sent", "failed", "pending"];

function statusClass(status: EmailStatus): string {
  if (status === "sent") return "bg-emerald-100 text-emerald-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
}

export function AbaEmails() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState({ total: 0, enviados: 0, falhas: 0, pendentes: 0 });
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"" | EmailStatus>("");
  const [filtroTipo, setFiltroTipo] = useState<"" | EmailTipo>("");
  const [busca, setBusca] = useState("");
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await listarEmailLogs({
        status: filtroStatus || undefined,
        tipo: filtroTipo || undefined,
        q: busca.trim() || undefined,
      });
      setLogs(data.logs);
      setStats(data.stats);
    } catch (e) {
      toast.error("Erro ao carregar envios", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroTipo, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleReenviar = async (log: EmailLog) => {
    setReenviandoId(log.id);
    try {
      await reenviarEmail(log.id);
      toast.success("E-mail reenviado!");
      await carregar();
    } catch (e) {
      toast.error("Falha ao reenviar", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setReenviandoId(null);
    }
  };

  return (
    <AdminSection
      title="E-mails transacionais"
      icon={<Mail className="h-5 w-5" />}
      description="Monitore os envios automáticos (confirmação de pedido, cozinha, testes) via Resend."
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-charcoal/10 px-3 py-1 text-sm font-bold text-charcoal">
          {stats.total} listados
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
          {stats.enviados} enviados
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
          {stats.falhas} falhas
        </span>
        {stats.pendentes > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            {stats.pendentes} pendentes
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            placeholder="E-mail, assunto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as "" | EmailTipo)}
          >
            <option value="">Todos</option>
            {TIPOS.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {EMAIL_TIPO_LABEL[t as EmailTipo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "" | EmailStatus)}
          >
            <option value="">Todos</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {EMAIL_STATUS_LABEL[s as EmailStatus]}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`mr-1 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {carregando ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando envios…</p>
        ) : logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum envio registrado ainda. Confirmações de pedido aparecem aqui após o pagamento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-linen/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Assunto</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(log.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">{EMAIL_TIPO_LABEL[log.tipo]}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{log.destinatario}</td>
                    <td className="px-4 py-3 max-w-[220px] truncate" title={log.assunto}>
                      {log.assunto}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {log.pedido_id ? log.pedido_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(log.status)}`}
                      >
                        {EMAIL_STATUS_LABEL[log.status]}
                      </span>
                      {log.erro && (
                        <p className="mt-1 max-w-[200px] truncate text-xs text-red-600" title={log.erro}>
                          {log.erro}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reenviandoId === log.id}
                          onClick={() => handleReenviar(log)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          {reenviandoId === log.id ? "…" : "Reenviar"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
