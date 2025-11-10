import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Calendar } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  company_id: string;
  attendance_date: string;
  present: boolean;
  shift_type: string;
  rank: string;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface Company {
  id: string;
  company_name: string;
}

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<AttendanceRecord | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    employee_id: "",
    company_id: "",
    attendance_date: new Date().toISOString().split("T")[0],
    present: true,
    shift_type: "Day" as "Day" | "Night",
    rank: "LSO" as "LSO" | "JSO" | "SSO" | "OIC",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = attendanceRecords.filter((record) => {
      const employee = employees.find((e) => e.id === record.employee_id);
      const company = companies.find((c) => c.id === record.company_id);
      const searchLower = searchTerm.toLowerCase();
      return (
        employee?.full_name.toLowerCase().includes(searchLower) ||
        company?.company_name.toLowerCase().includes(searchLower) ||
        record.attendance_date.includes(searchLower)
      );
    });
    setFilteredRecords(filtered);
  }, [searchTerm, attendanceRecords, employees, companies]);

  const fetchData = async () => {
    const [attendanceRes, employeesRes, companiesRes] = await Promise.all([
      supabase.from("attendance").select("*").order("attendance_date", { ascending: false }),
      supabase.from("employees").select("id, employee_id, full_name"),
      supabase.from("companies").select("id, company_name"),
    ]);

    if (attendanceRes.error) {
      toast.error("Error fetching attendance records");
    } else {
      setAttendanceRecords(attendanceRes.data || []);
      setFilteredRecords(attendanceRes.data || []);
    }

    if (!employeesRes.error) setEmployees(employeesRes.data || []);
    if (!companiesRes.error) setCompanies(companiesRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && currentRecord) {
      const { error } = await supabase
        .from("attendance")
        .update(formData)
        .eq("id", currentRecord.id);

      if (error) {
        toast.error("Error updating attendance");
        return;
      }
      toast.success("Attendance updated successfully");
    } else {
      const { error } = await supabase.from("attendance").insert([formData]);

      if (error) {
        toast.error("Error adding attendance");
        return;
      }
      toast.success("Attendance added successfully");
    }

    resetForm();
    fetchData();
    setIsDialogOpen(false);
  };

  const handleEdit = (record: AttendanceRecord) => {
    setCurrentRecord(record);
    setFormData({
      employee_id: record.employee_id,
      company_id: record.company_id,
      attendance_date: record.attendance_date,
      present: record.present,
      shift_type: record.shift_type as "Day" | "Night",
      rank: record.rank as "LSO" | "JSO" | "SSO" | "OIC",
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance record?")) return;

    const { error } = await supabase.from("attendance").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting attendance");
      return;
    }

    toast.success("Attendance deleted successfully");
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      employee_id: "",
      company_id: "",
      attendance_date: new Date().toISOString().split("T")[0],
      present: true,
      shift_type: "Day" as "Day" | "Night",
      rank: "LSO" as "LSO" | "JSO" | "SSO" | "OIC",
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
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Track employee attendance and shifts</p>
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
              Mark Attendance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Attendance" : "Mark Attendance"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update attendance record"
                  : "Record employee attendance for a shift"}
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
                  <Label htmlFor="attendance_date">Date</Label>
                  <Input
                    id="attendance_date"
                    type="date"
                    value={formData.attendance_date}
                    onChange={(e) =>
                      setFormData({ ...formData, attendance_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rank">Rank</Label>
                  <Select
                    value={formData.rank}
                    onValueChange={(value) =>
                      setFormData({ ...formData, rank: value as "LSO" | "JSO" | "SSO" | "OIC" })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OIC">OIC</SelectItem>
                      <SelectItem value="SSO">SSO</SelectItem>
                      <SelectItem value="JSO">JSO</SelectItem>
                      <SelectItem value="LSO">LSO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift_type">Shift Type</Label>
                  <Select
                    value={formData.shift_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, shift_type: value as "Day" | "Night" })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day Shift</SelectItem>
                      <SelectItem value="Night">Night Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="present">Status</Label>
                  <Select
                    value={formData.present.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, present: value === "true" })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Present</SelectItem>
                      <SelectItem value="false">Absent</SelectItem>
                    </SelectContent>
                  </Select>
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
                <Button type="submit">{isEditMode ? "Update" : "Mark"} Attendance</Button>
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
                placeholder="Search by employee, company, or date..."
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
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No attendance records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {new Date(record.attendance_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getEmployeeName(record.employee_id)}</TableCell>
                    <TableCell>{getCompanyName(record.company_id)}</TableCell>
                    <TableCell className="uppercase">{record.rank}</TableCell>
                    <TableCell className="capitalize">{record.shift_type}</TableCell>
                    <TableCell>
                      <Badge variant={record.present ? "default" : "destructive"}>
                        {record.present ? "Present" : "Absent"}
                      </Badge>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
