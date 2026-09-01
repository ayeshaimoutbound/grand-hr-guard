import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const TYPES = ["Repair", "Service", "Vehicle Service", "Computer Repair", "Utility", "Toll Gate", "Other"];
const STATUSES = ["Pending", "In Progress", "Completed"];
const METHODS = ["Cash", "Cheque", "Bank Transfer"];

const EMPTY = {
  title: "",
  maintenance_type: "Repair",
  asset_name: "",
  vehicle_number: "",
  vendor_id: "",
  service_date: toDateStr(),
  
  cost: "",
  status: "Completed",
  is_paid: false,
  payment_method: "Cash",
  cheque_number: "",
  cheque_date: "",
  invoice_ref: "",
  notes: "",
};

export default function Maintenance() {
  const { isSuperAdmin } = useAuth() as any;
  const [rows, setRows] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const load = async () => {
    const [{ data: m, error }, { data: v }] = await Promise.all([
      supabase.from("maintenance_records").select("*, vendors(vendor_name)").order("service_date", { ascending: false }),
      supabase.from("vendors").select("id, vendor_name, vendor_type").order("vendor_name"),
    ]);
    if (error) toast.error(error.message);
    setRows((m as any) || []);
    setVendors((v as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return [r.title, r.maintenance_type, r.asset_name, r.vehicle_number, r.vendors?.vendor_name, r.invoice_ref]
      .some((x: any) => (x || "").toLowerCase().includes(q));
  }), [rows, search]);

  const totalCost = filtered.reduce((s, r) => s + Number(r.cost || 0), 0);
  const unpaid = filtered.filter((r) => !r.is_paid).reduce((s, r) => s + Number(r.cost || 0), 0);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.is_paid && form.payment_method === "Cheque" && !form.cheque_number.trim()) {
      toast.error("Cheque number is required"); return;
    }
    const { data: u } = await supabase.auth.getUser();
    const cost = Number(form.cost) || 0;

    // Mirror into expenses so Accounts stays in sync
    const { data: exp, error: expErr } = await supabase.from("expenses").insert({
      expense_date: form.service_date,
      category: "Other",
      subcategory: `Maintenance — ${form.maintenance_type}`,
      amount: cost,
      description: `${form.title}${form.vehicle_number ? ` (${form.vehicle_number})` : ""}`,
      supplier: vendors.find((v) => v.id === form.vendor_id)?.vendor_name || null,
      invoice_ref: form.invoice_ref || null,
      is_paid: form.is_paid,
      payment_date: form.is_paid ? form.service_date : null,
      created_by: u.user?.id,
    }).select("id").single();
    if (expErr) { toast.error(expErr.message); return; }

    const { error } = await supabase.from("maintenance_records").insert({
      title: form.title.trim(),
      maintenance_type: form.maintenance_type,
      asset_name: form.asset_name || null,
      vehicle_number: form.vehicle_number || null,
      vendor_id: form.vendor_id || null,
      service_date: form.service_date,

      cost,
      status: form.status,
      is_paid: form.is_paid,
      payment_method: form.is_paid ? form.payment_method : null,
      cheque_number: form.is_paid && form.payment_method === "Cheque" ? form.cheque_number : null,
      cheque_date: form.is_paid && form.payment_method === "Cheque" && form.cheque_date ? form.cheque_date : null,
      invoice_ref: form.invoice_ref || null,
      expense_id: exp?.id || null,
      notes: form.notes || null,
      created_by: u.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Maintenance record added");
    setOpen(false); setForm({ ...EMPTY }); load();
  };

  const togglePaid = async (r: any) => {
    const { error } = await supabase.from("maintenance_records").update({ is_paid: !r.is_paid }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    if (r.expense_id) await supabase.from("expenses").update({ is_paid: !r.is_paid }).eq("id", r.expense_id);
    load();
  };

  const remove = async (r: any) => {
    if (!isSuperAdmin) { toast.error("Only Super Admin can delete records"); return; }
    if (!confirm("Delete this maintenance record?")) return;
    const { error } = await supabase.from("maintenance_records").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    if (r.expense_id) await supabase.from("expenses").delete().eq("id", r.expense_id);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Wrench className="h-7 w-7" /> Maintenance</h1>
          <p className="text-muted-foreground">Repairs, services, utilities and toll tickets — linked to vendors &amp; accounts</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Record</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Records</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{filtered.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Cost</CardTitle></CardHeader><CardContent className="text-2xl font-bold">LKR {totalCost.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Unpaid</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">LKR {unpaid.toLocaleString()}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><Input placeholder="Search maintenance..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Asset No</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No records</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.service_date}</TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="outline">{r.maintenance_type}</Badge></TableCell>
                  <TableCell>{r.vehicle_number || r.asset_name || "—"}</TableCell>
                  <TableCell>{r.vendors?.vendor_name || "—"}</TableCell>
                  <TableCell className="text-right">LKR {Number(r.cost || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={r.status === "Completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-sm">
                    <button className="underline-offset-2 hover:underline" onClick={() => togglePaid(r)}>
                      <Badge variant={r.is_paid ? "default" : "destructive"}>{r.is_paid ? "Paid" : "Unpaid"}</Badge>
                    </button>
                    {r.is_paid && (
                      <div className="text-muted-foreground">
                        {r.payment_method}
                        {r.cheque_number ? ` · ${r.cheque_number}` : ""}
                        {r.cheque_date ? ` · dated ${r.cheque_date}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
            <DialogDescription>This also creates a matching expense entry in Accounts.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2 col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Van brake pad replacement" /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.maintenance_type} onValueChange={(v) => setForm({ ...form, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Asset Name</Label><Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} placeholder="Laptop / A/C / Printer" /></div>
            <div className="space-y-2"><Label>Asset No</Label><Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. AST-014 / CAB-1234" /></div>
            <div className="space-y-2 col-span-2">
              <Label>Vendor</Label>
              <Select value={form.vendor_id || "none"} onValueChange={(v) => setForm({ ...form, vendor_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name} — {v.vendor_type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Service Date</Label><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div>
            
            <div className="space-y-2"><Label>Cost (LKR)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            <div className="space-y-2"><Label>Invoice / Bill Ref</Label><Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} /></div>
            <div className="flex items-center gap-3 col-span-2">
              <Switch checked={form.is_paid} onCheckedChange={(v) => setForm({ ...form, is_paid: v })} />
              <Label>Payment settled</Label>
            </div>
            {form.is_paid && (
              <>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.payment_method === "Cheque" && (
                  <>
                    <div className="space-y-2"><Label>Cheque No</Label><Input value={form.cheque_number} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} /></div>
                    <div className="space-y-2 col-span-2"><Label>Cheque Dated To</Label><Input type="date" value={form.cheque_date} onChange={(e) => setForm({ ...form, cheque_date: e.target.value })} /></div>
                  </>
                )}
              </>
            )}
            <div className="space-y-2 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save Record</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
