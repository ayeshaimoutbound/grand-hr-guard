import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { employeeSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  nic?: string;
  bank_name?: string;
  branch?: string;
  account_number?: string;
  phone_number?: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    employee_id: "",
    full_name: "",
    nic: "",
    bank_name: "",
    branch: "",
    account_number: "",
    phone_number: "",
  });

  useEffect(() => {
    fetchEmployees();
  }, [isSuperAdmin]);

  useEffect(() => {
    const filtered = employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    // Super admins query the full employees table with all sensitive data
    // Regular admins query the limited view with only non-sensitive fields
    const { data, error } = isSuperAdmin
      ? await supabase
          .from("employees")
          .select("*")
          .order("created_at", { ascending: false })
      : await supabase
          .from("employees_limited" as any)
          .select("*")
          .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching employees");
      return;
    }

    setEmployees((data || []) as Employee[]);
    setFilteredEmployees((data || []) as Employee[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    try {
      employeeSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (isEditMode && currentEmployee) {
      // Update employee (Super Admin only)
      const { error } = await supabase
        .from("employees")
        .update(formData)
        .eq("id", currentEmployee.id);

      if (error) {
        toast.error("Error updating employee");
        return;
      }
      toast.success("Employee updated successfully");
    } else {
      // Add new employee
      const { error } = await supabase.from("employees").insert([formData]);

      if (error) {
        toast.error("Error adding employee");
        return;
      }
      toast.success("Employee added successfully");
    }

    resetForm();
    fetchEmployees();
    setIsDialogOpen(false);
  };

  const handleEdit = (employee: Employee) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit employees");
      return;
    }

    setCurrentEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      full_name: employee.full_name,
      nic: employee.nic,
      bank_name: employee.bank_name,
      branch: employee.branch,
      account_number: employee.account_number,
      phone_number: employee.phone_number,
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete employees");
      return;
    }

    if (!confirm("Are you sure you want to delete this employee?")) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting employee");
      return;
    }

    toast.success("Employee deleted successfully");
    fetchEmployees();
  };

  const resetForm = () => {
    setFormData({
      employee_id: "",
      full_name: "",
      nic: "",
      bank_name: "",
      branch: "",
      account_number: "",
      phone_number: "",
    });
    setIsEditMode(false);
    setCurrentEmployee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage employee information</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Employee" : "Add New Employee"}</DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update employee information"
                  : "Enter employee details to add to the system"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee ID</Label>
                  <Input
                    id="employee_id"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    required
                    disabled={isEditMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nic">NIC</Label>
                  <Input
                    id="nic"
                    value={formData.nic}
                    onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                    required
                    placeholder="e.g., 123456789V or 199012345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    required
                    placeholder="e.g., 0771234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    required
                    placeholder="Digits only"
                  />
                </div>
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
                <Button type="submit">{isEditMode ? "Update" : "Add"} Employee</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>NIC</TableHead>
                <TableHead>Phone</TableHead>
                {isSuperAdmin && <TableHead>Bank</TableHead>}
                {isSuperAdmin && <TableHead>Branch</TableHead>}
                {isSuperAdmin && <TableHead>Account No.</TableHead>}
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employee_id}</TableCell>
                    <TableCell>{employee.full_name}</TableCell>
                    <TableCell>
                      {isSuperAdmin 
                        ? employee.nic 
                        : employee.nic.substring(0, 4) + "XXXX"}
                    </TableCell>
                    <TableCell>{employee.phone_number}</TableCell>
                    {isSuperAdmin && <TableCell>{employee.bank_name}</TableCell>}
                    {isSuperAdmin && <TableCell>{employee.branch}</TableCell>}
                    {isSuperAdmin && <TableCell>{employee.account_number}</TableCell>}
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(employee.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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