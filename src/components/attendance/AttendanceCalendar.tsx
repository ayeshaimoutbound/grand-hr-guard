import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  present: boolean;
  shift_type: string;
  rank: string;
}

interface Company {
  id: string;
  company_name: string;
  pay_oic: number;
  pay_sso: number;
  pay_jso: number;
  pay_lso: number;
}

interface AttendanceCalendarProps {
  selectedCompany: Company;
  selectedMonth: Date;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  onRefresh: () => void;
  isSuperAdmin: boolean;
}

export default function AttendanceCalendar({
  selectedCompany,
  selectedMonth,
  employees,
  attendanceRecords,
  onRefresh,
  isSuperAdmin,
}: AttendanceCalendarProps) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<"OIC" | "SSO" | "JSO" | "LSO" | "">("");

  const daysInMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  ).getDate();

  const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getAttendance = (employeeId: string, date: number, shift: "Day" | "Night") => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    
    return attendanceRecords.find(
      (record) =>
        record.employee_id === employeeId &&
        record.attendance_date === dateStr &&
        record.shift_type === shift
    );
  };

  const handleMarkAttendance = async (
    employeeId: string,
    date: number,
    shift: "Day" | "Night"
  ) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

    const existing = getAttendance(employeeId, date, shift);
    const employeeRank = getEmployeeRank(employeeId) as "OIC" | "SSO" | "JSO" | "LSO";

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({ present: true })
        .eq("id", existing.id);

      if (error) {
        toast.error("Error updating attendance");
        return;
      }
    } else {
      const { error } = await supabase.from("attendance").insert([
        {
          employee_id: employeeId,
          company_id: selectedCompany.id,
          attendance_date: dateStr,
          present: true,
          shift_type: shift,
          rank: employeeRank,
        },
      ]);

      if (error) {
        toast.error("Error marking attendance");
        return;
      }
    }

    onRefresh();
  };

  const handleRemoveAttendance = async (recordId: string) => {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", recordId);

    if (error) {
      toast.error("Error removing attendance");
      return;
    }

    onRefresh();
  };

  const calculateEmployeeStats = (employeeId: string) => {
    const records = attendanceRecords.filter(
      (r) => r.employee_id === employeeId && r.present
    );
    
    const totalShifts = records.length;

    return { totalShifts };
  };

  const getEmployeeRank = (employeeId: string) => {
    const record = attendanceRecords.find((r) => r.employee_id === employeeId);
    return record?.rank || "-";
  };

  const calculateTotals = () => {
    let totalShifts = 0;

    employees.forEach((emp) => {
      const stats = calculateEmployeeStats(emp.id);
      totalShifts += stats.totalShifts;
    });

    return { totalShifts };
  };

  const totals = calculateTotals();

  // Get unique employees who have attendance in this company/month
  const activeEmployees = employees.filter((emp) =>
    attendanceRecords.some((record) => record.employee_id === emp.id)
  );

  const handleAddEmployeeToCalendar = async () => {
    if (!selectedEmployee || !selectedRank) {
      toast.error("Please select both employee and rank");
      return;
    }

    // Add a placeholder attendance record for the first day to add employee to calendar
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const { error } = await supabase.from("attendance").insert([
      {
        employee_id: selectedEmployee,
        company_id: selectedCompany.id,
        attendance_date: dateStr,
        present: false,
        shift_type: "Day" as const,
        rank: selectedRank as "OIC" | "SSO" | "JSO" | "LSO",
      },
    ]);

    if (error) {
      toast.error("Error adding employee");
      return;
    }

    setShowAddEmployee(false);
    setSelectedEmployee("");
    setSelectedRank("");
    onRefresh();
    toast.success("Employee added to calendar");
  };

  // Get employees not yet in the calendar
  const availableEmployees = employees.filter(
    (emp) => !activeEmployees.some((active) => active.id === emp.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {selectedCompany.company_name} - {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-4 mt-2">
            <Badge variant="secondary">Total Shifts: {totals.totalShifts}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Add Employee Section */}
      {!showAddEmployee ? (
        <Button onClick={() => setShowAddEmployee(true)} variant="outline">
          + Add Employee to Calendar
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Rank</label>
                <Select value={selectedRank} onValueChange={(value) => setSelectedRank(value as "OIC" | "SSO" | "JSO" | "LSO")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose rank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OIC">OIC</SelectItem>
                    <SelectItem value="SSO">SSO</SelectItem>
                    <SelectItem value="JSO">JSO</SelectItem>
                    <SelectItem value="LSO">LSO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddEmployeeToCalendar}>Add</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddEmployee(false);
                  setSelectedEmployee("");
                  setSelectedRank("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 p-2 text-left font-medium border-r min-w-[150px]">
                    Employee
                  </th>
                  <th className="p-2 text-center font-medium border-r bg-muted/50 min-w-[60px]">
                    Rank
                  </th>
                  {dates.map((date) => (
                    <th
                      key={date}
                      className="p-1 text-center font-medium border-r"
                      colSpan={2}
                    >
                      {date}
                    </th>
                  ))}
                  <th className="p-2 text-center font-medium border-l bg-muted/50">
                    Total Shifts
                  </th>
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/30 p-2 border-r"></th>
                  <th className="bg-muted/30 p-2 border-r"></th>
                  {dates.map((date) => (
                    <>
                      <th
                        key={`${date}-day`}
                        className="p-1 text-xs text-center font-normal border-r"
                      >
                        Day
                      </th>
                      <th
                        key={`${date}-night`}
                        className="p-1 text-xs text-center font-normal border-r"
                      >
                        Night
                      </th>
                    </>
                  ))}
                  <th className="p-2 text-xs text-center font-normal border-l bg-muted/30">
                    Shifts
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((employee) => {
                  const stats = calculateEmployeeStats(employee.id);
                  const employeeRank = getEmployeeRank(employee.id);
                  return (
                    <tr key={employee.id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background p-2 font-medium border-r">
                        {employee.full_name}
                      </td>
                      <td className="bg-background p-2 text-center font-medium border-r">
                        <Badge variant="secondary">{employeeRank}</Badge>
                      </td>
                      {dates.map((date) =>
                        ["Day", "Night"].map((shift) => {
                          const attendance = getAttendance(employee.id, date, shift as "Day" | "Night");

                          return (
                            <td
                              key={`${date}-${shift}`}
                              className="p-1 text-center border-r"
                            >
                              {attendance?.present ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-lg font-semibold">1</span>
                                  {isSuperAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAttendance(attendance.id);
                                      }}
                                    >
                                      ×
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-full text-xs font-semibold"
                                  onClick={() => {
                                    handleMarkAttendance(
                                      employee.id,
                                      date,
                                      shift as "Day" | "Night"
                                    );
                                  }}
                                >
                                  0
                                </Button>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="p-2 text-center font-medium border-l bg-muted/20">
                        {stats.totalShifts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
