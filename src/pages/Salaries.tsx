import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { computePayroll, PayrollLine, type CompanyRateRow, type AttendanceRow } from "@/lib/salaryEngine";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  bank_name?: string;
  branch?: string;
  account_number?: string;
  epf_no?: string;
  ot_hourly_rate?: number;
  normal_ot_hours?: number;
  extended_ot_hours?: number;
}

interface Row { employee: Employee; payroll: PayrollLine; }

export default function Salaries() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dailyMinWage, setDailyMinWage] = useState<number>(1200);
  const { isSuperAdmin } = useAuth();

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const fetchData = async () => {
    const startDate = `${selectedMonth}-01`;
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

    const [employeesRes, companiesRes, attendanceRes, otRes, cashRes, foodRes, uniRes, settingsRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("companies").select("id,company_name,pay_oic,pay_sso,pay_jso,pay_lso"),
      supabase.from("attendance").select("employee_id,company_id,rank,present").gte("attendance_date", startDate).lte("attendance_date", endDate).eq("present", true),
      supabase.from("overtime_entries").select("employee_id,amount").gte("ot_date", startDate).lte("ot_date", endDate),
      supabase.from("cash_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("food_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("uniform_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("app_settings").select("value").eq("key", "daily_min_wage").maybeSingle(),
    ]);

    if (employeesRes.error || companiesRes.error || attendanceRes.error) {
      toast.error("Error fetching salary data");
      return;
    }
    const dmw = parseFloat(settingsRes.data?.value || "1200") || 1200;
    setDailyMinWage(dmw);

    const employees = (employeesRes.data || []) as Employee[];
    const companies = (companiesRes.data || []) as CompanyRateRow[];
    const attendance = (attendanceRes.data || []) as AttendanceRow[];
    const overtime = (otRes.data || []) as any[];
    const cash = (cashRes.data || []) as any[];
    const food = (foodRes.data || []) as any[];
    const uni = (uniRes.data || []) as any[];

    const result: Row[] = employees.map((emp) => {
      const payroll = computePayroll({
        employeeId: emp.id,
        attendance,
        companies,
        overtime,
        cashAdvances: cash,
        foodAdvances: food,
        uniformAdvances: uni,
        settings: {
          ot_hourly_rate: Number(emp.ot_hourly_rate ?? 225),
          normal_ot_hours: Number(emp.normal_ot_hours ?? 3),
          extended_ot_hours: Number(emp.extended_ot_hours ?? 6),
        },
        dailyMinWage: dmw,
      });
      return { employee: emp, payroll };
    }).filter(r => r.payroll.total_shifts > 0 || r.payroll.ot_pay > 0 || r.payroll.total_deductions > 0);

    setRows(result);
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const exportExcel = () => {
    if (!rows.length) { toast.error("No data to export"); return; }
    const data = rows.map(({ employee: e, payroll: p }) => ({
      "Employee ID": e.employee_id,
      "Name": e.full_name,
      "Total Shifts": p.total_shifts,
      "EPF Days": p.epf_days,
      "Extra Days": p.extra_days,
      "Gross Pay": p.gross_pay.toFixed(2),
      "EPF Basic": p.epf_basic.toFixed(2),
      "Basic+OT": p.basic_plus_ot.toFixed(2),
      "OT (Extended)": p.ot_extended.toFixed(2),
      "Annual Leave+Allowance": p.allowance.toFixed(2),
      "EPF 8%": p.epf_8.toFixed(2),
      "Overtime Pay": p.ot_pay.toFixed(2),
      "Cash Advance": p.cash_advance.toFixed(2),
      "Food Advance": p.food_advance.toFixed(2),
      "Uniform Advance": p.uniform_advance.toFixed(2),
      "Total Deductions": p.total_deductions.toFixed(2),
      "Net Pay": p.net_pay.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    const label = new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" });
    XLSX.writeFile(wb, `Payroll_${label}.xlsx`);
    toast.success("Exported");
  };

  const printPayslip = (r: Row) => {
    if (!isSuperAdmin) { toast.error("Only Super Admin can print payslips"); return; }
    const w = window.open("", "_blank"); if (!w) return;
    const { employee: e, payroll: p } = r;
    const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
    w.document.write(`<!DOCTYPE html><html><head><title>Salary Slip - ${e.full_name}</title>
      <style>body{font-family:Arial;padding:30px;font-size:12px}h1{text-align:center;color:#014d3a}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ccc;padding:6px}
      th{background:#e6f4ef}.tot{font-weight:bold;background:#f4faf7}.net{background:#e8f5e9;font-size:14px;font-weight:bold}
      .neg{color:#b91c1c}</style></head><body>
      <div style="text-align:center"><img src="/logo.png" style="width:70px"><h1>SALARY SLIP</h1>
      <p>${monthLabel}</p></div>
      <p><b>Employee:</b> ${e.full_name} (${e.employee_id})${e.epf_no ? ` &nbsp; <b>EPF:</b> ${e.epf_no}` : ""}</p>
      <p><b>Bank:</b> ${e.bank_name || "-"} – ${e.branch || "-"} &nbsp; <b>A/C:</b> ${e.account_number || "-"}</p>
      <table><tr><th>Description</th><th style="text-align:right">Amount (Rs.)</th></tr>
      ${p.breakdown.map(b => `<tr><td colspan="2" style="background:#f9f9f9"><b>${b.company_name} – ${b.rank}</b> (${b.shifts} shifts @ Rs. ${b.rate.toFixed(2)})</td></tr>
        <tr><td style="padding-left:24px">Earnings</td><td style="text-align:right">${b.amount.toFixed(2)}</td></tr>`).join("")}
      <tr class="tot"><td>Total Shifts</td><td style="text-align:right">${p.total_shifts}</td></tr>
      <tr class="tot"><td>Gross Pay</td><td style="text-align:right">${p.gross_pay.toFixed(2)}</td></tr>
      <tr><td>EPF Days</td><td style="text-align:right">${p.epf_days}</td></tr>
      <tr><td>Extra Days</td><td style="text-align:right">${p.extra_days}</td></tr>
      <tr><td>EPF Basic (${p.epf_days} × Rs.${dailyMinWage})</td><td style="text-align:right">${p.epf_basic.toFixed(2)}</td></tr>
      <tr><td>Basic + OT</td><td style="text-align:right">${p.basic_plus_ot.toFixed(2)}</td></tr>
      <tr><td>OT for Extended Days</td><td style="text-align:right">${p.ot_extended.toFixed(2)}</td></tr>
      <tr><td>Annual Leave + Allowance</td><td style="text-align:right">${p.allowance.toFixed(2)}</td></tr>
      <tr><td>Overtime Pay</td><td style="text-align:right">${p.ot_pay.toFixed(2)}</td></tr>
      <tr><td colspan="2"><b>Deductions</b></td></tr>
      <tr><td>EPF 8%</td><td style="text-align:right">${p.epf_8.toFixed(2)}</td></tr>
      <tr><td>Cash Advance</td><td style="text-align:right">${p.cash_advance.toFixed(2)}</td></tr>
      <tr><td>Food Advance</td><td style="text-align:right">${p.food_advance.toFixed(2)}</td></tr>
      <tr><td>Uniform Advance</td><td style="text-align:right">${p.uniform_advance.toFixed(2)}</td></tr>
      <tr class="tot"><td>Total Deductions</td><td style="text-align:right">${p.total_deductions.toFixed(2)}</td></tr>
      <tr class="net ${p.net_pay < 0 ? 'neg' : ''}"><td>NET PAY</td><td style="text-align:right">Rs. ${p.net_pay.toFixed(2)}</td></tr>
      </table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const totalGross = rows.reduce((s, r) => s + r.payroll.gross_pay, 0);
  const totalNet = rows.reduce((s, r) => s + r.payroll.net_pay, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salaries</h1>
          <p className="text-muted-foreground">Auto-calculated payroll · Daily min wage: Rs. {dailyMinWage}</p>
        </div>
        <Button variant="outline" onClick={exportExcel}>
          <FileDown className="h-4 w-4 mr-2" /> Export to Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Select Month</Label>
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-6 items-end">
              <div>
                <p className="text-sm text-muted-foreground">Total Gross</p>
                <p className="text-2xl font-bold">Rs. {totalGross.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Net</p>
                <p className="text-2xl font-bold text-emerald-600">Rs. {totalNet.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>Monthly Payroll Report</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Shifts</TableHead>
                <TableHead className="text-right">EPF Days</TableHead>
                <TableHead className="text-right">Extra</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">EPF 8%</TableHead>
                <TableHead className="text-right">OT Pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">No payroll data for selected month</TableCell></TableRow>
              ) : rows.map(({ employee: e, payroll: p }) => (
                <Collapsible key={e.id} asChild>
                  <>
                    <TableRow>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => toggle(e.id)}>
                            {expanded.has(e.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{e.full_name}</div>
                        <div className="text-xs text-muted-foreground">{e.employee_id}</div>
                      </TableCell>
                      <TableCell className="text-right">{p.total_shifts}</TableCell>
                      <TableCell className="text-right">{p.epf_days}</TableCell>
                      <TableCell className="text-right">{p.extra_days}</TableCell>
                      <TableCell className="text-right">Rs. {p.gross_pay.toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {p.epf_8.toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {p.ot_pay.toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {p.total_deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.net_pay < 0 ? (
                          <Badge variant="destructive">Rs. {p.net_pay.toFixed(2)}</Badge>
                        ) : (
                          <span>Rs. {p.net_pay.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => printPayslip({ employee: e, payroll: p })}>
                            <Printer className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={11} className="bg-muted/40">
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div><span className="text-muted-foreground">EPF Basic:</span> <b>Rs. {p.epf_basic.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Basic+OT:</span> <b>Rs. {p.basic_plus_ot.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">OT (Extended):</span> <b>Rs. {p.ot_extended.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Annual Leave+Allowance:</span> <b>Rs. {p.allowance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Cash Adv:</span> <b>Rs. {p.cash_advance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Food Adv:</span> <b>Rs. {p.food_advance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Uniform Adv:</span> <b>Rs. {p.uniform_advance.toFixed(2)}</b></div>
                            </div>
                            {p.breakdown.length > 1 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Per-Company Breakdown</h4>
                                <div className="space-y-1">
                                  {p.breakdown.map(b => (
                                    <div key={b.company_id + b.rank} className="flex justify-between text-sm bg-background p-2 rounded">
                                      <span>{b.company_name} ({b.rank})</span>
                                      <span>{b.shifts} × Rs. {b.rate.toFixed(2)} = <b>Rs. {b.amount.toFixed(2)}</b></span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
