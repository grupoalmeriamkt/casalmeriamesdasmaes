export type EmailTipo = "pedido_confirmacao" | "cozinha_boas_vindas" | "operacao_boas_vindas" | "teste" | "manual";

export type EmailStatus = "pending" | "sent" | "failed";

export type EmailLog = {
  id: string;
  tipo: EmailTipo;
  pedido_id: string | null;
  destinatario: string;
  assunto: string;
  status: EmailStatus;
  resend_id: string | null;
  erro: string | null;
  metadata: Record<string, unknown>;
  criado_em: string;
  enviado_em: string | null;
};

export const EMAIL_TIPO_LABEL: Record<EmailTipo, string> = {
  pedido_confirmacao: "Confirmação de pedido",
  cozinha_boas_vindas: "Boas-vindas cozinha",
  operacao_boas_vindas: "Boas-vindas operação",
  teste: "Teste",
  manual: "Manual",
};

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
};
