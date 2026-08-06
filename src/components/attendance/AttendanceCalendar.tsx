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
import { Input } from "@/components/ui/input";
import { Download, Save, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PDF_HEADER_STYLES, getPdfHeaderHtml } from "@/lib/pdfHeader";
import OvertimeSection from "@/components/attendance/OvertimeSection";
import { EmployeeCombobox } from "@/components/EmployeeCombobox";

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
  location?: string;
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
  isAdmin?: boolean;
}

export default function AttendanceCalendar({
  selectedCompany,
  selectedMonth,
  employees,
  attendanceRecords,
  onRefresh,
  isSuperAdmin,
  isAdmin = false,
}: AttendanceCalendarProps) {
  const canEdit = isSuperAdmin || isAdmin;
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedRank, setSelectedRank] = useState<"OIC" | "SSO" | "JSO" | "LSO" | "">("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const daysInMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  ).getDate();

  const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getAttendance = (
    employeeId: string,
    rank: string,
    date: number,
    shift: "Day" | "Night"
  ) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

    return attendanceRecords.find(
      (record) =>
        record.employee_id === employeeId &&
        record.rank === rank &&
        record.attendance_date === dateStr &&
        record.shift_type === shift
    );
  };

  const handleMarkAttendance = async (
    employeeId: string,
    rank: string,
    date: number,
    shift: "Day" | "Night"
  ) => {
    const dateStr = `${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

    const existing = getAttendance(employeeId, rank, date, shift);

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
          rank: rank as "OIC" | "SSO" | "JSO" | "LSO",
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

  const monthDateRange = () => {
    const start = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
    const end = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  };

  const handleRemoveEmployeeFromMonth = async (employeeId: string, rank: string, name: string) => {
    if (!confirm(`Remove ALL ${rank} attendance for ${name} in this month at ${selectedCompany.company_name}? This cannot be undone.`)) return;
    const { start, end } = monthDateRange();
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("company_id", selectedCompany.id)
      .eq("employee_id", employeeId)
      .eq("rank", rank as "OIC" | "SSO" | "JSO" | "LSO")
      .gte("attendance_date", start)
      .lte("attendance_date", end);
    if (error) { toast.error("Error removing employee: " + error.message); return; }
    toast.success("Employee attendance removed for this month");
    onRefresh();
  };

  const handleChangeRank = async (
    employeeId: string,
    oldRank: string,
    newRank: "OIC" | "SSO" | "JSO" | "LSO"
  ) => {
    if (oldRank === newRank) return;
    const { start, end } = monthDateRange();
    const { error } = await supabase
      .from("attendance")
      .update({ rank: newRank })
      .eq("company_id", selectedCompany.id)
      .eq("employee_id", employeeId)
      .eq("rank", oldRank as "OIC" | "SSO" | "JSO" | "LSO")
      .gte("attendance_date", start)
      .lte("attendance_date", end);
    if (error) { toast.error("Error updating rank: " + error.message); return; }
    toast.success(`Rank updated to ${newRank}`);
    onRefresh();
  };

  // One row per employee + rank combination (an employee can serve in several ranks)
  const rosterRows = (() => {
    const seen = new Map<string, { employee: Employee; rank: string }>();
    attendanceRecords.forEach((r) => {
      const emp = employees.find((e) => e.id === r.employee_id);
      if (!emp) return;
      const key = `${r.employee_id}|${r.rank}`;
      if (!seen.has(key)) seen.set(key, { employee: emp, rank: r.rank });
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.employee.full_name.localeCompare(b.employee.full_name) || a.rank.localeCompare(b.rank)
    );
  })();

  const calculateEmployeeStats = (employeeId: string, rank?: string) => {
    const records = attendanceRecords.filter(
      (r) => r.employee_id === employeeId && r.present && (rank ? r.rank === rank : true)
    );

    const totalShifts = records.length;

    return { totalShifts };
  };

  const getEmployeeRanks = (employeeId: string) =>
    Array.from(
      new Set(attendanceRecords.filter((r) => r.employee_id === employeeId).map((r) => r.rank))
    );

  const calculateTotals = () => {
    const totalShifts = attendanceRecords.filter((r) => r.present).length;
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

  const handleExportPDF = () => {
    const monthLabel = selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const rows = rosterRows.map(({ employee, rank }) => {
      const stats = calculateEmployeeStats(employee.id, rank);
      return `<tr><td>${employee.employee_id}</td><td>${employee.full_name}</td><td>${rank}</td><td style="text-align:right">${stats.totalShifts}</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance ${selectedCompany.company_name} ${monthLabel}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:28px;color:#000;font-size:12px;}
      ${PDF_HEADER_STYLES}
      h2{font-size:14px;margin:14px 0 8px;color:#014d3a;}
      table{width:100%;border-collapse:collapse;margin-top:10px;}
      th,td{border:1px solid #cfd8d6;padding:6px;text-align:left;}
      th{background:#e6f4ef;color:#014d3a;}
      .summary td{padding:4px 8px;}
      .meta{margin:4px 0 12px;padding:8px 12px;background:#f4faf7;border-left:3px solid #00855e;}
      .calendar{font-size:8px;table-layout:fixed;}
      .calendar th,.calendar td{padding:2px;text-align:center;}
      .calendar th.day,.calendar td.day{width:16px;}
      .calendar .sticky-name{width:110px;text-align:left;font-size:8.5px;}
      .calendar .eid{color:#666;font-size:7px;}
      .calendar .off{color:#bbb;}
      .k{display:inline-block;min-width:9px;font-weight:700;}
      .k.d{color:#014d3a;}
      .k.n{color:#8a4b00;}
      .legend{font-size:10px;margin:6px 0;}
      @page{size:A4 landscape;margin:10mm;}
    </style></head><body>
      ${getPdfHeaderHtml("ATTENDANCE REPORT")}
      <div class="meta">
        <strong>Company:</strong> ${selectedCompany.company_name}<br/>
        <strong>Location:</strong> ${selectedCompany.location || "-"}<br/>
        <strong>Period:</strong> ${monthLabel}
      </div>

      <h2>Shift Summary</h2>
      <table class="summary">
        <thead><tr><th>Rank</th><th style="text-align:right">Day</th><th style="text-align:right">Night</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${(["OIC","SSO","JSO","LSO"] as const).filter(r => shiftReport[r].total > 0).map(r=>`<tr><td>${r}</td><td style="text-align:right">${shiftReport[r].day}</td><td style="text-align:right">${shiftReport[r].night}</td><td style="text-align:right">${shiftReport[r].total}</td></tr>`).join("")}
          <tr><td><strong>Totals</strong></td><td style="text-align:right"><strong>${shiftReport.totals.day}</strong></td><td style="text-align:right"><strong>${shiftReport.totals.night}</strong></td><td style="text-align:right"><strong>${shiftReport.totals.total}</strong></td></tr>
        </tbody>
      </table>

      <h2>Employee Shifts</h2>
      <table>
        <thead><tr><th>Employee ID</th><th>Name</th><th>Rank</th><th style="text-align:right">Total Shifts</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center">No records</td></tr>'}</tbody>
      </table>

      <h2>Daily Attendance Calendar</h2>
      <p class="legend"><span class="k d">D</span> Day shift &nbsp; <span class="k n">N</span> Night shift &nbsp; <span class="k">–</span> Off</p>
      <table class="calendar">
        <thead>
          <tr>
            <th class="sticky-name">Employee</th>
            <th>Rank</th>
            ${dates.map((d) => `<th class="day">${d}</th>`).join("")}
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${
            rosterRows.length
              ? rosterRows.map(({ employee, rank }) => {
                  const cells = dates.map((d) => {
                    const day = getAttendance(employee.id, rank, d, "Day");
                    const night = getAttendance(employee.id, rank, d, "Night");
                    const marks: string[] = [];
                    if (day?.present) marks.push('<span class="k d">D</span>');
                    if (night?.present) marks.push('<span class="k n">N</span>');
                    return `<td class="day">${marks.join("") || '<span class="off">–</span>'}</td>`;
                  }).join("");
                  const stats = calculateEmployeeStats(employee.id, rank);
                  return `<tr><td class="sticky-name">${employee.full_name}<br/><span class="eid">${employee.employee_id}</span></td><td>${rank}</td>${cells}<td style="text-align:right"><strong>${stats.totalShifts}</strong></td></tr>`;
                }).join("")
              : `<tr><td colspan="${dates.length + 3}" style="text-align:center">No records</td></tr>`
          }
        </tbody>
      </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-ups blocked. Allow pop-ups to export."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  // Get unique employees who have attendance in this company/month
  const activeEmployees = employees.filter((emp) =>
    attendanceRecords.some((record) => record.employee_id === emp.id)
  );

  const filteredRosterRows = rosterRows.filter(({ employee, rank }) => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return true;
    return employee.full_name.toLowerCase().includes(q) ||
      employee.employee_id.toLowerCase().includes(q) ||
      rank.toLowerCase().includes(q);
  });

  const handleAddEmployeeToCalendar = async () => {
    if (!selectedEmployee || !selectedRank) {
      toast.error("Please select both employee and rank");
      return;
    }

    if (getEmployeeRanks(selectedEmployee).includes(selectedRank)) {
      toast.error("This employee is already on the calendar with that rank");
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

  // An employee may be added again under a different rank, so all employees stay selectable
  const availableEmployees = employees;


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
    // An employee may have worked several ranks this month — pay each rank at its own rate
    const rateFor = (rank: string) => {
      switch (rank) {
        case "OIC": return selectedCompany.pay_oic;
        case "SSO": return selectedCompany.pay_sso;
        case "JSO": return selectedCompany.pay_jso;
        case "LSO": return selectedCompany.pay_lso;
        default: return 0;
      }
    };

    const ranks = getEmployeeRanks(employeeId);
    let totalShifts = 0;
    let grossShiftTotal = 0;
    ranks.forEach((rank) => {
      const shifts = calculateEmployeeStats(employeeId, rank).totalShifts;
      totalShifts += shifts;
      grossShiftTotal += shifts * rateFor(rank);
    });
    const stats = { totalShifts };
    const payPerShift = totalShifts > 0 ? grossShiftTotal / totalShifts : 0;

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
          {canEdit && (
            <Button onClick={handleSaveAllAttendance} variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save All Attendance
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
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

      {/* Overtime Logging */}
      <OvertimeSection
        companyId={selectedCompany.id}
        selectedMonth={selectedMonth}
        employees={activeEmployees as any}
      />

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
                <EmployeeCombobox
                  value={selectedEmployee}
                  onChange={setSelectedEmployee}
                  employees={availableEmployees}
                  placeholder="Search & choose employee"
                />
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Rank</label>
                <Select value={selectedRank} onValueChange={(value) => setSelectedRank(value as "OIC" | "SSO" | "JSO" | "LSO")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {(((selectedCompany as any).active_ranks?.length ? (selectedCompany as any).active_ranks : ["OIC", "SSO", "JSO", "LSO"]) as string[]).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
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
        <CardContent className="p-3 pb-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search employees by name or ID"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
          </div>
        </CardContent>
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
                {filteredRosterRows.map(({ employee, rank: employeeRank }) => {
                  const stats = calculateEmployeeStats(employee.id, employeeRank);
                  return (
                    <tr key={`${employee.id}-${employeeRank}`} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-background p-2 border-r text-sm">
                        {employee.employee_id}
                      </td>
                      <td className="bg-background p-2 font-medium border-r">
                        <div className="flex items-center gap-2">
                          <span>{employee.full_name}</span>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                              title={`Remove this employee's ${employeeRank} attendance for this month`}
                              onClick={() => handleRemoveEmployeeFromMonth(employee.id, employeeRank, employee.full_name)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="bg-background p-2 text-center font-medium border-r">
                        {canEdit ? (
                          <Select
                            value={employeeRank !== "-" ? employeeRank : undefined}
                            onValueChange={(v) => handleChangeRank(employee.id, employeeRank, v as any)}
                          >
                            <SelectTrigger className="h-7 w-[80px] mx-auto">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OIC">OIC</SelectItem>
                              <SelectItem value="SSO">SSO</SelectItem>
                              <SelectItem value="JSO">JSO</SelectItem>
                              <SelectItem value="LSO">LSO</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{employeeRank}</Badge>
                        )}
                      </td>
                      {dates.map((date) =>
                        ["Day", "Night"].map((shift) => {
                          const attendance = getAttendance(employee.id, employeeRank, date, shift as "Day" | "Night");

                          return (
                            <td
                              key={`${date}-${shift}`}
                              className="p-1 text-center border-r"
                            >
                              {attendance?.present ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-lg font-semibold">1</span>
                                  {canEdit && (
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
                                      employeeRank,
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
