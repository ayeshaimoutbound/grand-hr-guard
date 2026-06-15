// Setup default user accounts (office1 + admin). Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERS = [
  { username: "admin", password: "gssadmin17", full_name: "Administrator", role: "super_admin" },
  { username: "office1", password: "gssoffice26", full_name: "Office Staff", role: "office" },
  { username: "office2", password: "gssoffice26", full_name: "Office Staff 2", role: "office" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: any[] = [];

  for (const u of USERS) {
    const email = `${u.username}@grandsenaro.local`;

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", u.username)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) {
        results.push({ username: u.username, status: "error", error: error.message });
        continue;
      }
      userId = data.user!.id;

      await supabase.from("profiles").insert({
        id: userId,
        username: u.username,
        full_name: u.full_name,
        email,
      });
    } else {
      // Reset the password to ensure it matches
      await supabase.auth.admin.updateUserById(userId, { password: u.password });
    }

    // Ensure role exists
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: u.role });

    results.push({ username: u.username, status: "ok", id: userId });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
