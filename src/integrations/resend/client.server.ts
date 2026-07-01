// SERVIDOR APENAS — NUNCA importar do front.
import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY ausente.");
    return null;
  }
  if (!_client) {
    _client = new Resend(apiKey);
  }
  return _client;
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "atendimento@grupoalmeria.com.br";
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
