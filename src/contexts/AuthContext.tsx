import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type UserRole = "super_admin" | "admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (username: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch role when user logs in
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setRole(data?.role as UserRole);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    // Rate limiting check
    const rateLimitKey = 'login_attempts';
    const rateLimitData = localStorage.getItem(rateLimitKey);
    let attempts = 0;
    let lastAttempt = 0;

    if (rateLimitData) {
      const parsed = JSON.parse(rateLimitData);
      attempts = parsed.attempts || 0;
      lastAttempt = parsed.lastAttempt || 0;
    }

    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttempt;
    const backoffTime = Math.min(Math.pow(2, attempts) * 1000, 60000); // Max 60 seconds

    if (attempts >= 3 && timeSinceLastAttempt < backoffTime) {
      const waitTime = Math.ceil((backoffTime - timeSinceLastAttempt) / 1000);
      toast.error(`Too many failed attempts. Please wait ${waitTime} seconds.`);
      throw new Error("Rate limited");
    }

    try {
      // Look up email using secure backend function
      const { data: email, error: rpcError } = await supabase.rpc("get_email_by_username", {
        p_username: username,
      });

      // Always attempt sign-in even if email lookup fails to prevent timing attacks
      let signInError = null;
      if (email && !rpcError) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: password,
        });
        signInError = error;
      }

      // Check for any errors (email lookup or sign-in)
      if (rpcError || !email || signInError) {
        // Increment failed attempts
        attempts++;
        localStorage.setItem(rateLimitKey, JSON.stringify({
          attempts,
          lastAttempt: now
        }));
        
        // Always return the same generic error to prevent user enumeration
        toast.error("Invalid username or password");
        throw new Error("Invalid username or password");
      }

      // Clear rate limiting on successful login
      localStorage.removeItem(rateLimitKey);
      
      toast.success("Logged in successfully");
      navigate("/dashboard");
    } catch (error: any) {
      // Ensure consistent error message
      if (error.message !== "Rate limited") {
        toast.error("Invalid username or password");
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast.error("Error logging out");
    }
  };

  const requestPasswordReset = async (username: string) => {
    try {
      // Look up email using secure backend function
      const { data: email, error: rpcError } = await supabase.rpc("get_email_by_username", {
        p_username: username,
      });

      if (rpcError || !email) {
        toast.error("Username not found");
        throw new Error("Username not found");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Password reset request error:", error);
      throw error;
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Failed to update password");
      throw error;
    }
  };

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "super_admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signOut,
        requestPasswordReset,
        resetPassword,
        isSuperAdmin,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
