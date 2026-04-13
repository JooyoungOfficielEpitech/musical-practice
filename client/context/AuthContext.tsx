import React, { createContext, useState, useEffect, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // On React Native, Supabase's autoRefreshToken relies on timers that can be
    // suspended when the app goes to background.  Explicitly pause/resume token
    // refresh based on AppState so the session never expires while backgrounded
    // and immediately re-checks validity when the user returns to the app.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        supabase!.auth.startAutoRefresh();
      } else {
        supabase!.auth.stopAutoRefresh();
      }
    };

    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
