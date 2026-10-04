import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AuthPage from "@/pages/AuthPage";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef4f8]">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#102f45] text-white shadow-lg">
            <span className="text-lg font-extrabold">G</span>
          </div>
          <div className="text-sm font-semibold text-[#102f45]">GcBtp</div>
          <div className="mt-1 text-xs text-[#71808a]">Vérification de votre session…</div>
        </div>
      </div>
    );
  }

  return session ? <>{children}</> : <AuthPage />;
}
