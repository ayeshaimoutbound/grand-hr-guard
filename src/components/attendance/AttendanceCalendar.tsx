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
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    date: number;
    shift: "Day" | "Night";
  } | null>(null);

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
    shift: "Day" | "Night",
    rank: "OIC" | "SSO" | "JSO" | "LSO"
  ) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

    const existing = getAttendance(employeeId, date, shift);

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({ present: true, rank })
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
          rank,
        },
      ]);

      if (error) {
        toast.error("Error marking attendance");
        return;
      }
    }

    setEditingCell(null);
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
    let totalPay = 0;

    records.forEach((record) => {
      switch (record.rank) {
        case "OIC":
          totalPay += selectedCompany.pay_oic;
          break;
        case "SSO":
          totalPay += selectedCompany.pay_sso;
          break;
        case "JSO":
          totalPay += selectedCompany.pay_jso;
          break;
        case "LSO":
          totalPay += selectedCompany.pay_lso;
          break;
      }
    });

    return { totalShifts, totalPay };
  };

  const calculateTotals = () => {
    let totalShifts = 0;
    let totalPayable = 0;

    employees.forEach((emp) => {
      const stats = calculateEmployeeStats(emp.id);
      totalShifts += stats.totalShifts;
      totalPayable += stats.totalPay;
    });

    return { totalShifts, totalPayable };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {selectedCompany.company_name} - {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-4 mt-2">
            <Badge variant="secondary">Total Shifts: {totals.totalShifts}</Badge>
            <Badge variant="secondary">Total Payable: Rs. {totals.totalPayable.toLocaleString()}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 p-2 text-left font-medium border-r min-w-[150px]">
                    Employee
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
                  <th className="p-2 text-center font-medium border-l bg-muted/50" colSpan={2}>
                    Total
                  </th>
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/30 p-2 border-r"></th>
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
                  <th className="p-2 text-xs text-center font-normal bg-muted/30">
                    Pay
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const stats = calculateEmployeeStats(employee.id);
                  return (
                    <tr key={employee.id} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background p-2 font-medium border-r">
                        {employee.full_name}
                      </td>
                      {dates.map((date) =>
                        ["Day", "Night"].map((shift) => {
                          const attendance = getAttendance(employee.id, date, shift as "Day" | "Night");
                          const isEditing =
                            editingCell?.employeeId === employee.id &&
                            editingCell?.date === date &&
                            editingCell?.shift === shift;

                          return (
                            <td
                              key={`${date}-${shift}`}
                              className="p-1 text-center border-r cursor-pointer hover:bg-muted/30"
                              onClick={() => {
                                if (!attendance) {
                                  setEditingCell({
                                    employeeId: employee.id,
                                    date,
                                    shift: shift as "Day" | "Night",
                                  });
                                }
                              }}
                            >
                              {attendance?.present ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge variant="default" className="text-xs px-1">
                                    {attendance.rank}
                                  </Badge>
                                  {isSuperAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAttendance(attendance.id);
                                      }}
                                    >
                                      ×
                                    </Button>
                                  )}
                                </div>
                              ) : isEditing ? (
                                <Select
                                  onValueChange={(rank) =>
                                    handleMarkAttendance(
                                      employee.id,
                                      date,
                                      shift as "Day" | "Night",
                                      rank as "OIC" | "SSO" | "JSO" | "LSO"
                                    )
                                  }
                                  onOpenChange={(open) => {
                                    if (!open) setEditingCell(null);
                                  }}
                                  defaultOpen
                                >
                                  <SelectTrigger className="h-6 w-16 text-xs">
                                    <SelectValue placeholder="Rank" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="OIC">OIC</SelectItem>
                                    <SelectItem value="SSO">SSO</SelectItem>
                                    <SelectItem value="JSO">JSO</SelectItem>
                                    <SelectItem value="LSO">LSO</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="p-2 text-center font-medium border-l bg-muted/20">
                        {stats.totalShifts}
                      </td>
                      <td className="p-2 text-center font-medium bg-muted/20">
                        Rs. {stats.totalPay.toLocaleString()}
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
