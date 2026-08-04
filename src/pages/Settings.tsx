import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Plus, Trash2, KeyRound, Settings as SettingsIcon, Users } from "lucide-react";
import BackupSection from "@/components/BackupSection";

const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "employees", label: "Employees" },
  { key: "companies", label: "Companies" },
  { key: "attendance", label: "Attendance" },
  { key: "salaries", label: "Salaries" },
  { key: "invoices", label: "Invoices" },
  { key: "accounts", label: "Accounts" },
  { key: "inventory", label: "Inventory" },
];

interface UserRow {
  user_id: string;
  username: string;
  full_name: string | null;
  role: string;
}

export default function Settings() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [access, setAccess] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<UserRow | null>(null);

  const [createForm, setCreateForm] = useState({ username: "", password: "", full_name: "", role: "office" });
  const [newPw, setNewPw] = useState("");

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, username, full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const rolesMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    const list: UserRow[] = (profiles || []).map((p: any) => ({
      user_id: p.id,
      username: p.username,
      full_name: p.full_name,
      role: rolesMap.get(p.id) || "office",
    })).sort((a, b) => a.username.localeCompare(b.username));
    setUsers(list);

    const { data: acc } = await supabase.from("user_module_access").select("user_id, module_key, enabled");
    const map: Record<string, Record<string, boolean>> = {};
    (acc || []).forEach((a: any) => {
      map[a.user_id] ??= {};
      map[a.user_id][a.module_key] = a.enabled;
    });
    setAccess(map);
    if (!selectedUser && list.length) setSelectedUser(list[0].user_id);
  };
  useEffect(() => { load(); }, []);

  const toggleModule = async (userId: string, moduleKey: string, enabled: boolean) => {
    setAccess((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), [moduleKey]: enabled } }));
    const { error } = await supabase.from("user_module_access")
      .upsert({ user_id: userId, module_key: moduleKey, enabled } as any, { onConflict: "user_id,module_key" });
    if (error) toast.error(error.message);
  };

  const createUser = async () => {
    if (!createForm.username || !createForm.password) { toast.error("Username and password required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "create", ...createForm },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any).error);
      toast.success("User created");
      setCreateOpen(false);
      setCreateForm({ username: "", password: "", full_name: "", role: "office" });
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (!pwOpen || !newPw) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reset_password", userId: pwOpen.user_id, password: newPw },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any).error);
      toast.success("Password updated");
      setPwOpen(null); setNewPw("");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const deleteUser = async (row: UserRow) => {
    if (row.username === "admin") { toast.error("Cannot delete the primary admin"); return; }
    if (!confirm(`Delete user "${row.username}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "delete", userId: row.user_id },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any).error);
      toast.success("User deleted");
      if (selectedUser === row.user_id) setSelectedUser(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const changeRole = async (row: UserRow, role: string) => {
    const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", row.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated"); load();
  };

  const selected = users.find((u) => u.user_id === selectedUser);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7" /> Settings</h1>
        <p className="text-muted-foreground">Admin control panel — user management and module access</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
          <TabsTrigger value="access">Module Access</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="mt-4">
          <BackupSection />
        </TabsContent>


        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Users</CardTitle>
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create User</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-mono">{u.username}</TableCell>
                      <TableCell>{u.full_name || "—"}</TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={u.username === "admin"}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="office">Office</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setPwOpen(u)}><KeyRound className="h-3 w-3 mr-1" />Password</Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteUser(u)} disabled={u.username === "admin"}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Per-User Module Access</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Overrides the default role permissions. Disable a module here to hide it from that user.</p>
              </div>
              <Select value={selectedUser || ""} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.username} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ALL_MODULES.map((m) => {
                    const currentVal = access[selected.user_id]?.[m.key];
                    const enabled = currentVal === undefined ? true : currentVal;
                    return (
                      <div key={m.key} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{m.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {currentVal === undefined ? <Badge variant="outline">Default</Badge> : enabled ? <Badge className="bg-emerald-600">Enabled</Badge> : <Badge variant="destructive">Disabled</Badge>}
                          </p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={(v) => toggleModule(selected.user_id, m.key, v)} disabled={selected.username === "admin"} />
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">Select a user to configure access.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE USER */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Username</Label><Input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} /></div>
            <div className="space-y-2"><Label>Full Name</Label><Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createUser} disabled={loading}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CHANGE PASSWORD */}
      <Dialog open={!!pwOpen} onOpenChange={(v) => { if (!v) { setPwOpen(null); setNewPw(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password — {pwOpen?.username}</DialogTitle>
            <DialogDescription>Enter a new password. The user will need to log in with this new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPwOpen(null); setNewPw(""); }}>Cancel</Button>
              <Button onClick={resetPassword} disabled={loading || !newPw}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
