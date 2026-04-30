import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentUserId: string | null = null;

    // 1. Set up listener BEFORE getting session (evita race condition)
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      // Ignora eventos que apenas renovam token / hidratam sessão inicial:
      // eles disparam periodicamente (a cada ~1h) e ao focar a aba, e estavam
      // causando re-render do painel inteiro.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return;
      }
      const nextId = sess?.user?.id ?? null;
      if (nextId === currentUserId) {
        // Mesmo usuário — não dispara setState desnecessário.
        return;
      }
      currentUserId = nextId;
      setSession(sess);
      setUser(sess?.user ?? null);
      // Defer role check to avoid recursion within the auth callback
      if (sess?.user) {
        setTimeout(() => {
          checkAdmin(sess.user.id).then((ok) => {
            if (mounted) setIsAdmin(ok);
          });
        }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    // 2. Then get current session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!mounted) return;
      currentUserId = sess?.user?.id ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        checkAdmin(sess.user.id).then((ok) => {
          if (mounted) {
            setIsAdmin(ok);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, session, isAdmin, loading };
}

async function checkAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) {
    console.error("Erro ao verificar role admin:", error);
    return false;
  }
  return data === true;
}
