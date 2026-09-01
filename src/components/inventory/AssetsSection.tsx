import { useEffect, useMemo, useState } from "react";
import { toDateStr, toMonthStr } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Download, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ASSET_CATEGORIES = [
  "Laptop",
  "Desktop PC",
  "Monitor",
  "Printer",
  "Furniture",
  "Air Conditioner",
  "Vehicle",
  "Mobile Phone",
  "CCTV / Security Equipment",
  "Other",
];

const CONDITIONS = ["Good", "Fair", "Needs Repair", "Damaged"];
const STATUSES = ["In Use", "In Storage", "Under Repair", "Disposed"];

interface Asset {
  id: string;
  asset_name: string;
  asset_category: string;
  identifier: string | null;
  vehicle_number: string | null;
  serial_number: string | null;
  quantity: number;
  purchase_date: string | null;
  purchase_cost: number;
  vendor_id: string | null;
  invoice_ref: string | null;
  condition: string;
  status: string;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
}

const empty = {
  asset_name: "",
  asset_category: "Laptop",
  serial_number: "",
  vehicle_number: "",
  quantity: "1",
  purchase_date: "",
  purchase_cost: "",
  vendor_id: "",
  invoice_ref: "",
  condition: "Good",
  status: "In Use",
  location: "",
  assigned_to: "",
  notes: "",
};

export default function AssetsSection() {
  const { isSuperAdmin } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<{ id: string; vendor_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    const [{ data }, { data: v }] = await Promise.all([
      supabase.from("assets").select("*").order("asset_category").order("asset_name"),
      supabase.from("vendors").select("id, vendor_name").order("vendor_name"),
    ]);
    setAssets(((data as any) || []) as Asset[]);
    setVendors(((v as any) || []) as { id: string; vendor_name: string }[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.asset_name, a.asset_category, a.serial_number, a.vehicle_number, a.location, a.assigned_to]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [assets, search]);

  const totalValue = filtered.reduce((s, a) => s + Number(a.purchase_cost || 0) * (a.quantity || 1), 0);

  const openCreate = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };

  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      asset_name: a.asset_name,
      asset_category: a.asset_category,
      serial_number: a.serial_number || "",
      vehicle_number: a.vehicle_number || "",
      quantity: String(a.quantity ?? 1),
      purchase_date: a.purchase_date || "",
      purchase_cost: a.purchase_cost ? String(a.purchase_cost) : "",
      vendor_id: a.vendor_id || "",
      invoice_ref: a.invoice_ref || "",
      condition: a.condition,
      status: a.status,
      location: a.location || "",
      assigned_to: a.assigned_to || "",
      notes: a.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.asset_name.trim()) { toast.error("Asset name is required"); return; }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      asset_name: form.asset_name.trim(),
      asset_category: form.asset_category,
      serial_number: form.serial_number || null,
      vehicle_number: form.vehicle_number || null,
      identifier: form.vehicle_number || form.serial_number || null,
      quantity: parseInt(form.quantity) || 1,
      purchase_date: form.purchase_date || null,
      purchase_cost: parseFloat(form.purchase_cost) || 0,
      vendor_id: form.vendor_id || null,
      invoice_ref: form.invoice_ref || null,
      condition: form.condition,
      status: form.status,
      location: form.location || null,
      assigned_to: form.assigned_to || null,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("assets").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Asset updated");
    } else {
      payload.created_by = u.user?.id;
      const { error } = await supabase.from("assets").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Asset added");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const exportXlsx = () => {
    if (!filtered.length) { toast.error("No assets to export"); return; }
    const rows = filtered.map((a) => ({
      "Asset Name": a.asset_name,
      Category: a.asset_category,
      "Serial No": a.serial_number || "",
      "Vehicle No": a.vehicle_number || "",
      Quantity: a.quantity,
      "Purchase Date": a.purchase_date || "",
      "Purchase Cost": a.purchase_cost,
      "Invoice No": a.invoice_ref || "",
      Vendor: vendors.find((v) => v.id === a.vendor_id)?.vendor_name || "",
      Condition: a.condition,
      Status: a.status,
      Location: a.location || "",
      "Assigned To": a.assigned_to || "",
      Notes: a.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, `Assets_${toDateStr()}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-5 w-5" />Company Assets</CardTitle>
          <p className="text-sm text-muted-foreground">Laptops, PCs, furniture, A/Cs, vehicles and other company property.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="h-4 w-4 mr-2" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Asset</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search asset / serial / vehicle no..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          <Badge variant="secondary">{filtered.length} assets</Badge>
          <Badge variant="outline">Value: LKR {totalValue.toLocaleString()}</Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial / Vehicle No</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No assets recorded</TableCell></TableRow>
            ) : filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.asset_name}</TableCell>
                <TableCell><Badge variant="outline">{a.asset_category}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{a.vehicle_number || a.serial_number || "—"}</TableCell>
                <TableCell className="text-right">{a.quantity}</TableCell>
                <TableCell className="text-right">{a.purchase_cost ? `LKR ${Number(a.purchase_cost).toLocaleString()}` : "—"}</TableCell>
                <TableCell>{a.condition}</TableCell>
                <TableCell><Badge variant={a.status === "In Use" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                <TableCell>{a.location || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Asset" : "Add Asset"}</DialogTitle>
            <DialogDescription>Record company property with its purchase details and current condition.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2 col-span-2">
              <Label>Asset Name</Label>
              <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} placeholder="e.g. Dell Latitude 5420" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.asset_category} onValueChange={(v) => setForm({ ...form, asset_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            {form.asset_category === "Vehicle" ? (
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. CAB-1234" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Purchase Cost (LKR)</Label>
              <Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Invoice No</Label>
              <Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Head Office" />
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Add"} Asset</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
