import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, DollarSign, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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

interface SalaryRecord {
  id: string;
  employee_id: string;
  company_id: string;
  salary_month: string;
  basic_salary: number;
  total_shifts: number;
  gross_shift_total: number;
  pay_per_shift: number;
  final_salary: number;
  epf: number;
  salary_advance: number;
  transport: number;
  food: number;
  uniforms: number;
  other_deductions: number;
}

interface Employee {
  id: string;
  full_name: string;
}

interface Company {
  id: string;
  company_name: string;
  pay_oic: number;
  pay_sso: number;
  pay_jso: number;
  pay_lso: number;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  rank: string;
  present: boolean;
  shift_type: string;
}

export default function Salaries() {
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalaryRecord | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    employee_id: "",
    company_id: "",
    salary_month: new Date().toISOString().substring(0, 7),
    basic_salary: "0",
    total_shifts: "0",
    gross_shift_total: "0",
    pay_per_shift: "0",
    epf: "0",
    salary_advance: "0",
    transport: "0",
    food: "0",
    uniforms: "0",
    other_deductions: "0",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = salaryRecords.filter((record) => {
      const employee = employees.find((e) => e.id === record.employee_id);
      const company = companies.find((c) => c.id === record.company_id);
      const searchLower = searchTerm.toLowerCase();
      return (
        employee?.full_name.toLowerCase().includes(searchLower) ||
        company?.company_name.toLowerCase().includes(searchLower) ||
        record.salary_month.includes(searchLower)
      );
    });
    setFilteredRecords(filtered);
  }, [searchTerm, salaryRecords, employees, companies]);

  const fetchData = async () => {
    const [salariesRes, employeesRes, companiesRes] = await Promise.all([
      supabase.from("salaries").select("*").order("salary_month", { ascending: false }),
      supabase.from("employees").select("id, full_name"),
      supabase.from("companies").select("id, company_name, pay_oic, pay_sso, pay_jso, pay_lso"),
    ]);

    if (salariesRes.error) {
      toast.error("Error fetching salary records");
    } else {
      setSalaryRecords(salariesRes.data || []);
      setFilteredRecords(salariesRes.data || []);
    }

    if (!employeesRes.error) setEmployees(employeesRes.data || []);
    if (!companiesRes.error) setCompanies(companiesRes.data || []);
  };

  const handleAutoCalculate = async () => {
    if (!formData.employee_id || !formData.company_id || !formData.salary_month) {
      toast.error("Please select employee, company, and month first");
      return;
    }

    // Fetch attendance records for the selected employee, company, and month
    const startDate = `${formData.salary_month}-01`;
    const endDate = `${formData.salary_month}-31`;

    const { data: attendanceData, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", formData.employee_id)
      .eq("company_id", formData.company_id)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate)
      .eq("present", true);

    if (error) {
      toast.error("Error fetching attendance data");
      return;
    }

    if (!attendanceData || attendanceData.length === 0) {
      toast.error("No attendance records found for this period");
      return;
    }

    const totalShifts = attendanceData.length;
    const employeeRank = attendanceData[0]?.rank as "OIC" | "SSO" | "JSO" | "LSO";

    // Get pay rate from company
    const company = companies.find((c) => c.id === formData.company_id);
    if (!company) {
      toast.error("Company not found");
      return;
    }

    let payPerShift = 0;
    switch (employeeRank) {
      case "OIC":
        payPerShift = company.pay_oic;
        break;
      case "SSO":
        payPerShift = company.pay_sso;
        break;
      case "JSO":
        payPerShift = company.pay_jso;
        break;
      case "LSO":
        payPerShift = company.pay_lso;
        break;
    }

    const grossShiftTotal = totalShifts * payPerShift;

    setFormData({
      ...formData,
      total_shifts: totalShifts.toString(),
      pay_per_shift: payPerShift.toString(),
      gross_shift_total: grossShiftTotal.toString(),
    });

    toast.success(`Auto-calculated: ${totalShifts} shifts × Rs. ${payPerShift} = Rs. ${grossShiftTotal}`);
  };

  const calculateFinalSalary = () => {
    const basicSalary = parseFloat(formData.basic_salary) || 0;
    const grossShiftTotal = parseFloat(formData.gross_shift_total) || 0;
    const epf = parseFloat(formData.epf) || 0;
    const advance = parseFloat(formData.salary_advance) || 0;
    const transport = parseFloat(formData.transport) || 0;
    const food = parseFloat(formData.food) || 0;
    const uniforms = parseFloat(formData.uniforms) || 0;
    const other = parseFloat(formData.other_deductions) || 0;

    return basicSalary + grossShiftTotal - epf - advance - transport - food - uniforms - other;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      employee_id: formData.employee_id,
      company_id: formData.company_id,
      salary_month: formData.salary_month + "-01",
      basic_salary: parseFloat(formData.basic_salary),
      total_shifts: parseInt(formData.total_shifts),
      gross_shift_total: parseFloat(formData.gross_shift_total),
      pay_per_shift: parseFloat(formData.pay_per_shift),
      final_salary: calculateFinalSalary(),
      epf: parseFloat(formData.epf),
      salary_advance: parseFloat(formData.salary_advance),
      transport: parseFloat(formData.transport),
      food: parseFloat(formData.food),
      uniforms: parseFloat(formData.uniforms),
      other_deductions: parseFloat(formData.other_deductions),
    };

    if (isEditMode && currentRecord) {
      const { error } = await supabase
        .from("salaries")
        .update(payload)
        .eq("id", currentRecord.id);

      if (error) {
        toast.error("Error updating salary");
        return;
      }
      toast.success("Salary updated successfully");
    } else {
      const { error } = await supabase.from("salaries").insert([payload]);

      if (error) {
        toast.error("Error adding salary");
        return;
      }
      toast.success("Salary added successfully");
    }

    resetForm();
    fetchData();
    setIsDialogOpen(false);
  };

  const handleEdit = (record: SalaryRecord) => {
    setCurrentRecord(record);
    setFormData({
      employee_id: record.employee_id,
      company_id: record.company_id || "",
      salary_month: record.salary_month.substring(0, 7),
      basic_salary: record.basic_salary.toString(),
      total_shifts: record.total_shifts.toString(),
      gross_shift_total: record.gross_shift_total.toString(),
      pay_per_shift: record.pay_per_shift.toString(),
      epf: record.epf.toString(),
      salary_advance: record.salary_advance.toString(),
      transport: record.transport.toString(),
      food: record.food.toString(),
      uniforms: record.uniforms.toString(),
      other_deductions: record.other_deductions.toString(),
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete salary records");
      return;
    }

    if (!confirm("Are you sure you want to delete this salary record?")) return;

    const { error } = await supabase.from("salaries").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting salary");
      return;
    }

    toast.success("Salary deleted successfully");
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      employee_id: "",
      company_id: "",
      salary_month: new Date().toISOString().substring(0, 7),
      basic_salary: "0",
      total_shifts: "0",
      gross_shift_total: "0",
      pay_per_shift: "0",
      epf: "0",
      salary_advance: "0",
      transport: "0",
      food: "0",
      uniforms: "0",
      other_deductions: "0",
    });
    setIsEditMode(false);
    setCurrentRecord(null);
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee ? employee.full_name : "Unknown";
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    return company ? company.company_name : "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground">Calculate and manage employee salaries</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Salary
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Salary" : "Add Salary Record"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update salary record details"
                  : "Enter salary details for an employee"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Employee</Label>
                  <Select
                    value={formData.employee_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, employee_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_id">Company</Label>
                  <Select
                    value={formData.company_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, company_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_month">Salary Month</Label>
                  <Input
                    id="salary_month"
                    type="month"
                    value={formData.salary_month}
                    onChange={(e) =>
                      setFormData({ ...formData, salary_month: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={handleAutoCalculate}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Auto-Calculate from Attendance
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basic_salary">Basic Salary (Rs.)</Label>
                  <Input
                    id="basic_salary"
                    type="number"
                    step="0.01"
                    value={formData.basic_salary}
                    onChange={(e) =>
                      setFormData({ ...formData, basic_salary: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_shifts">Total Shifts</Label>
                  <Input
                    id="total_shifts"
                    type="number"
                    value={formData.total_shifts}
                    onChange={(e) =>
                      setFormData({ ...formData, total_shifts: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_per_shift">Pay per Shift (Rs.)</Label>
                  <Input
                    id="pay_per_shift"
                    type="number"
                    step="0.01"
                    value={formData.pay_per_shift}
                    onChange={(e) =>
                      setFormData({ ...formData, pay_per_shift: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gross_shift_total">Gross Shift Total (Rs.)</Label>
                  <Input
                    id="gross_shift_total"
                    type="number"
                    step="0.01"
                    value={formData.gross_shift_total}
                    onChange={(e) =>
                      setFormData({ ...formData, gross_shift_total: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Deductions (Rs.)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="epf">EPF</Label>
                    <Input
                      id="epf"
                      type="number"
                      step="0.01"
                      value={formData.epf}
                      onChange={(e) => setFormData({ ...formData, epf: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary_advance">Salary Advance</Label>
                    <Input
                      id="salary_advance"
                      type="number"
                      step="0.01"
                      value={formData.salary_advance}
                      onChange={(e) =>
                        setFormData({ ...formData, salary_advance: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transport">Transport</Label>
                    <Input
                      id="transport"
                      type="number"
                      step="0.01"
                      value={formData.transport}
                      onChange={(e) =>
                        setFormData({ ...formData, transport: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="food">Food</Label>
                    <Input
                      id="food"
                      type="number"
                      step="0.01"
                      value={formData.food}
                      onChange={(e) => setFormData({ ...formData, food: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uniforms">Uniforms</Label>
                    <Input
                      id="uniforms"
                      type="number"
                      step="0.01"
                      value={formData.uniforms}
                      onChange={(e) =>
                        setFormData({ ...formData, uniforms: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="other_deductions">Other Deductions</Label>
                    <Input
                      id="other_deductions"
                      type="number"
                      step="0.01"
                      value={formData.other_deductions}
                      onChange={(e) =>
                        setFormData({ ...formData, other_deductions: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">Final Salary:</span>
                  <span className="text-2xl font-bold text-primary">
                    Rs. {calculateFinalSalary().toFixed(2)}
                  </span>
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
                <Button type="submit">{isEditMode ? "Update" : "Add"} Salary</Button>
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
                placeholder="Search by employee, company, or month..."
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
                <TableHead>Month</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Shifts</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Shift Total</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead className="font-bold">Final Salary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No salary records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  const totalDeductions =
                    record.epf +
                    record.salary_advance +
                    record.transport +
                    record.food +
                    record.uniforms +
                    record.other_deductions;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.salary_month).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell>{getEmployeeName(record.employee_id)}</TableCell>
                      <TableCell>{getCompanyName(record.company_id)}</TableCell>
                      <TableCell>{record.total_shifts}</TableCell>
                      <TableCell>Rs. {record.basic_salary.toFixed(2)}</TableCell>
                      <TableCell>Rs. {record.gross_shift_total.toFixed(2)}</TableCell>
                      <TableCell className="text-destructive">
                        Rs. {totalDeductions.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        Rs. {record.final_salary.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
