export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #2c2c2c; max-width: 600px; line-height: 1.6; margin: 0 auto;">
      <div style="border-bottom: 2px solid #8b7355; padding-bottom: 12px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: #8b7355;">Casa Almeria</p>
        <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: normal;">${escapeHtml(title)}</h1>
      </div>
      ${bodyHtml}
      <p style="margin-top: 32px; font-size: 13px; color: #888;">
        Grupo Almeria · atendimento@grupoalmeria.com.br
      </p>
    </div>
  `.trim();
}
