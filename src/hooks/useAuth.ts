import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { obterTokenPortalOperacao } from "@/lib/operacao";

type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isCozinha: boolean;
  isOperacao: boolean;
  canAccessCozinha: boolean;
  canAccessPedidos: boolean;
  /** Usuário operação restrita (sem admin/cozinha). */
  isModoOperacaoRestrita: boolean;
  operacaoToken: string | null;
  loading: boolean;
};

type RoleFlags = {
  isAdmin: boolean;
  isCozinha: boolean;
  isOperacao: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCozinha, setIsCozinha] = useState(false);
  const [isOperacao, setIsOperacao] = useState(false);
  const [operacaoToken, setOperacaoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentUserId: string | null = null;

    const applyRoles = (roles: RoleFlags) => {
      setIsAdmin(roles.isAdmin);
      setIsCozinha(roles.isCozinha);
      setIsOperacao(roles.isOperacao);
    };

    const syncOperacaoToken = async (roles: RoleFlags) => {
      if (!roles.isOperacao && !roles.isAdmin) {
        if (mounted) setOperacaoToken(null);
        return;
      }
      const token = await obterTokenPortalOperacao();
      if (mounted) setOperacaoToken(token);
    };

    const syncRoles = async (userId: string | null) => {
      if (!userId) {
        applyRoles({ isAdmin: false, isCozinha: false, isOperacao: false });
        if (mounted) setOperacaoToken(null);
        return;
      }
      const roles = await checkRoles(userId);
      if (mounted) applyRoles(roles);
      await syncOperacaoToken(roles);
    };

    const handleSession = async (sess: Session | null, fromInitial = false) => {
      const nextId = sess?.user?.id ?? null;
      if (!fromInitial && nextId === currentUserId) return;

      currentUserId = nextId;
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        setLoading(true);
        await syncRoles(sess.user.id);
      } else {
        await syncRoles(null);
      }

      if (mounted) setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return;
      }
      void handleSession(sess);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!mounted) return;
      void handleSession(sess, true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const canAccessCozinha = isAdmin || isCozinha;
  const canAccessPedidos = canAccessCozinha || isOperacao;
  const isModoOperacaoRestrita = isOperacao && !isAdmin && !isCozinha;

  return {
    user,
    session,
    isAdmin,
    isCozinha,
    isOperacao,
    canAccessCozinha,
    canAccessPedidos,
    isModoOperacaoRestrita,
    operacaoToken,
    loading,
  };
}

async function checkRoles(userId: string): Promise<RoleFlags> {
  const [adminRes, cozinhaRes, operacaoRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "cozinha" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "operacao" }),
  ]);

  if (!adminRes.error && !cozinhaRes.error && !operacaoRes.error) {
    return {
      isAdmin: adminRes.data === true,
      isCozinha: cozinhaRes.data === true,
      isOperacao: operacaoRes.data === true,
    };
  }

  if (adminRes.error) console.error("Erro ao verificar role admin:", adminRes.error);
  if (cozinhaRes.error) console.error("Erro ao verificar role cozinha:", cozinhaRes.error);
  if (operacaoRes.error) console.error("Erro ao verificar role operacao:", operacaoRes.error);

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao ler user_roles:", error);
    return { isAdmin: false, isCozinha: false, isOperacao: false };
  }

  const roles = (data ?? []).map((row) => String(row.role));
  return {
    isAdmin: roles.includes("admin"),
    isCozinha: roles.includes("cozinha"),
    isOperacao: roles.includes("operacao"),
  };
}
