export function cozinhaWelcomeEmail(params: {
  email: string;
  password: string;
  portalUrl: string;
}): { subject: string; html: string; text: string } {
  const { email, password, portalUrl } = params;

  return {
    subject: "Acesso ao módulo Cozinha — Casa Almeria",
    html: `
      <div style="font-family: Georgia, serif; color: #2c2c2c; max-width: 560px; line-height: 1.6;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Bem-vindo(a) à central de pedidos</h1>
        <p>Sua conta de acesso ao <strong>módulo Cozinha</strong> da Casa Almeria foi criada.</p>
        <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Senha:</strong> ${password}</p>
        <p style="margin-top: 24px; font-size: 14px; color: #666;">
          Por segurança, altere sua senha após o primeiro acesso, se possível.
        </p>
      </div>
    `.trim(),
    text: [
      "Bem-vindo(a) à central de pedidos da Casa Almeria.",
      "",
      `Portal: ${portalUrl}`,
      `E-mail: ${email}`,
      `Senha: ${password}`,
    ].join("\n"),
  };
}
