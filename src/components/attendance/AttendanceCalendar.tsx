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
import { Download, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

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
  charge_oic: number;
  charge_sso: number;
  charge_jso: number;
  charge_lso: number;
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

  const calculateShiftReport = () => {
    const report = {
      OIC: { day: 0, night: 0, total: 0 },
      SSO: { day: 0, night: 0, total: 0 },
      JSO: { day: 0, night: 0, total: 0 },
      LSO: { day: 0, night: 0, total: 0 },
      totals: { day: 0, night: 0, total: 0 },
    };

    attendanceRecords
      .filter((record) => record.present)
      .forEach((record) => {
        const rank = record.rank as "OIC" | "SSO" | "JSO" | "LSO";
        const isDay = record.shift_type === "Day";

        if (isDay) {
          report[rank].day += 1;
          report.totals.day += 1;
        } else {
          report[rank].night += 1;
          report.totals.night += 1;
        }

        report[rank].total += 1;
        report.totals.total += 1;
      });

    return report;
  };

  const totals = calculateTotals();
  const shiftReport = calculateShiftReport();

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

  const handleSaveAllAttendance = async () => {
    try {
      toast.loading("Saving attendance and updating salaries/invoices...");

      // Update salaries for all active employees
      for (const employee of activeEmployees) {
        await updateEmployeeSalary(employee.id);
      }

      // Update invoice for this company and month
      await updateCompanyInvoice();

      toast.dismiss();
      toast.success("Attendance saved! Salaries and invoices updated successfully.");
      onRefresh();
    } catch (error) {
      toast.dismiss();
      if (import.meta.env.DEV) {
        console.error("Error saving attendance:", error);
      }
      toast.error("Failed to save attendance");
    }
  };

  const updateEmployeeSalary = async (employeeId: string) => {
    const stats = calculateEmployeeStats(employeeId);
    const rank = getEmployeeRank(employeeId) as "OIC" | "SSO" | "JSO" | "LSO";
    
    let payPerShift = 0;
    switch (rank) {
      case "OIC": payPerShift = selectedCompany.pay_oic; break;
      case "SSO": payPerShift = selectedCompany.pay_sso; break;
      case "JSO": payPerShift = selectedCompany.pay_jso; break;
      case "LSO": payPerShift = selectedCompany.pay_lso; break;
    }

    const grossShiftTotal = stats.totalShifts * payPerShift;
    const salaryMonth = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // Check if salary record exists
    const { data: existing } = await supabase
      .from("salaries")
      .select("id, basic_salary, epf, salary_advance, transport, food, uniforms, other_deductions")
      .eq("employee_id", employeeId)
      .eq("company_id", selectedCompany.id)
      .eq("salary_month", salaryMonth)
      .single();

    if (existing) {
      // Update existing record - preserve deductions
      // Auto-calculate EPF as 8% of Basic Salary
      const epf = (existing.basic_salary || 0) * 0.08;
      // Final Salary = Gross Shift Total - (EPF + All Deductions)
      // Basic Salary is used only for EPF calculation
      const finalSalary = grossShiftTotal - 
        epf - (existing.salary_advance || 0) - 
        (existing.transport || 0) - (existing.food || 0) - 
        (existing.uniforms || 0) - (existing.other_deductions || 0);

      await supabase
        .from("salaries")
        .update({ 
          total_shifts: stats.totalShifts, 
          pay_per_shift: payPerShift, 
          gross_shift_total: grossShiftTotal,
          epf: epf,
          final_salary: finalSalary
        })
        .eq("id", existing.id);
    } else {
      // Create new record
      const salaryData = {
        employee_id: employeeId,
        company_id: selectedCompany.id,
        salary_month: salaryMonth,
        total_shifts: stats.totalShifts,
        pay_per_shift: payPerShift,
        gross_shift_total: grossShiftTotal,
        basic_salary: 0,
        epf: 0,
        salary_advance: 0,
        transport: 0,
        food: 0,
        uniforms: 0,
        other_deductions: 0,
        final_salary: grossShiftTotal,
      };

      await supabase.from("salaries").insert(salaryData);
    }
  };

  const updateCompanyInvoice = async () => {
    const salaryMonth = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-01`;
    
    // Build line items for invoice based on attendance
    const lineItems: any[] = [];
    let totalAmount = 0;
    
    const ranks: Array<"OIC" | "SSO" | "JSO" | "LSO"> = ["OIC", "SSO", "JSO", "LSO"];
    ranks.forEach((rank) => {
      const dayShifts = shiftReport[rank].day;
      const nightShifts = shiftReport[rank].night;
      
      let chargePerShift = 0;
      switch (rank) {
        case "OIC": chargePerShift = selectedCompany.charge_oic; break;
        case "SSO": chargePerShift = selectedCompany.charge_sso; break;
        case "JSO": chargePerShift = selectedCompany.charge_jso; break;
        case "LSO": chargePerShift = selectedCompany.charge_lso; break;
      }
      
      // Add day shifts line item if exists
      if (dayShifts > 0) {
        const dayAmount = dayShifts * chargePerShift;
        lineItems.push({
          rank: rank,
          shift_type: "Day",
          shifts: dayShifts,
          rate_per_shift: chargePerShift,
          amount: dayAmount
        });
        totalAmount += dayAmount;
      }
      
      // Add night shifts line item if exists
      if (nightShifts > 0) {
        const nightAmount = nightShifts * chargePerShift;
        lineItems.push({
          rank: rank,
          shift_type: "Night",
          shifts: nightShifts,
          rate_per_shift: chargePerShift,
          amount: nightAmount
        });
        totalAmount += nightAmount;
      }
    });

    // Check if invoice exists - use maybeSingle to avoid errors
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, amount_received")
      .eq("company_id", selectedCompany.id)
      .eq("month_period", salaryMonth)
      .maybeSingle();

    const invoiceNumber = `INV-${selectedCompany.company_name.substring(0, 3).toUpperCase()}-${selectedMonth.getFullYear()}${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

    const invoiceData = {
      amount_to_collect: totalAmount,
      invoice_data: { lineItems }
    };

    if (existing) {
      // Update existing invoice - preserve amount_received
      await supabase
        .from("invoices")
        .update(invoiceData)
        .eq("id", existing.id);
    } else {
      // Create new invoice
      await supabase.from("invoices").insert({
        company_id: selectedCompany.id,
        month_period: salaryMonth,
        invoice_date: new Date().toISOString().split("T")[0],
        invoice_number: invoiceNumber,
        amount_received: 0,
        invoice_sent: false,
        printed: false,
        emailed: false,
        ...invoiceData
      });
    }
  };

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
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button onClick={handleSaveAllAttendance} variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save All Attendance
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Shift Report Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Day vs Night Shifts Chart */}
            <div>
              <h4 className="text-sm font-medium mb-4 text-center">Day vs Night Shifts</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Day Shifts", value: shiftReport.totals.day },
                      { name: "Night Shifts", value: shiftReport.totals.night },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--secondary))" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Shifts by Rank Chart */}
            <div>
              <h4 className="text-sm font-medium mb-4 text-center">Shifts by Rank</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "OIC", value: shiftReport.OIC.total },
                      { name: "SSO", value: shiftReport.SSO.total },
                      { name: "JSO", value: shiftReport.JSO.total },
                      { name: "LSO", value: shiftReport.LSO.total },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="hsl(var(--chart-1))" />
                    <Cell fill="hsl(var(--chart-2))" />
                    <Cell fill="hsl(var(--chart-3))" />
                    <Cell fill="hsl(var(--chart-4))" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

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
                  <th className="sticky left-0 z-10 bg-muted/50 p-2 text-left font-medium border-r min-w-[100px]">
                    Employee ID
                  </th>
                  <th className="p-2 text-left font-medium border-r bg-muted/50 min-w-[150px]">
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
                      <td className="sticky left-0 z-10 bg-background p-2 border-r text-sm">
                        {employee.employee_id}
                      </td>
                      <td className="bg-background p-2 font-medium border-r">
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
