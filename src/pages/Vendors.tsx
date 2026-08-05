import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Store, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const VENDOR_TYPES = [
  "Uniforms",
  "Shoes",
  "Torches",
  "Print Outs",
  "Stationary",
  "Seals",
  "Visiting Cards",
  "Computer Repairs & Services",
  "Vehicle Repairs & Services",
  "Food",
  "Utilities",
  "Other",
];

export interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  branch_name: string | null;
  notes: string | null;
}

const EMPTY = {
  vendor_name: "",
  vendor_type: "Uniforms",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_name: "",
  branch_name: "",
  notes: "",
};

export default function Vendors() {
  const { isSuperAdmin, isAdmin } = useAuth() as any;
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = async () => {
    const { data, error } = await supabase.from("vendors").select("*").order("vendor_name");
    if (error) { toast.error(error.message); return; }
    setVendors((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => vendors.filter((v) => {
    if (typeFilter !== "all" && v.vendor_type !== typeFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return [v.vendor_name, v.vendor_type, v.contact_person, v.phone, v.bank_name].some((x) => (x || "").toLowerCase().includes(q));
  }), [vendors, search, typeFilter]);

  const save = async () => {
    if (!form.vendor_name.trim()) { toast.error("Vendor name is required"); return; }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" && !v.trim() ? null : v])),
      vendor_name: form.vendor_name.trim(),
      vendor_type: form.vendor_type,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("vendors").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("vendors").insert({ ...payload, created_by: u.user?.id }));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Vendor updated" : "Vendor added");
    setOpen(false); setEditId(null); setForm({ ...EMPTY });
    load();
  };

  const remove = async (id: string) => {
    if (!isSuperAdmin) { toast.error("Only Super Admin can delete vendors"); return; }
    if (!confirm("Delete this vendor?")) return;
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const startEdit = (v: Vendor) => {
    setEditId(v.id);
    setForm({
      vendor_name: v.vendor_name, vendor_type: v.vendor_type,
      contact_person: v.contact_person || "", phone: v.phone || "", email: v.email || "",
      address: v.address || "", bank_account_name: v.bank_account_name || "",
      bank_account_number: v.bank_account_number || "", bank_name: v.bank_name || "",
      branch_name: v.branch_name || "", notes: v.notes || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Store className="h-7 w-7" /> Vendors</h1>
          <p className="text-muted-foreground">Suppliers for inventory, food, maintenance and services</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm({ ...EMPTY }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Vendor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3 flex-wrap">
            <Input placeholder="Search vendor / contact / bank..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Bank Details</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No vendors</TableCell></TableRow>
              ) : filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.vendor_name}</TableCell>
                  <TableCell><Badge variant="outline">{v.vendor_type}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {v.contact_person || "—"}{v.phone ? ` · ${v.phone}` : ""}
                    {v.email ? <div className="text-muted-foreground">{v.email}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.bank_account_number ? (
                      <>
                        <div>{v.bank_account_name}</div>
                        <div className="text-muted-foreground">{v.bank_name} — {v.branch_name} · {v.bank_account_number}</div>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ ...EMPTY }); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>Vendors are shared across inventory, food and maintenance.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2 col-span-2">
              <Label>Vendor Name</Label>
              <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Supplies / Service Type</Label>
              <Select value={form.vendor_type} onValueChange={(v) => setForm({ ...form, vendor_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bank Account Name</Label><Input value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Account Number</Label><Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Branch</Label><Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} /></div>
            <div className="space-y-2 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? "Save" : "Add Vendor"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
