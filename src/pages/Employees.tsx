import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Upload, Download, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
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
  epf_no?: string;
}

interface AttendanceStat {
  lastDate: string | null;
  lastMonthShifts: number;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const { isSuperAdmin, isOffice } = useAuth();

  const [attendanceStats, setAttendanceStats] = useState<Record<string, AttendanceStat>>({});

  const [formData, setFormData] = useState({
    employee_id: "",
    full_name: "",
    nic: "",
    bank_name: "",
    branch: "",
    account_number: "",
    phone_number: "",
    epf_no: "",
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
    // Super admins and office staff query the full employees table
    // Regular admins query the limited view with only non-sensitive fields
    const { data, error } = (isSuperAdmin || isOffice)
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

    const list = (data || []) as Employee[];
    setEmployees(list);
    setFilteredEmployees(list);
    fetchAttendanceStats(list);
  };

  const fetchAttendanceStats = async (list: Employee[]) => {
    const { data, error } = await supabase
      .from("attendance")
      .select("employee_id, attendance_date, present")
      .eq("present", true);
    if (error) return;

    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const stats: Record<string, AttendanceStat> = {};
    list.forEach((e) => {
      stats[e.id] = { lastDate: null, lastMonthShifts: 0 };
    });
    (data || []).forEach((row: any) => {
      const s = stats[row.employee_id];
      if (!s) return;
      if (!s.lastDate || row.attendance_date > s.lastDate) s.lastDate = row.attendance_date;
      const d = new Date(row.attendance_date);
      if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) s.lastMonthShifts += 1;
    });
    setAttendanceStats(stats);
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
      epf_no: employee.epf_no || "",
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
      epf_no: "",
    });
    setIsEditMode(false);
    setCurrentEmployee(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const norm = (k: string) => k.toString().toLowerCase().replace(/[\s_-]/g, "");
      const pick = (row: any, keys: string[]) => {
        for (const key of Object.keys(row)) {
          if (keys.includes(norm(key))) return String(row[key] ?? "").trim();
        }
        return "";
      };

      const mapped = rows
        .map((row) => ({
          employee_id: pick(row, ["employeeid", "empid", "id"]),
          full_name: pick(row, ["fullname", "name"]),
          nic: pick(row, ["nic"]),
          phone_number: pick(row, ["phone", "phonenumber", "mobile"]),
          bank_name: pick(row, ["bank", "bankname"]),
          branch: pick(row, ["branch"]),
          account_number: pick(row, ["accountno", "accountnumber", "acno", "account"]),
          epf_no: pick(row, ["epfno", "epf", "epfnumber"]),
        }))
        .filter((r) => r.employee_id && r.full_name);

      if (mapped.length === 0) {
        toast.error("No valid rows found. Required columns: Employee ID, Full name, NIC, Phone, Bank, Branch, Account no");
        return;
      }

      const { error, count } = await supabase
        .from("employees")
        .insert(mapped, { count: "exact" });

      if (error) {
        toast.error("Bulk upload failed: " + error.message);
      } else {
        toast.success(`Imported ${count ?? mapped.length} employees`);
        fetchEmployees();
      }
    } catch (err: any) {
      toast.error("Failed to parse file: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBulkDownload = () => {
    if (!employees.length) {
      toast.error("No employees to export");
      return;
    }
    const rows = employees.map((e) => ({
      "Employee ID": e.employee_id,
      "Full name": e.full_name,
      NIC: e.nic || "",
      Phone: e.phone_number || "",
      Bank: e.bank_name || "",
      Branch: e.branch || "",
      "Account no": e.account_number || "",
      "EPF No": e.epf_no || "",
      Status: (() => {
        const s = attendanceStats[e.id];
        if (!s || !s.lastDate) return "Inactive (never)";
        const daysAgo = Math.floor((Date.now() - new Date(s.lastDate).getTime()) / 86400000);
        return daysAgo > 60 ? `Inactive (last worked ${daysAgo}d ago)` : `Active (${s.lastMonthShifts} shifts last month)`;
      })(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, `Employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Employees exported");
  };

  const handleDownloadTemplate = () => {
    const rows = [
      {
        "Employee ID": "GSS001",
        "Full Name": "John Doe",
        NIC: "123456789V",
        Phone: "0777305321",
        Bank: "Commercial Bank",
        Branch: "Maharagama",
        "Account No": "1234567890",
        "EPF No": "EPF001",
      },
      {
        "Employee ID": "GSS002",
        "Full Name": "Jane Smith",
        NIC: "987654321V",
        Phone: "0717305321",
        Bank: "Sampath Bank",
        Branch: "Nugegoda",
        "Account No": "0987654321",
        "EPF No": "EPF002",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Employee_Bulk_Upload_Template.xlsx");
    toast.success("Template downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage employee information</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleBulkUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDown className="h-4 w-4 mr-2" />
            Download Format
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload (.xlsx)
          </Button>
          <Button variant="outline" onClick={handleBulkDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download (.xlsx)
          </Button>
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
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="epf_no">EPF No</Label>
                  <Input
                    id="epf_no"
                    value={formData.epf_no}
                    onChange={(e) => setFormData({ ...formData, epf_no: e.target.value })}
                    placeholder="EPF number"
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
                <TableHead>Status</TableHead>
                <TableHead>NIC</TableHead>
                <TableHead>Phone</TableHead>
                {isSuperAdmin && <TableHead>EPF No</TableHead>}
                {isSuperAdmin && <TableHead>Bank</TableHead>}
                {isSuperAdmin && <TableHead>Branch</TableHead>}
                {isSuperAdmin && <TableHead>Account No.</TableHead>}
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => {
                  const stat = attendanceStats[employee.id];
                  let statusEl: JSX.Element;
                  if (!stat || !stat.lastDate) {
                    statusEl = (
                      <Badge variant="destructive" className="font-normal">
                        Inactive · never worked
                      </Badge>
                    );
                  } else {
                    const daysAgo = Math.floor(
                      (Date.now() - new Date(stat.lastDate).getTime()) / 86400000
                    );
                    if (daysAgo > 60) {
                      statusEl = (
                        <Badge variant="destructive" className="font-normal">
                          Inactive · last worked {daysAgo}d ago
                        </Badge>
                      );
                    } else {
                      statusEl = (
                        <Badge className="font-normal bg-emerald-500/90 hover:bg-emerald-500 text-white">
                          Active · {stat.lastMonthShifts} shifts last month
                        </Badge>
                      );
                    }
                  }
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employee_id}</TableCell>
                      <TableCell>{employee.full_name}</TableCell>
                      <TableCell>{statusEl}</TableCell>
                      <TableCell>
                        {isSuperAdmin
                          ? employee.nic
                          : (employee.nic || "").substring(0, 4) + "XXXX"}
                      </TableCell>
                      <TableCell>{employee.phone_number}</TableCell>
                      {isSuperAdmin && <TableCell>{employee.epf_no || "-"}</TableCell>}
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}