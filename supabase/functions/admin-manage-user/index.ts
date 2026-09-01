import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', user.id).single();
    if (!roleData || roleData.role !== 'super_admin') return json({ error: 'Super admin only' }, 403);

    const body = await req.json();
    const action = body.action as string;

    if (action === 'create') {
      const { username, password, full_name, role } = body;
      if (!username || !password) return json({ error: 'username and password required' }, 400);
      const uname = String(username).trim().toLowerCase();
      const email = `${uname}@grandsenaro.local`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { username: uname, full_name: full_name || null },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const uid = created.user!.id;
      const { error: profErr } = await admin
        .from('profiles')
        .upsert({ id: uid, username: uname, email, full_name: full_name || null } as any);
      if (profErr) {
        await admin.auth.admin.deleteUser(uid);
        return json({ error: `Could not create profile: ${profErr.message}` }, 400);
      }
      await admin.from('user_roles').upsert({ user_id: uid, role: role || 'office' } as any);
      return json({ success: true, user_id: uid });
    }


    if (action === 'reset_password') {
      const { userId, password } = body;
      if (!userId || !password) return json({ error: 'userId and password required' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'userId required' }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('admin-manage-user error:', e);
    return json({ error: e.message || 'Internal error' }, 500);
  }
});
