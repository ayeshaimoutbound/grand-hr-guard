import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Utensils, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyCombobox } from "@/components/CompanyCombobox";

interface Company { id: string; company_name: string; location: string; }
interface Employee { id: string; employee_id: string; full_name: string; }
interface Vendor { id: string; vendor_name: string; contact: string | null; company_id: string | null; }
interface Rate { breakfast_rate: number; lunch_rate: number; dinner_rate: number; }
interface ChargeRow {
  employee_id: string;
  breakfast_count: number;
  lunch_count: number;
  dinner_count: number;
  manual: boolean;
  existingId?: string;
  vendor_id?: string | null;
}

export default function Food() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [location, setLocation] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [rate, setRate] = useState<Rate>({ breakfast_rate: 0, lunch_rate: 0, dinner_rate: 0 });
  const [rateId, setRateId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [rowSearch, setRowSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmp, setManualEmp] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [newVendor, setNewVendor] = useState({ vendor_name: "", contact: "" });

  const monthStart = `${month}-01`;

  useEffect(() => {
    (async () => {
      const [c, e, v] = await Promise.all([
        supabase.from("companies").select("id,company_name,location").order("company_name"),
        supabase.from("employees").select("id,employee_id,full_name").order("full_name"),
        supabase.from("food_vendors").select("*").order("vendor_name"),
      ]);
      setCompanies((c.data as any) || []);
      setEmployees((e.data as any) || []);
      setVendors((v.data as any) || []);
    })();
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    companies.filter(c => c.id === companyId).forEach(c => c.location && set.add(c.location));
    return Array.from(set);
  }, [companies, companyId]);

  const loadRoster = async () => {
    if (!companyId) { toast.error("Select a company"); return; }
    const [y, m] = month.split("-").map(Number);
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    // Load existing rate for company+location
    const { data: rates } = await supabase.from("food_rates").select("*")
      .eq("company_id", companyId)
      .order("effective_from", { ascending: false })
      .limit(50);
    const matched = (rates || []).find((r: any) => (r.location || "") === (location || "")) || (rates || [])[0];
    if (matched) {
      setRate({
        breakfast_rate: Number(matched.breakfast_rate) || 0,
        lunch_rate: Number(matched.lunch_rate) || 0,
        dinner_rate: Number(matched.dinner_rate) || 0,
      });
      setRateId(matched.id);
    } else {
      setRateId(null);
    }

    // Load attendance to find who worked in this company (for the month)
    const { data: att } = await supabase.from("attendance").select("employee_id")
      .eq("company_id", companyId)
      .gte("attendance_date", startDate).lte("attendance_date", endDate)
      .eq("present", true);
    const empIds = Array.from(new Set((att || []).map((a: any) => a.employee_id)));

    // Load existing food_charges for month
    const { data: existing } = await supabase.from("food_charges").select("*")
      .eq("company_id", companyId).eq("month", startDate);
    const byEmp: Record<string, any> = {};
    (existing || []).forEach((r: any) => { if ((r.location || "") === (location || "")) byEmp[r.employee_id] = r; });

    const rosterRows: ChargeRow[] = empIds.map(id => {
      const ex = byEmp[id];
      return {
        employee_id: id,
        breakfast_count: ex ? Number(ex.breakfast_count) : 0,
        lunch_count: ex ? Number(ex.lunch_count) : 0,
        dinner_count: ex ? Number(ex.dinner_count) : 0,
        manual: false,
        existingId: ex?.id,
        vendor_id: ex?.vendor_id,
      };
    });
    // Include manual entries not in roster
    Object.values(byEmp).forEach((ex: any) => {
      if (!empIds.includes(ex.employee_id)) {
        rosterRows.push({
          employee_id: ex.employee_id,
          breakfast_count: Number(ex.breakfast_count),
          lunch_count: Number(ex.lunch_count),
          dinner_count: Number(ex.dinner_count),
          manual: true,
          existingId: ex.id,
          vendor_id: ex.vendor_id,
        });
      }
    });
    setRows(rosterRows);
    if ((existing || [])[0]?.vendor_id) setVendorId((existing as any)[0].vendor_id);
  };

  const empName = (id: string) => {
    const e = employees.find(x => x.id === id);
    return e ? `${e.employee_id} — ${e.full_name}` : id;
  };

  const total = (r: ChargeRow) =>
    (r.breakfast_count * rate.breakfast_rate) +
    (r.lunch_count * rate.lunch_rate) +
    (r.dinner_count * rate.dinner_rate);

  const grand = rows.reduce((s, r) => s + total(r), 0);

  const updateRow = (i: number, patch: Partial<ChargeRow>) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const addManual = () => {
    if (!manualEmp) return;
    if (rows.find(r => r.employee_id === manualEmp)) { toast.error("Already in list"); return; }
    setRows(prev => [...prev, { employee_id: manualEmp, breakfast_count: 0, lunch_count: 0, dinner_count: 0, manual: true }]);
    setManualEmp(""); setManualOpen(false);
  };

  const removeRow = async (i: number) => {
    const r = rows[i];
    if (r?.existingId) {
      if (!confirm("Remove this saved food entry? The salary food advance deduction will also be removed.")) return;
      const { error } = await supabase.from("food_charges").delete().eq("id", r.existingId);
      if (error) { toast.error(error.message); return; }
      await supabase.from("food_advances").delete()
        .eq("employee_id", r.employee_id).eq("advance_date", monthStart);
      toast.success("Food entry removed — salary deduction updated");
    }
    setRows(prev => prev.filter((_, idx) => idx !== i));
  };

  const saveRate = async () => {
    if (!companyId) return;
    if (rateId) {
      await supabase.from("food_rates").update(rate as any).eq("id", rateId);
    } else {
      const { data } = await supabase.from("food_rates").insert({
        company_id: companyId, location: location || null,
        ...rate, created_by: user?.id,
      } as any).select().single();
      if (data) setRateId((data as any).id);
    }
    toast.success("Rates saved");
  };

  const saveAll = async () => {
    if (!companyId) { toast.error("Select a company"); return; }
    let n = 0;
    for (const r of rows) {
      const t = total(r);
      const payload: any = {
        employee_id: r.employee_id,
        company_id: companyId,
        location: location || null,
        month: monthStart,
        breakfast_count: r.breakfast_count,
        lunch_count: r.lunch_count,
        dinner_count: r.dinner_count,
        breakfast_rate: rate.breakfast_rate,
        lunch_rate: rate.lunch_rate,
        dinner_rate: rate.dinner_rate,
        total_amount: t,
        vendor_id: vendorId || null,
        manual_entry: r.manual,
        created_by: user?.id,
      };
      if (r.existingId) {
        await supabase.from("food_charges").update(payload).eq("id", r.existingId);
      } else if (t > 0) {
        await supabase.from("food_charges").insert(payload);
      } else continue;

      // Mirror into food_advances so salary engine picks it up. Use advance_date = monthStart.
      // Upsert-by-employee-per-month semantics: delete existing food_advances rows for that emp+month first.
      await supabase.from("food_advances").delete()
        .eq("employee_id", r.employee_id).eq("advance_date", monthStart);
      if (t > 0) {
        await supabase.from("food_advances").insert({
          employee_id: r.employee_id,
          company_id: companyId,
          advance_date: monthStart,
          amount: t,
          notes: `Food ${month}${vendorId ? " · vendor: " + (vendors.find(v => v.id === vendorId)?.vendor_name || "") : ""}`,
          created_by: user?.id,
        } as any);
      }
      n++;
    }
    toast.success(`Saved ${n} food entries. Total LKR ${grand.toLocaleString()}`);
    loadRoster();
  };

  const saveVendor = async () => {
    if (!newVendor.vendor_name) return;
    const { data, error } = await supabase.from("food_vendors").insert({
      vendor_name: newVendor.vendor_name,
      contact: newVendor.contact || null,
      company_id: companyId || null,
      created_by: user?.id,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    setVendors(prev => [...prev, data as any]);
    setVendorId((data as any).id);
    setNewVendor({ vendor_name: "", contact: "" });
    setVendorOpen(false);
    toast.success("Vendor added");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Utensils className="h-7 w-7" /> Food Charges</h1>
        <p className="text-muted-foreground">Record end-of-month food charges per employee by location. Totals flow to salaries as food deductions.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Company</Label>
            <CompanyCombobox
              value={companyId}
              onChange={(v) => {
                setCompanyId(v);
                const c = companies.find((x) => x.id === v);
                setLocation(c?.location || "");
              }}
              companies={companies}
              placeholder="Select company"
              showLocation
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={loadRoster}>Load Roster</Button>
          </div>
        </CardContent>
      </Card>

      {companyId && (
        <Card>
          <CardHeader><CardTitle>Meal Rates (LKR)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Breakfast</Label>
              <Input type="number" step="0.01" value={rate.breakfast_rate}
                onChange={(e) => setRate({ ...rate, breakfast_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Lunch</Label>
              <Input type="number" step="0.01" value={rate.lunch_rate}
                onChange={(e) => setRate({ ...rate, lunch_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Dinner</Label>
              <Input type="number" step="0.01" value={rate.dinner_rate}
                onChange={(e) => setRate({ ...rate, dinner_rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={saveRate}>Save Rates</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {companyId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <CardTitle>Employees ({rows.length})</CardTitle>
                <Input className="w-56" placeholder="Search employee..."
                  value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-64">
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="Food vendor (optional)" /></SelectTrigger>
                    <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => setVendorOpen(true)}><Plus className="h-4 w-4 mr-1" />Vendor</Button>
                <Button variant="outline" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4 mr-1" />Add employee</Button>
                <Button onClick={saveAll}><Save className="h-4 w-4 mr-1" />Save All</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roster loaded. Click "Load Roster" to pull employees who have attendance this month.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Breakfast</TableHead>
                    <TableHead className="text-right">Lunch</TableHead>
                    <TableHead className="text-right">Dinner</TableHead>
                    <TableHead className="text-right">Total (LKR)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => [r, i] as [ChargeRow, number])
                    .filter(([r]) => !rowSearch.trim() || empName(r.employee_id).toLowerCase().includes(rowSearch.trim().toLowerCase()))
                    .map(([r, i]) => (
                    <TableRow key={r.employee_id}>
                      <TableCell>
                        {empName(r.employee_id)}
                        {r.manual && <span className="ml-2 text-xs text-muted-foreground">(manual)</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" className="w-20 text-right ml-auto" value={r.breakfast_count}
                          onChange={(e) => updateRow(i, { breakfast_count: parseInt(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" className="w-20 text-right ml-auto" value={r.lunch_count}
                          onChange={(e) => updateRow(i, { lunch_count: parseInt(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="0" className="w-20 text-right ml-auto" value={r.dinner_count}
                          onChange={(e) => updateRow(i, { dinner_count: parseInt(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell className="text-right font-medium">{total(r).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/40">
                    <TableCell colSpan={4} className="text-right">Grand Total</TableCell>
                    <TableCell className="text-right">LKR {grand.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add manual employee */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee (not on roster)</DialogTitle>
            <DialogDescription>Charge food to an employee who wasn't on this month's attendance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={manualEmp} onValueChange={setManualEmp}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => !rows.find(r => r.employee_id === e.id)).map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.employee_id} — {e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
              <Button onClick={addManual}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add vendor */}
      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add food vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Vendor name</Label>
              <Input value={newVendor.vendor_name} onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact (optional)</Label>
              <Input value={newVendor.contact} onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVendorOpen(false)}>Cancel</Button>
              <Button onClick={saveVendor}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
