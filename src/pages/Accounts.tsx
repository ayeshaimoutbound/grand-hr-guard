import { useEffect, useMemo, useState } from "react";
import { toDateStr, toMonthStr } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet, Receipt, BarChart3, Settings, Banknote, UtensilsCrossed, Shirt, Landmark } from "lucide-react";
import EmployerContributionsTab from "@/components/accounts/EmployerContributionsTab";
import { fetchEmployerContributions, sumContributions } from "@/lib/employerContributions";


import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Company { id: string; company_name: string; }
interface Employee { id: string; full_name: string; employee_id: string; }

export default function Accounts() {
  const [tab, setTab] = useState("payments");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accounts</h1>
        <p className="text-muted-foreground">Invoice payments, advances, expenses & monthly overview</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6 max-w-4xl">
          <TabsTrigger value="payments"><Wallet className="h-4 w-4 mr-1" /> Payments</TabsTrigger>
          <TabsTrigger value="advances"><Banknote className="h-4 w-4 mr-1" /> Advances</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-1" /> Expenses</TabsTrigger>
          <TabsTrigger value="contributions"><Landmark className="h-4 w-4 mr-1" /> EPF &amp; ETF</TabsTrigger>
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="advances"><AdvancesTab /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        <TabsContent value="contributions"><EmployerContributionsTab /></TabsContent>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>

      </Tabs>
    </div>
  );
}

