-- Conta principal do painel administrativo
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) LIKE '%grupocalmeria.mkt%'
ON CONFLICT (user_id, role) DO NOTHING;

-- Usuário autenticado pode ler a própria role (evita bloqueio antes da RPC has_role)
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
