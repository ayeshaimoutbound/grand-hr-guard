import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, ChevronDown, ChevronUp, FileDown, Pencil } from "lucide-react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { computePayroll, PayrollLine, type CompanyRateRow, type AttendanceRow, type ManualDeductions } from "@/lib/salaryEngine";

interface ManualRow extends ManualDeductions {
  id?: string;
  notes?: string;
}

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
  const [search, setSearch] = useState("");
  const [dailyMinWage, setDailyMinWage] = useState<number>(1200);
  const [manualMap, setManualMap] = useState<Record<string, ManualRow>>({});
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<ManualRow>({});
  const { isSuperAdmin, isAdmin } = useAuth();
  const canEditManual = isSuperAdmin || isAdmin;

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const fetchData = async () => {
    const startDate = `${selectedMonth}-01`;
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

    const [employeesRes, companiesRes, attendanceRes, otRes, cashRes, foodRes, uniRes, settingsRes, manualRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("companies").select("id,company_name,pay_oic,pay_sso,pay_jso,pay_lso"),
      supabase.from("attendance").select("employee_id,company_id,rank,present").gte("attendance_date", startDate).lte("attendance_date", endDate).eq("present", true),
      supabase.from("overtime_entries").select("employee_id,amount").gte("ot_date", startDate).lte("ot_date", endDate),
      supabase.from("cash_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("food_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("uniform_advances").select("employee_id,amount").gte("advance_date", startDate).lte("advance_date", endDate),
      supabase.from("app_settings").select("value").eq("key", "daily_min_wage").maybeSingle(),
      supabase.from("salary_manual_deductions").select("*").eq("salary_month", startDate),
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

    const mMap: Record<string, ManualRow> = {};
    for (const r of (manualRes.data || []) as any[]) {
      mMap[r.employee_id] = {
        id: r.id,
        food: Number(r.food || 0),
        uniforms: Number(r.uniforms || 0),
        accommodation: Number(r.accommodation || 0),
        transport: Number(r.transport || 0),
        other: Number(r.other || 0),
        notes: r.notes || "",
      };
    }
    setManualMap(mMap);

    const { data: paidRows } = await supabase
      .from("salaries")
      .select("employee_id,is_paid")
      .eq("salary_month", startDate);
    const pMap: Record<string, boolean> = {};
    for (const r of (paidRows || []) as any[]) pMap[r.employee_id] = !!r.is_paid;
    setPaidMap(pMap);



    const result: Row[] = employees.map((emp) => {
      const payroll = computePayroll({
        employeeId: emp.id,
        attendance,
        companies,
        overtime,
        cashAdvances: cash,
        foodAdvances: food,
        uniformAdvances: uni,
        manualDeductions: mMap[emp.id],
        settings: {
          ot_hourly_rate: Number(emp.ot_hourly_rate ?? 225),
          normal_ot_hours: Number(emp.normal_ot_hours ?? 3),
          extended_ot_hours: Number(emp.extended_ot_hours ?? 6),
        },
        dailyMinWage: dmw,
      });
      return { employee: emp, payroll };
    }).filter(r => r.payroll.total_shifts > 0 || r.payroll.ot_pay > 0 || r.payroll.total_deductions > 0 || !!mMap[r.employee.id]);

    setRows(result);
  };

  const togglePaid = async (employeeId: string, next: boolean) => {
    const salaryMonth = `${selectedMonth}-01`;
    const { data: existing } = await supabase
      .from("salaries")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("salary_month", salaryMonth)
      .maybeSingle();

    const patch = { is_paid: next, paid_at: next ? new Date().toISOString() : null } as any;
    const { error } = existing
      ? await supabase.from("salaries").update(patch).eq("id", existing.id)
      : await supabase.from("salaries").insert([{ employee_id: employeeId, salary_month: salaryMonth, ...patch }]);

    if (error) { toast.error(error.message); return; }
    setPaidMap((prev) => ({ ...prev, [employeeId]: next }));
    toast.success(next ? "Marked as paid" : "Marked as unpaid");
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setEditForm(manualMap[emp.id] || {});
  };


  const saveManual = async () => {
    if (!editEmp) return;
    const payload: any = {
      employee_id: editEmp.id,
      salary_month: `${selectedMonth}-01`,
      food: Number(editForm.food || 0),
      uniforms: Number(editForm.uniforms || 0),
      accommodation: Number(editForm.accommodation || 0),
      transport: Number(editForm.transport || 0),
      other: Number(editForm.other || 0),
      notes: editForm.notes || null,
    };
    const { error } = await supabase
      .from("salary_manual_deductions")
      .upsert(payload, { onConflict: "employee_id,salary_month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Manual deductions saved");
    setEditEmp(null);
    fetchData();
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
      "Gross Pay": p.gross_pay.toFixed(2),
      "Basic": p.epf_basic.toFixed(2),
      "OT": (p.basic_plus_ot + p.ot_extended).toFixed(2),
      "Incentive": p.allowance.toFixed(2),
      "EPF 8%": p.epf_8.toFixed(2),
      "EPF 12% (Employer)": p.epf_12.toFixed(2),
      "ETF 3% (Employer)": p.etf_3.toFixed(2),
      "Employer Total": p.employer_total.toFixed(2),

      "Overtime Pay": p.ot_pay.toFixed(2),
      "Cash Advance": p.cash_advance.toFixed(2),
      "Food Advance": p.food_advance.toFixed(2),
      "Uniform Advance": p.uniform_advance.toFixed(2),
      "Manual - Food": p.manual_food.toFixed(2),
      "Manual - Uniforms": p.manual_uniforms.toFixed(2),
      "Manual - Accommodation": p.manual_accommodation.toFixed(2),
      "Manual - Transport": p.manual_transport.toFixed(2),
      "Manual - Other": p.manual_other.toFixed(2),
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
      <table><tr><th>Description</th><th style="text-align:right">Amount (LKR)</th></tr>
      ${p.breakdown.map(b => `<tr><td colspan="2" style="background:#f9f9f9"><b>${b.company_name} – ${b.rank}</b> (${b.shifts} shifts @ LKR ${b.rate.toFixed(2)})</td></tr>
        <tr><td style="padding-left:24px">Earnings</td><td style="text-align:right">${b.amount.toFixed(2)}</td></tr>`).join("")}
      <tr class="tot"><td>Total Shifts</td><td style="text-align:right">${p.total_shifts}</td></tr>
      <tr class="tot"><td>Gross Pay</td><td style="text-align:right">${p.gross_pay.toFixed(2)}</td></tr>
      <tr><td>Basic</td><td style="text-align:right">${p.epf_basic.toFixed(2)}</td></tr>
      <tr><td>OT</td><td style="text-align:right">${(p.basic_plus_ot + p.ot_extended).toFixed(2)}</td></tr>
      <tr><td>Incentive</td><td style="text-align:right">${p.allowance.toFixed(2)}</td></tr>
      <tr><td>Overtime Pay</td><td style="text-align:right">${p.ot_pay.toFixed(2)}</td></tr>
      <tr><td colspan="2"><b>Deductions</b></td></tr>
      <tr><td>EPF 8%</td><td style="text-align:right">${p.epf_8.toFixed(2)}</td></tr>
      <tr><td>Cash Advance</td><td style="text-align:right">${p.cash_advance.toFixed(2)}</td></tr>
      <tr><td>Food Advance</td><td style="text-align:right">${p.food_advance.toFixed(2)}</td></tr>
      <tr><td>Uniform Advance</td><td style="text-align:right">${p.uniform_advance.toFixed(2)}</td></tr>
      ${p.manual_food ? `<tr><td>Food (Manual)</td><td style="text-align:right">${p.manual_food.toFixed(2)}</td></tr>` : ""}
      ${p.manual_uniforms ? `<tr><td>Uniforms (Manual)</td><td style="text-align:right">${p.manual_uniforms.toFixed(2)}</td></tr>` : ""}
      ${p.manual_accommodation ? `<tr><td>Accommodation</td><td style="text-align:right">${p.manual_accommodation.toFixed(2)}</td></tr>` : ""}
      ${p.manual_transport ? `<tr><td>Transport</td><td style="text-align:right">${p.manual_transport.toFixed(2)}</td></tr>` : ""}
      ${p.manual_other ? `<tr><td>Other Deductions</td><td style="text-align:right">${p.manual_other.toFixed(2)}</td></tr>` : ""}
      <tr class="tot"><td>Total Deductions</td><td style="text-align:right">${p.total_deductions.toFixed(2)}</td></tr>
      <tr class="net ${p.net_pay < 0 ? 'neg' : ''}"><td>NET PAY</td><td style="text-align:right">LKR ${p.net_pay.toFixed(2)}</td></tr>
      <tr><td colspan="2" style="background:#f9f9f9"><b>Employer Contributions</b> (company cost — not deducted from the employee)</td></tr>
      <tr><td>EPF 12% (Employer)</td><td style="text-align:right">${p.epf_12.toFixed(2)}</td></tr>
      <tr><td>ETF 3% (Employer)</td><td style="text-align:right">${p.etf_3.toFixed(2)}</td></tr>
      <tr class="tot"><td>Total Employer Contribution</td><td style="text-align:right">${p.employer_total.toFixed(2)}</td></tr>
      </table></body></html>`);

    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const totalGross = rows.reduce((s, r) => s + r.payroll.gross_pay, 0);
  const totalNet = rows.reduce((s, r) => s + r.payroll.net_pay, 0);
  const filteredRows = rows.filter(({ employee: e }) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salaries</h1>
          <p className="text-muted-foreground">Auto-calculated payroll · Daily min wage: LKR {dailyMinWage}</p>
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
                <p className="text-2xl font-bold">LKR {totalGross.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Net</p>
                <p className="text-2xl font-bold text-emerald-600">LKR {totalNet.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Monthly Payroll Report</CardTitle>
            <Input
              placeholder="Search employee by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
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
                <TableHead className="text-center">Paid</TableHead>
                <TableHead></TableHead>

              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">No payroll data for selected month</TableCell></TableRow>
              ) : filteredRows.map(({ employee: e, payroll: p }) => (
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
                      <TableCell className="text-right">LKR {p.gross_pay.toFixed(2)}</TableCell>
                      <TableCell className="text-right">LKR {p.epf_8.toFixed(2)}</TableCell>
                      <TableCell className="text-right">LKR {p.ot_pay.toFixed(2)}</TableCell>
                      <TableCell className="text-right">LKR {p.total_deductions.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.net_pay < 0 ? (
                          <Badge variant="destructive">LKR {p.net_pay.toFixed(2)}</Badge>
                        ) : (
                          <span>LKR {p.net_pay.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={!!paidMap[e.id]}
                            onCheckedChange={(v) => togglePaid(e.id, v)}
                            disabled={!canEditManual}
                            aria-label="Toggle salary paid"
                          />
                          <span className={`text-[10px] ${paidMap[e.id] ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {paidMap[e.id] ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>

                        <div className="flex gap-1">
                          {canEditManual && (
                            <Button variant="ghost" size="sm" title="Edit manual deductions" onClick={() => openEdit(e)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => printPayslip({ employee: e, payroll: p })}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={12} className="bg-muted/40">
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div><span className="text-muted-foreground">Basic:</span> <b>LKR {p.epf_basic.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">OT:</span> <b>LKR {(p.basic_plus_ot + p.ot_extended).toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Incentive:</span> <b>LKR {p.allowance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Cash Adv:</span> <b>LKR {p.cash_advance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Food Adv:</span> <b>LKR {p.food_advance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Uniform Adv:</span> <b>LKR {p.uniform_advance.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Manual Food:</span> <b>LKR {p.manual_food.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Manual Uniforms:</span> <b>LKR {p.manual_uniforms.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Accommodation:</span> <b>LKR {p.manual_accommodation.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Transport:</span> <b>LKR {p.manual_transport.toFixed(2)}</b></div>
                              <div><span className="text-muted-foreground">Other:</span> <b>LKR {p.manual_other.toFixed(2)}</b></div>
                            </div>
                            {p.breakdown.length > 1 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Per-Company Breakdown</h4>
                                <div className="space-y-1">
                                  {p.breakdown.map(b => (
                                    <div key={b.company_id + b.rank} className="flex justify-between text-sm bg-background p-2 rounded">
                                      <span>{b.company_name} ({b.rank})</span>
                                      <span>{b.shifts} × LKR {b.rate.toFixed(2)} = <b>LKR {b.amount.toFixed(2)}</b></span>
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

      <Dialog open={!!editEmp} onOpenChange={(o) => !o && setEditEmp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manual Deductions — {editEmp?.full_name}
              <div className="text-xs font-normal text-muted-foreground mt-1">
                {new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(["food","uniforms","accommodation","transport","other"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k} (LKR)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={(editForm as any)[k] ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmp(null)}>Cancel</Button>
            <Button onClick={saveManual}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
