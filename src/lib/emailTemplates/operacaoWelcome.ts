export function operacaoWelcomeEmail(params: {
  email: string;
  password: string;
  portalUrl: string;
}): { subject: string; html: string; text: string } {
  const { email, password, portalUrl } = params;

  return {
    subject: "Acesso à Operação — Casa Almeria",
    html: `
      <div style="font-family: Georgia, serif; color: #2c2c2c; max-width: 560px; line-height: 1.6;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Bem-vindo(a) à operação de pedidos</h1>
        <p>Sua conta de acesso à <strong>central restrita de pedidos</strong> da Casa Almeria foi criada.</p>
        <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Senha:</strong> ${password}</p>
        <p style="margin-top: 24px; font-size: 14px; color: #666;">
          Você verá somente pedidos aprovados e poderá concluí-los ou criar novos pedidos.
        </p>
      </div>
    `.trim(),
    text: [
      "Bem-vindo(a) à operação de pedidos da Casa Almeria.",
      "",
      `Portal: ${portalUrl}`,
      `E-mail: ${email}`,
      `Senha: ${password}`,
    ].join("\n"),
  };
}
