-- Logs de e-mails transacionais (Resend) + monitoramento no admin

CREATE TABLE IF NOT EXISTS public.email_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text        NOT NULL CHECK (
    tipo IN ('pedido_confirmacao', 'cozinha_boas_vindas', 'teste', 'manual')
  ),
  pedido_id     uuid        REFERENCES public.pedidos(id) ON DELETE SET NULL,
  destinatario  text        NOT NULL,
  assunto       text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  resend_id     text,
  erro          text,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_logs_criado_em ON public.email_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_logs_tipo ON public.email_logs (tipo);
CREATE INDEX IF NOT EXISTS idx_email_logs_pedido_id ON public.email_logs (pedido_id) WHERE pedido_id IS NOT NULL;

-- Evita reenvio duplicado de confirmação de pedido
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_pedido_confirmacao_sent
  ON public.email_logs (pedido_id)
  WHERE tipo = 'pedido_confirmacao' AND status = 'sent' AND pedido_id IS NOT NULL;

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_admin_all" ON public.email_logs;
CREATE POLICY "email_logs_admin_all" ON public.email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );
