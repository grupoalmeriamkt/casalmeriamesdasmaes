import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isCozinha: boolean;
  canAccessCozinha: boolean;
  loading: boolean;
};

type RoleFlags = {
  isAdmin: boolean;
  isCozinha: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCozinha, setIsCozinha] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentUserId: string | null = null;

    const applyRoles = (roles: RoleFlags) => {
      setIsAdmin(roles.isAdmin);
      setIsCozinha(roles.isCozinha);
    };

    const syncRoles = async (userId: string | null) => {
      if (!userId) {
        applyRoles({ isAdmin: false, isCozinha: false });
        return;
      }
      const roles = await checkRoles(userId);
      if (mounted) applyRoles(roles);
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

  return {
    user,
    session,
    isAdmin,
    isCozinha,
    canAccessCozinha: isAdmin || isCozinha,
    loading,
  };
}

async function checkRoles(userId: string): Promise<RoleFlags> {
  const [adminRes, cozinhaRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "cozinha" }),
  ]);

  if (!adminRes.error && !cozinhaRes.error) {
    return {
      isAdmin: adminRes.data === true,
      isCozinha: cozinhaRes.data === true,
    };
  }

  if (adminRes.error) console.error("Erro ao verificar role admin:", adminRes.error);
  if (cozinhaRes.error) console.error("Erro ao verificar role cozinha:", cozinhaRes.error);

  // Fallback: leitura direta quando a RPC ainda não existe no banco
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("Erro ao ler user_roles:", error);
    return { isAdmin: false, isCozinha: false };
  }

  const roles = (data ?? []).map((row) => String(row.role));
  return {
    isAdmin: roles.includes("admin"),
    isCozinha: roles.includes("cozinha"),
  };
}
