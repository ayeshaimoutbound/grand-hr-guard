import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { userSchema } from "@/lib/validationSchemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface UserWithRole {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "user",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        full_name,
        user_roles(role)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching users");
      return;
    }

    const usersWithRoles = data?.map((user: any) => ({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.user_roles[0]?.role || "unknown",
    }));

    setUsers(usersWithRoles || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate input
      const validation = userSchema.safeParse(formData);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      // Generate email based on username for consistent authentication
      const email = `${formData.username.toLowerCase()}@grandsenaro.local`;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create profile with email stored
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id,
          username: formData.username,
          full_name: formData.full_name || null,
          email: email,
        },
      ]);

      if (profileError) throw profileError;

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert([
        {
          user_id: authData.user.id,
          role: formData.role as "admin" | "super_admin" | "user" | "moderator" | "viewer",
        },
      ]);

      if (roleError) throw roleError;

      toast.success("User created successfully");
      resetForm();
      fetchUsers();
      setIsDialogOpen(false);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error creating user:", error);
      }
      toast.error(error.message || "Error creating user");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      // Call edge function to securely delete user with proper authorization
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete user');
      }

      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting user:", error);
      }
      toast.error(error.message || "Error deleting user");
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      full_name: "",
      role: "user",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage system users and roles (Super Admin only)</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with appropriate role
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader></CardHeader>
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
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          user.role === "super_admin" ? "default" : 
                          user.role === "admin" ? "secondary" : 
                          "outline"
                        }
                      >
                        {user.role === "super_admin" ? "Super Admin" : 
                         user.role === "admin" ? "Admin" :
                         user.role === "moderator" ? "Moderator" :
                         user.role === "viewer" ? "Viewer" :
                         user.role === "user" ? "User" : user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
