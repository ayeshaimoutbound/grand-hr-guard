import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import AttendanceCalendar from "@/components/attendance/AttendanceCalendar";

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
  pay_oic: number;
  pay_sso: number;
  pay_jso: number;
  pay_lso: number;
  charge_oic: number;
  charge_sso: number;
  charge_jso: number;
  charge_lso: number;
}

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const { isSuperAdmin, isAdmin } = useAuth();

  useEffect(() => {
    fetchCompaniesAndEmployees();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchAttendanceData();
    }
  }, [selectedCompany, selectedMonth]);

  const fetchCompaniesAndEmployees = async () => {
    const [employeesRes, companiesRes] = await Promise.all([
      supabase.from("employees").select("id, employee_id, full_name"),
      supabase.from("companies").select("*"),
    ]);

    if (!employeesRes.error) setEmployees(employeesRes.data || []);
    if (!companiesRes.error) setCompanies(companiesRes.data || []);
  };

  const fetchAttendanceData = async () => {
    const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("company_id", selectedCompany)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);

    if (error) {
      toast.error("Error fetching attendance data");
    } else {
      setAttendanceRecords(data || []);
    }
  };

  const selectedCompanyData = companies.find((c) => c.id === selectedCompany);

  const handleMonthChange = (direction: "prev" | "next") => {
    setSelectedMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <p className="text-muted-foreground">Track employee attendance with calendar view</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Company and Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px] space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompany && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleMonthChange("prev")}
                >
                  ←
                </Button>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md bg-muted/30">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {selectedMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleMonthChange("next")}
                >
                  →
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCompany && selectedCompanyData && (
        <AttendanceCalendar
          selectedCompany={selectedCompanyData}
          selectedMonth={selectedMonth}
          employees={employees}
          attendanceRecords={attendanceRecords}
          onRefresh={fetchAttendanceData}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
        />
      )}

      {!selectedCompany && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Please select a company to view attendance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