/* ============== PAYMENTS TAB ============== */
function PaymentsTab() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, companies(company_name, location)")
      .order("invoice_date", { ascending: false });
    setInvoices(data || []);
  };
  useEffect(() => { load(); }, []);

  const statusFor = (inv: any) => {
    const received = Number(inv.amount_received || 0);
    if (received <= 0) return "Unpaid";
    if (received + 0.01 < Number(inv.amount_to_collect)) return "Partial";
    return "Paid";
  };

  const filtered = invoices.filter(i => {
    const q = search.trim().toLowerCase();
    if (q && !(
      (i.invoice_number || "").toLowerCase().includes(q) ||
      (i.companies?.company_name || "").toLowerCase().includes(q) ||
      (i.companies?.location || "").toLowerCase().includes(q)
    )) return false;
    if (filter === "all") return true;
    const s = statusFor(i).toLowerCase();
    return filter === s || (filter === "partial" && s === "partial");
  });

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Invoice Payments</CardTitle>
        <div className="flex items-center gap-2">
          <Input className="w-56" placeholder="Search invoice / company..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">Use the <b>Invoices</b> page to record payments. This tab is a read-only ledger.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No invoices</TableCell></TableRow>
            ) : filtered.map(inv => {
              const received = Number(inv.amount_received || 0);
              const balance = Number(inv.amount_to_collect) - received;
              const status = statusFor(inv);
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.companies?.company_name}</TableCell>
                  <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">LKR {Number(inv.amount_to_collect).toLocaleString()}</TableCell>
                  <TableCell className="text-right">LKR {received.toLocaleString()}</TableCell>
                  <TableCell className="text-right">LKR {balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={status === "Paid" ? "default" : status === "Partial" ? "secondary" : "destructive"}>
                      {status === "Partial" ? "Partially Paid" : status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ============== ADVANCES TAB ============== */
function AdvancesTab() {
  const [kind, setKind] = useState<"cash" | "food" | "uniform">("cash");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [advSearch, setAdvSearch] = useState("");
  const visibleRows = rows.filter(r => {
    const q = advSearch.trim().toLowerCase();
    if (!q) return true;
    return `${r.employees?.full_name || ""} ${r.employees?.employee_id || ""} ${r.notes || ""} ${r.companies?.company_name || ""}`
      .toLowerCase().includes(q);
  });
  const [form, setForm] = useState({ employee_id: "", company_id: "", advance_date: format(new Date(), "yyyy-MM-dd"), amount: "", notes: "" });

  const table = kind === "cash" ? "cash_advances" : kind === "food" ? "food_advances" : "uniform_advances";

  const load = async () => {
    const [emps, cos, ads] = await Promise.all([
      supabase.from("employees").select("id, full_name, employee_id").order("full_name"),
      supabase.from("companies").select("id, company_name").order("company_name"),
      supabase.from(table as any).select("*, employees(full_name, employee_id)" + (kind === "food" ? ", companies(company_name)" : "")).order("advance_date", { ascending: false }).limit(200),
    ]);
    setEmployees((emps.data as any) || []);
    setCompanies((cos.data as any) || []);
    setRows((ads.data as any) || []);
  };
  useEffect(() => { load(); }, [kind]);

  const save = async () => {
    if (!form.employee_id || !form.advance_date || !form.amount) { toast.error("Employee, date and amount required"); return; }
    const amt = parseFloat(form.amount); if (!amt || amt <= 0) { toast.error("Amount must be > 0"); return; }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      employee_id: form.employee_id,
      advance_date: form.advance_date,
      amount: amt,
      notes: form.notes || null,
      created_by: u.user?.id,
    };
    if (kind === "food" && form.company_id) payload.company_id = form.company_id;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Advance logged");
    setOpen(false);
    setForm({ employee_id: "", company_id: "", advance_date: format(new Date(), "yyyy-MM-dd"), amount: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this advance?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const KindIcon = kind === "cash" ? Banknote : kind === "food" ? UtensilsCrossed : Shirt;

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex justify-between items-center">
          <Tabs value={kind} onValueChange={(v: any) => setKind(v)}>
            <TabsList>
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="food">Food</TabsTrigger>
              <TabsTrigger value="uniform">Uniform</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Input className="w-56" placeholder="Search employee / note..."
              value={advSearch} onChange={(e) => setAdvSearch(e.target.value)} />
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add {kind} advance</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              {kind === "food" && <TableHead>Company</TableHead>}
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow><TableCell colSpan={kind === "food" ? 6 : 5} className="text-center text-muted-foreground">No advances logged</TableCell></TableRow>
            ) : visibleRows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.advance_date).toLocaleDateString()}</TableCell>
                <TableCell>{r.employees?.full_name} ({r.employees?.employee_id})</TableCell>
                {kind === "food" && <TableCell>{r.companies?.company_name || "—"}</TableCell>}
                <TableCell className="text-right">LKR {Number(r.amount).toFixed(2)}</TableCell>
                <TableCell className="max-w-[240px] truncate">{r.notes || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KindIcon className="h-5 w-5" /> Add {kind} advance</DialogTitle>
            <DialogDescription>Logged advances are auto-deducted from the employee's net pay in the matching month.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {kind === "food" && (
              <div className="space-y-2">
                <Label>Tag to Company (optional)</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.advance_date} onChange={(e) => setForm({ ...form, advance_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (LKR)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============== EXPENSES TAB ============== */
const TRANSPORT_SUBCATS = ["Service", "Upgrade", "Refuel (Petrol)", "Refuel (Diesel)", "Electric Charge", "Tolls", "Parking", "Repair", "Other"];

function ExpensesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterPaid, setFilterPaid] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [form, setForm] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    subcategory: "",
    amount: "",
    description: "",
    vendor: "",
    supplier: "",
    invoice_ref: "",
    company_id: "",
    is_paid: true,
    payment_date: format(new Date(), "yyyy-MM-dd"),
  });

  const load = async () => {
    let q = supabase.from("expenses").select("*, companies(company_name)").gte("expense_date", fromDate).lte("expense_date", toDate).order("expense_date", { ascending: false });
    if (filterCat !== "all") q = q.eq("category", filterCat);
    if (filterCompany !== "all") q = q.eq("company_id", filterCompany);
    if (filterPaid !== "all") q = q.eq("is_paid", filterPaid === "paid");
    const { data } = await q;
    setRows(data || []);
  };
  const loadMeta = async () => {
    const [cats, cos] = await Promise.all([
      supabase.from("expense_categories").select("*").order("name"),
      supabase.from("companies").select("id, company_name").order("company_name"),
    ]);
    setCategories((cats.data as any) || []);
    setCompanies((cos.data as any) || []);
  };
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { load(); }, [filterCat, filterCompany, filterPaid, fromDate, toDate]);

  const save = async () => {
    if (!form.expense_date || !form.category || !form.amount) { toast.error("Date, category, amount required"); return; }
    const amt = parseFloat(form.amount); if (!amt || amt <= 0) { toast.error("Invalid amount"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      expense_date: form.expense_date,
      category: form.category,
      subcategory: form.subcategory || null,
      amount: amt,
      description: form.description || null,
      vendor: form.vendor || null,
      supplier: form.supplier || null,
      invoice_ref: form.invoice_ref || null,
      company_id: form.company_id || null,
      is_paid: form.is_paid,
      payment_date: form.is_paid ? form.payment_date : null,
      created_by: u.user?.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    // Mirror any free-typed vendor into the central Vendors module
    await ensureVendor(form.vendor || form.supplier, form.category || "Other");
    toast.success("Expense logged");
    setOpen(false);
    setForm({ expense_date: format(new Date(), "yyyy-MM-dd"), category: "", subcategory: "", amount: "", description: "", vendor: "", supplier: "", invoice_ref: "", company_id: "", is_paid: true, payment_date: format(new Date(), "yyyy-MM-dd") });
    load();
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("expenses").update({ is_paid: true, payment_date: format(new Date(), "yyyy-MM-dd") } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const unpaidTotal = rows.filter((r: any) => !r.is_paid).reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Expenses</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Categories: Transport, Uniforms, Stationaries, Other</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Payment</Label>
              <Select value={filterPaid} onValueChange={setFilterPaid}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid (Credit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub / Description</TableHead>
                <TableHead>Supplier / Vendor</TableHead>
                <TableHead>Invoice Ref</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No expenses</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.expense_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                  <TableCell>{[r.subcategory, r.description].filter(Boolean).join(" — ") || "—"}</TableCell>
                  <TableCell>{r.supplier || r.vendor || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_ref || "—"}</TableCell>
                  <TableCell>{r.companies?.company_name || "—"}</TableCell>
                  <TableCell>
                    {r.is_paid
                      ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
                      : <Badge variant="destructive">Credit</Badge>}
                  </TableCell>
                  <TableCell className="text-right">LKR {Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="flex gap-1 justify-end">
                    {!r.is_paid && <Button variant="outline" size="sm" onClick={() => markPaid(r.id)}>Mark Paid</Button>}
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/30">
                <TableCell colSpan={7} className="text-right">Total (Unpaid: LKR {unpaidTotal.toFixed(2)})</TableCell>
                <TableCell className="text-right">LKR {total.toFixed(2)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount (LKR)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.category === "Transport" ? (
                <div className="space-y-2">
                  <Label>Transport Sub-category</Label>
                  <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_SUBCATS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Sub-category (optional)</Label>
                  <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Invoice / Reference</Label>
                <Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Linked Company (optional)</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <input id="is_paid" type="checkbox" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} />
              <Label htmlFor="is_paid" className="flex-1 cursor-pointer">Payment made (uncheck if on credit)</Label>
              {form.is_paid && (
                <Input type="date" className="w-40" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== OVERVIEW TAB ============== */
function OverviewTab() {
  const [month, setMonth] = useState(toMonthStr());
  const [data, setData] = useState({ invoiced: 0, received: 0, outstanding: 0, salaries: 0, expenses: 0, epf12: 0, etf3: 0 });

  useEffect(() => {
    (async () => {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      const [inv, pay, sal, exp, contrib] = await Promise.all([
        supabase.from("invoices").select("amount_to_collect, amount_received").gte("month_period", start).lte("month_period", end),
        supabase.from("invoice_payments").select("amount").gte("payment_date", start).lte("payment_date", end),
        supabase.from("salaries").select("final_salary").gte("salary_month", start).lte("salary_month", end),
        supabase.from("expenses").select("amount").gte("expense_date", start).lte("expense_date", end),
        fetchEmployerContributions(month),
      ]);
      const invoiced = (inv.data || []).reduce((s, r) => s + Number(r.amount_to_collect || 0), 0);
      const receivedFromInv = (inv.data || []).reduce((s, r) => s + Number(r.amount_received || 0), 0);
      const receivedThisMonth = (pay.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const outstanding = invoiced - receivedFromInv;
      const salaries = (sal.data || []).reduce((s, r) => s + Number(r.final_salary || 0), 0);
      const expenses = (exp.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const c = sumContributions(contrib);
      setData({ invoiced, received: receivedThisMonth, outstanding, salaries, expenses, epf12: c.epf_12, etf3: c.etf_3 });
    })();
  }, [month]);

  const contributions = data.epf12 + data.etf3;
  const net = data.received - data.salaries - data.expenses - contributions;
  const cards = [
    { label: "Total Invoiced", value: data.invoiced },
    { label: "Total Received (this month)", value: data.received },
    { label: "Total Outstanding", value: data.outstanding },
    { label: "Total Salaries Paid", value: data.salaries },
    { label: "Total Expenses", value: data.expenses },
    { label: "EPF 12% (Employer Cost)", value: data.epf12 },
    { label: "ETF 3% (Employer Cost)", value: data.etf3 },
  ];


  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Monthly Overview</CardTitle>
        <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map(c => (
            <div key={c.label} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold">LKR {c.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ))}
          <div className={`rounded-lg border-2 p-4 ${net >= 0 ? "border-emerald-500" : "border-destructive"}`}>
            <p className="text-xs text-muted-foreground">Net (Received − Salaries − Expenses − EPF/ETF)</p>
            <p className={`text-2xl font-bold ${net < 0 ? "text-destructive" : "text-emerald-600"}`}>LKR {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== SETTINGS TAB ============== */
function SettingsTab() {
  const [wage, setWage] = useState("1200");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "daily_min_wage").maybeSingle().then(({ data }) => {
      if (data?.value) setWage(data.value);
    });
  }, []);

  const save = async () => {
    setLoading(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "daily_min_wage", value: String(parseFloat(wage) || 0), updated_at: new Date().toISOString() });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Daily minimum wage updated");
  };

  return (
    <Card className="mt-4 max-w-xl">
      <CardHeader>
        <CardTitle>Payroll Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Daily Minimum Wage (LKR)</Label>
          <Input type="number" step="0.01" value={wage} onChange={(e) => setWage(e.target.value)} />
          <p className="text-xs text-muted-foreground">Used for EPF Basic = EPF Days × this rate. Sri Lanka national minimum wage is LKR 1,200/day from Jan 2026 (was LKR 1,080).</p>
        </div>
        <Button onClick={save} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
      </CardContent>
    </Card>
  );
}
