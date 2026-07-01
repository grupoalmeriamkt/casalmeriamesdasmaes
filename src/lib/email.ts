import { getResendClient, getResendFromEmail } from "@/integrations/resend/client.server";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: "resend_not_configured" };
  }

  const { data, error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) {
    console.error("[email] send error", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id ?? "" };
}

export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "Teste — Casa Almeria",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    text: "Congrats on sending your first email!",
  });
}
