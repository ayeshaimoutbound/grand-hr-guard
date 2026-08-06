import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Upload, Download, Trash2, Package, Minus, PlusCircle, UserCheck, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUsageStats, applyAutoThresholds, suggestThreshold, UsageStat, WINDOW_DAYS } from "@/lib/inventoryInsights";
import AssetsSection from "@/components/inventory/AssetsSection";

const CATEGORIES = [
  "Shirt (Men)",
  "Trouser (Men)",
  "Blouse (Women)",
  "Skirt (Women)",
  "Shoes",
  "Epaulet",
  "Lanyard",
  "Stationary",
  "Umbrella",
  "Other",
] as const;

const SIZES: Record<string, string[]> = {
  "Shirt (Men)": ["14", "14.5", "15", "15.5", "16", "16.5", "17", "17.5", "18", "18.5"],
  "Trouser (Men)": Array.from({ length: 48 - 28 + 1 }, (_, i) => String(28 + i)),
  "Blouse (Women)": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  "Skirt (Women)": Array.from({ length: 45 - 28 + 1 }, (_, i) => String(28 + i)),
  Shoes: ["5", "6", "7", "8", "9", "10", "11", "12"],
};

const COLORS: Record<string, string[]> = {
  "Shirt (Men)": ["White", "Brown", "Black"],
  "Blouse (Women)": ["White", "Brown", "Black"],
  "Trouser (Men)": ["Brown", "Black"],
  "Skirt (Women)": ["Brown", "Black"],
  Lanyard: ["Black", "Brown"],
  Shoes: ["Black", "Brown"],
};

const EPAULET_RANKS = [
  { value: "OIC", label: "OIC (01 stripe)" },
  { value: "SSO", label: "SSO (02 stripes)" },
  { value: "JSO/LSO", label: "JSO/LSO (03 stripes)" },
];

interface Item {
  id: string;
  category: string;
  item_name: string;
  size: string | null;
  color: string | null;
  gender: string | null;
  epaulet_rank: string | null;
  quantity: number;
  unit_cost: number | null;
  supplier: string | null;
  notes: string | null;
  inventory_type: string;
  low_stock_threshold: number;
  auto_threshold: boolean;
  vendor_id: string | null;
}

export default function Inventory() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<string>("all");
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<{ id: string; vendor_name: string; vendor_type: string }[]>([]);
  const [stats, setStats] = useState<Record<string, UsageStat>>({});
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<Item | null>(null);
  const [moveQty, setMoveQty] = useState<string>("");
  const [moveReason, setMoveReason] = useState<string>("");
  const [settingsItem, setSettingsItem] = useState<Item | null>(null);
  const [settingsForm, setSettingsForm] = useState({ inventory_type: "non_critical", low_stock_threshold: "3", auto_threshold: true });

  const [issueItem, setIssueItem] = useState<Item | null>(null);
  const [issueQty, setIssueQty] = useState<string>("1");
  const [issueEmployeeId, setIssueEmployeeId] = useState<string>("");
  const [issueMonths, setIssueMonths] = useState<string>("3");
  const [employees, setEmployees] = useState<{ id: string; employee_id: string; full_name: string }[]>([]);

  const [form, setForm] = useState({
    category: "Shirt (Men)",
    item_name: "",
    size: "",
    color: "",
    gender: "",
    epaulet_rank: "",
    quantity: "0",
    unit_cost: "",
    supplier: "",
    notes: "",
    inventory_type: "non_critical",
    low_stock_threshold: "3",
    auto_threshold: true,
    vendor_id: "",
    is_paid: false,
    payment_method: "Cash",
    cheque_number: "",
    cheque_date: "",
    invoice_ref: "",
  });

  const [bulk, setBulk] = useState({
    file: null as File | null,
    supplier: "",
    notes: "",
  });

  const [invBulkOpen, setInvBulkOpen] = useState(false);
  const [invBulk, setInvBulk] = useState({
    file: null as File | null,
    vendor_id: "",
    invoice_ref: "",
    is_paid: false,
  });


  const load = async () => {
    const { data } = await supabase.from("inventory_items").select("*").order("category").order("item_name");
    const list = ((data as any) || []) as Item[];
    setItems(list);
    const [{ data: emps }, { data: vends }] = await Promise.all([
      supabase.from("employees").select("id, employee_id, full_name").order("full_name"),
      supabase.from("vendors").select("id, vendor_name, vendor_type").order("vendor_name"),
    ]);
    setEmployees((emps as any) || []);
    setVendors((vends as any) || []);
    setStats(await fetchUsageStats(list));
  };
  useEffect(() => { load(); }, []);

  const recalcThresholds = async () => {
    const fresh = await fetchUsageStats(items);
    const changed = await applyAutoThresholds(items, fresh);
    toast.success(changed ? `Updated ${changed} adaptive threshold${changed > 1 ? "s" : ""}` : "All adaptive thresholds are already up to date");
    load();
  };

  const saveSettings = async () => {
    if (!settingsItem) return;
    const { error } = await supabase.from("inventory_items").update({
      inventory_type: settingsForm.inventory_type,
      low_stock_threshold: parseInt(settingsForm.low_stock_threshold) || 0,
      auto_threshold: settingsForm.auto_threshold,
    } as any).eq("id", settingsItem.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item settings updated");
    setSettingsItem(null);
    load();
  };

  const isLow = (i: Item) => i.inventory_type === "critical" && i.quantity < (i.low_stock_threshold ?? 3);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (tab !== "all" && i.category !== tab) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return [i.item_name, i.category, i.size, i.color, i.supplier, i.epaulet_rank].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [items, tab, search]);

  const totalUnits = filtered.reduce((s, i) => s + i.quantity, 0);
  const totalValue = filtered.reduce((s, i) => s + i.quantity * Number(i.unit_cost || 0), 0);
  const lowStockItems = useMemo(() => items.filter(isLow), [items]);
  const insightRows = useMemo(
    () => filtered
      .map((item) => ({ item, stat: stats[item.id] }))
      .filter((r) => r.stat && r.stat.totalIssued > 0)
      .sort((a, b) => b.stat.totalIssued - a.stat.totalIssued),
    [filtered, stats]
  );

  const resetForm = () => setForm({
    category: "Shirt (Men)", item_name: "", size: "", color: "", gender: "",
    epaulet_rank: "", quantity: "0", unit_cost: "", supplier: "", notes: "",
    inventory_type: "non_critical", low_stock_threshold: "3", auto_threshold: true,
    vendor_id: "", is_paid: false, payment_method: "Cash", cheque_number: "", cheque_date: "", invoice_ref: "",
  });

  const saveItem = async () => {
    if (!form.category || !form.item_name) { toast.error("Category and item name are required"); return; }
    const qty = parseInt(form.quantity) || 0;
    const unitCost = form.unit_cost ? parseFloat(form.unit_cost) : null;
    if (qty > 0 && !form.vendor_id) { toast.error("Select the vendor this stock came from"); return; }
    if (form.is_paid && form.payment_method === "Cheque" && !form.cheque_number.trim()) {
      toast.error("Cheque number is required"); return;
    }
    const vendorName = vendors.find((v) => v.id === form.vendor_id)?.vendor_name || form.supplier || null;
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      category: form.category,
      item_name: form.item_name,
      size: form.size || null,
      color: form.color || null,
      gender: form.gender || null,
      epaulet_rank: form.epaulet_rank || null,
      quantity: qty,
      unit_cost: unitCost,
      supplier: vendorName,
      notes: form.notes || null,
      inventory_type: form.inventory_type,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 3,
      auto_threshold: form.auto_threshold,
      vendor_id: form.vendor_id || null,
      created_by: u.user?.id,
    };
    const { data, error } = await supabase.from("inventory_items").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    const itemId = (data as any).id;
    if (qty > 0) {
      const total = (unitCost || 0) * qty;
      // Expense so Accounts reflects the payable
      const { data: exp } = await supabase.from("expenses").insert({
        expense_date: format(new Date(), "yyyy-MM-dd"),
        category: form.category === "Stationary" ? "Stationaries" : "Uniforms",
        subcategory: "Inventory Purchase",
        amount: total,
        description: `${form.item_name} × ${qty}`,
        supplier: vendorName,
        vendor: vendorName,
        invoice_ref: form.invoice_ref || null,
        is_paid: form.is_paid,
        payment_date: form.is_paid ? format(new Date(), "yyyy-MM-dd") : null,
        created_by: u.user?.id,
      } as any).select("id").single();

      await supabase.from("inventory_purchases").insert({
        item_id: itemId,
        vendor_id: form.vendor_id || null,
        purchase_date: format(new Date(), "yyyy-MM-dd"),
        quantity: qty,
        unit_cost: unitCost || 0,
        total_amount: total,
        is_paid: form.is_paid,
        payment_method: form.is_paid ? form.payment_method : null,
        cheque_number: form.is_paid && form.payment_method === "Cheque" ? form.cheque_number : null,
        cheque_date: form.is_paid && form.payment_method === "Cheque" && form.cheque_date ? form.cheque_date : null,
        invoice_ref: form.invoice_ref || null,
        expense_id: (exp as any)?.id ?? null,
        created_by: u.user?.id,
      } as any);

      await supabase.from("inventory_movements").insert({
        item_id: itemId,
        change: qty,
        reason: "manual_add",
        reference: form.invoice_ref || null,
        unit_cost: unitCost,
        expense_id: (exp as any)?.id ?? null,
        created_by: u.user?.id,
      } as any);
    }
    toast.success("Item added");
    setAddOpen(false);
    resetForm();
    load();
  };

  const adjust = async (dir: 1 | -1) => {
    if (!moveItem) return;
    const qty = parseInt(moveQty);
    if (!qty || qty <= 0) { toast.error("Enter a positive quantity"); return; }
    const change = dir * qty;
    const newQty = moveItem.quantity + change;
    if (newQty < 0) { toast.error("Not enough stock"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory_items").update({ quantity: newQty } as any).eq("id", moveItem.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("inventory_movements").insert({
      item_id: moveItem.id,
      change,
      reason: moveReason || (dir === 1 ? "manual_add" : "issue"),
      created_by: u.user?.id,
    } as any);
    toast.success(dir === 1 ? "Stock added" : "Stock removed");
    setMoveItem(null); setMoveQty(""); setMoveReason("");
    load();
  };

  const deleteItem = async (id: string) => {
    if (!isSuperAdmin) { toast.error("Only Super Admin can delete inventory items"); return; }
    if (!confirm("Delete this inventory item and its movement history?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const downloadExport = () => {
    const rows = filtered.map((i) => ({
      Category: i.category,
      "Item Name": i.item_name,
      Size: i.size || "",
      Color: i.color || "",
      Gender: i.gender || "",
      "Epaulet Rank": i.epaulet_rank || "",
      Quantity: i.quantity,
      "Unit Cost": i.unit_cost || 0,
      "Total Value": i.quantity * Number(i.unit_cost || 0),
      Supplier: i.supplier || "",
      Notes: i.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadUniformTemplate = () => {
    const a = document.createElement("a");
    a.href = "/Uniform_Bulk_Upload_Template.xlsx";
    a.download = "Uniform_Bulk_Upload_Template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Template downloaded");
  };

  const downloadInventoryTemplate = () => {
    const rows = [{
      "Category": "Shoes",
      "Item Name": "Black Leather Shoes",
      "Size": "42",
      "Color": "Black",
      "Gender": "Men",
      "Quantity": 10,
      "Unit Cost": 4500,
      "Vendor": "",
      "Invoice No": "",
      "Notes": "",
    }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "Inventory_Bulk_Upload_Format.xlsx");
    toast.success("Format downloaded");
  };

  const processInventoryBulk = async () => {
    if (!invBulk.file) { toast.error("Choose a file"); return; }
    try {
      const buf = await invBulk.file.arrayBuffer();
      const wb = XLSX.read(buf, { cellFormula: false });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (!rows.length) { toast.error("No rows found in the file"); return; }

      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const pick = (r: any, keys: string[]) => {
        for (const k of Object.keys(r)) {
          if (keys.includes(k.trim().toLowerCase())) return r[k];
        }
        return "";
      };

      let created = 0, updated = 0, totalCost = 0;

      for (const r of rows) {
        const itemName = String(pick(r, ["item name", "item", "description"]) || "").trim();
        if (!itemName) continue;
        const category = String(pick(r, ["category"]) || "Other").trim() || "Other";
        const size = String(pick(r, ["size"]) || "").trim() || null;
        const color = String(pick(r, ["color", "colour"]) || "").trim() || null;
        const gender = String(pick(r, ["gender"]) || "").trim() || null;
        const qty = parseInt(String(pick(r, ["quantity", "qty"]) || "0")) || 0;
        const unitCost = parseFloat(String(pick(r, ["unit cost", "price", "unit price"]) || "0")) || 0;
        const vendorName = String(pick(r, ["vendor", "supplier"]) || "").trim();
        const invoiceRef = String(pick(r, ["invoice no", "invoice no.", "invoice"]) || "").trim() || invBulk.invoice_ref || null;
        const notes = String(pick(r, ["notes", "remarks"]) || "").trim() || null;
        if (qty <= 0) continue;

        const vendorId = vendors.find((v) => v.vendor_name.toLowerCase() === vendorName.toLowerCase())?.id || invBulk.vendor_id || null;

        const existing = items.find(
          (i) => i.item_name.toLowerCase() === itemName.toLowerCase() &&
            (i.category || "").toLowerCase() === category.toLowerCase() &&
            (i.size || "") === (size || "") &&
            (i.color || "") === (color || "")
        );

        let itemId: string;
        if (existing) {
          itemId = existing.id;
          await supabase.from("inventory_items").update({
            quantity: (existing.quantity || 0) + qty,
            unit_cost: unitCost || existing.unit_cost,
            vendor_id: vendorId || (existing as any).vendor_id,
          }).eq("id", existing.id);
          updated++;
        } else {
          const { data: ins, error } = await supabase.from("inventory_items").insert({
            category, item_name: itemName, size, color, gender,
            quantity: qty, unit_cost: unitCost || null,
            supplier: vendorName || null, vendor_id: vendorId,
            notes, created_by: uid,
          }).select("id").single();
          if (error) { toast.error(`${itemName}: ${error.message}`); continue; }
          itemId = (ins as any).id;
          created++;
        }

        await supabase.from("inventory_movements").insert({
          item_id: itemId, change: qty, reason: "Bulk upload",
          reference: invoiceRef, unit_cost: unitCost || null, created_by: uid,
        });

        const lineTotal = qty * unitCost;
        totalCost += lineTotal;

        if (lineTotal > 0) {
          await supabase.from("inventory_purchases").insert({
            item_id: itemId, vendor_id: vendorId,
            purchase_date: new Date().toISOString().slice(0, 10),
            quantity: qty, unit_cost: unitCost, total_amount: lineTotal,
            is_paid: invBulk.is_paid, invoice_ref: invoiceRef,
            notes: "Bulk upload", created_by: uid,
          });
        }
      }

      if (totalCost > 0) {
        await supabase.from("expenses").insert({
          expense_date: new Date().toISOString().slice(0, 10),
          category: "Inventory",
          subcategory: "Bulk Purchase",
          amount: totalCost,
          description: `Inventory bulk upload (${created + updated} items)`,
          supplier: vendors.find((v) => v.id === invBulk.vendor_id)?.vendor_name || null,
          invoice_ref: invBulk.invoice_ref || null,
          is_paid: invBulk.is_paid,
          payment_date: invBulk.is_paid ? new Date().toISOString().slice(0, 10) : null,
          created_by: uid,
        });
      }

      toast.success(`Uploaded — ${created} new, ${updated} restocked · LKR ${totalCost.toLocaleString()}`);
      setInvBulkOpen(false);
      setInvBulk({ file: null, vendor_id: "", invoice_ref: "", is_paid: false });
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to process file");
    }
  };

  const processBulkUpload = async () => {
    if (!bulk.file) { toast.error("Choose a file"); return; }
    try {
      const buf = await bulk.file.arrayBuffer();
      const wb = XLSX.read(buf, { cellFormula: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // Extract Invoice No: find cell whose adjacent (or same-row next) value is the number.
      let invoiceNumber = "";
      let grandTotal = 0;
      for (let ri = 0; ri < aoa.length; ri++) {
        const r = aoa[ri] || [];
        for (let ci = 0; ci < r.length; ci++) {
          const cell = String(r[ci] ?? "").trim().toLowerCase();
          if (cell === "invoice no" || cell === "invoice no.") {
            for (let cj = ci + 1; cj < r.length; cj++) {
              const v = String(r[cj] ?? "").trim();
              if (v) { invoiceNumber = v; break; }
            }
          }
          if (cell === "grand total") {
            for (let cj = ci + 1; cj < r.length; cj++) {
              const v = r[cj];
              const n = parseFloat(String(v));
              if (Number.isFinite(n) && n > 0) { grandTotal = n; break; }
            }
          }
        }
      }

      // Parse pivoted blocks; capture per-row unit cost via "Amount/unit" column.
      type Hdr = { row: number; cat: number; item: number; size: number | null; colors: { col: number; name: string }[]; amt: number | null };
      const headers: Hdr[] = [];
      for (let ri = 0; ri < aoa.length; ri++) {
        const r = aoa[ri] || [];
        for (let ci = 0; ci < r.length; ci++) {
          if (String(r[ci] ?? "").trim().toLowerCase() !== "category") continue;
          let itemCol = -1;
          for (let cj = ci + 1; cj < r.length; cj++) {
            if (String(r[cj] ?? "").trim().toLowerCase() === "item") { itemCol = cj; break; }
            if (String(r[cj] ?? "").trim()) break;
          }
          if (itemCol < 0) continue;
          let sizeCol: number | null = null;
          let colorStart = itemCol + 1;
          if (String(r[itemCol + 1] ?? "").trim().toLowerCase() === "size") {
            sizeCol = itemCol + 1;
            colorStart = itemCol + 2;
          }
          const colors: { col: number; name: string }[] = [];
          let amtCol: number | null = null;
          for (let cj = colorStart; cj < r.length; cj++) {
            const v = String(r[cj] ?? "").trim();
            if (!v) break;
            const vl = v.toLowerCase();
            if (vl === "category") break;
            if (vl === "amount/unit" || vl === "amount per unit" || vl === "unit price" || vl === "amount") { amtCol = cj; break; }
            if (vl === "total") break;
            colors.push({ col: cj, name: v });
          }
          if (colors.length) headers.push({ row: ri, cat: ci, item: itemCol, size: sizeCol, colors, amt: amtCol });
        }
      }
      const headerRowSet = new Set(headers.map((h) => h.row));
      const rows: { category: string; item_name: string; size: string; color: string; quantity: number; unit_cost: number }[] = [];
      let computedGrand = 0;
      for (const h of headers) {
        let curCat = "", curItem = "";
        for (let dr = h.row + 1; dr < aoa.length; dr++) {
          if (headerRowSet.has(dr)) break;
          const row = aoa[dr] || [];
          const cat = String(row[h.cat] ?? "").trim();
          const item = String(row[h.item] ?? "").trim();
          if (cat && cat.toLowerCase() !== "total" && cat.toLowerCase() !== "grand total") curCat = cat;
          if (item) curItem = item;
          const size = h.size !== null ? String(row[h.size] ?? "").trim() : "";
          if (!curCat || !curItem) continue;
          const unitCost = h.amt !== null ? parseFloat(String(row[h.amt] ?? "")) || 0 : 0;
          for (const c of h.colors) {
            const qty = parseInt(row[c.col] as any);
            if (!qty || qty <= 0) continue;
            rows.push({ category: curCat, item_name: curItem, size, color: c.name, quantity: qty, unit_cost: unitCost });
            computedGrand += qty * unitCost;
          }
        }
      }
      if (!rows.length) { toast.error("No quantities found in template."); return; }
      if (!grandTotal) grandTotal = computedGrand;
      if (!invoiceNumber) { toast.error("Invoice No is missing from the template (cell B2)."); return; }

      const { data: u } = await supabase.auth.getUser();

      // 1) Create batch
      const { data: batchNoRes, error: bnErr } = await supabase.rpc("next_uniform_batch_number");
      if (bnErr) { toast.error("Batch # error: " + bnErr.message); return; }
      const batchNumber = batchNoRes as unknown as string;
      const { data: batch, error: batchErr } = await supabase.from("uniform_batches").insert({
        batch_number: batchNumber,
        invoice_number: invoiceNumber,
        grand_total: grandTotal,
        upload_date: format(new Date(), "yyyy-MM-dd"),
        supplier: bulk.supplier || null,
        notes: bulk.notes || null,
        created_by: u.user?.id,
      } as any).select().single();
      if (batchErr) { toast.error("Batch error: " + batchErr.message); return; }

      // 2) Also create an expense entry so accounts reflects the payable
      const { data: exp } = await supabase.from("expenses").insert({
        expense_date: format(new Date(), "yyyy-MM-dd"),
        category: "Uniforms",
        subcategory: "Bulk Upload",
        amount: grandTotal,
        description: `Uniform batch ${batchNumber} (Invoice ${invoiceNumber})`,
        supplier: bulk.supplier || null,
        vendor: bulk.supplier || null,
        invoice_ref: invoiceNumber,
        is_paid: false,
        created_by: u.user?.id,
      } as any).select().single();

      // 3) Upsert inventory items + movements
      let added = 0, updated = 0;
      for (const r of rows) {
        let query = supabase.from("inventory_items").select("id, quantity")
          .eq("category", r.category).eq("item_name", r.item_name);
        if (r.size) query = query.eq("size", r.size); else query = query.is("size", null);
        if (r.color) query = query.eq("color", r.color); else query = query.is("color", null);
        const { data: existing } = await query.limit(1);
        let itemId: string;
        if (existing && existing.length) {
          itemId = existing[0].id;
          const newQty = (existing[0].quantity || 0) + r.quantity;
          await supabase.from("inventory_items").update({ quantity: newQty, unit_cost: r.unit_cost || null, supplier: bulk.supplier || null } as any).eq("id", itemId);
          updated++;
        } else {
          const { data: created } = await supabase.from("inventory_items").insert({
            category: r.category, item_name: r.item_name, size: r.size || null, color: r.color || null,
            quantity: r.quantity, unit_cost: r.unit_cost || null, supplier: bulk.supplier || null, created_by: u.user?.id,
          } as any).select("id").single();
          itemId = (created as any).id;
          added++;
        }
        await supabase.from("inventory_movements").insert({
          item_id: itemId, change: r.quantity, reason: "bulk_upload",
          reference: invoiceNumber, expense_id: (exp as any)?.id ?? null,
          batch_id: (batch as any).id, unit_cost: r.unit_cost || null,
          created_by: u.user?.id,
        } as any);
      }
      toast.success(`Batch ${batchNumber} recorded — LKR ${grandTotal.toLocaleString()} (${added} new, ${updated} updated).`);
      setBulkOpen(false);
      setBulk({ file: null, supplier: "", notes: "" });
      load();
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    }
  };

  const issueToEmployee = async () => {
    if (!issueItem || !issueEmployeeId) { toast.error("Select an employee"); return; }
    const qty = parseInt(issueQty);
    if (!qty || qty <= 0) { toast.error("Enter a positive quantity"); return; }
    if (qty > issueItem.quantity) { toast.error("Not enough stock"); return; }
    const months = Math.max(1, parseInt(issueMonths) || 3);
    const unitCost = Number(issueItem.unit_cost || 0);
    if (unitCost <= 0) { toast.error("Item has no unit cost — set one before issuing."); return; }
    const total = unitCost * qty;
    const installment = Math.round((total / months) * 100) / 100;

    const { data: u } = await supabase.auth.getUser();
    const newQty = issueItem.quantity - qty;
    const { error: upErr } = await supabase.from("inventory_items").update({ quantity: newQty } as any).eq("id", issueItem.id);
    if (upErr) { toast.error(upErr.message); return; }
    await supabase.from("inventory_movements").insert({
      item_id: issueItem.id, change: -qty, reason: "issued_to_employee",
      employee_id: issueEmployeeId, unit_cost: unitCost, created_by: u.user?.id,
    } as any);

    // Create N monthly installment advances
    const today = new Date();
    const rowsToInsert: any[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      rowsToInsert.push({
        employee_id: issueEmployeeId,
        advance_date: dateStr,
        amount: installment,
        total_amount: total,
        installment_months: months,
        installment_index: i + 1,
        notes: `Uniform: ${issueItem.item_name}${issueItem.size ? " " + issueItem.size : ""}${issueItem.color ? " " + issueItem.color : ""} × ${qty} (installment ${i + 1}/${months})`,
        created_by: u.user?.id,
      });
    }
    const { error: advErr } = await supabase.from("uniform_advances").insert(rowsToInsert as any);
    if (advErr) { toast.error("Advance error: " + advErr.message); return; }
    toast.success(`Issued ${qty} × ${issueItem.item_name}. LKR ${total.toLocaleString()} split over ${months} months (LKR ${installment.toLocaleString()}/mo).`);
    setIssueItem(null); setIssueQty("1"); setIssueEmployeeId(""); setIssueMonths("3");
    load();
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7" /> Inventory</h1>
          <p className="text-muted-foreground">Uniforms, epaulets, lanyards, shoes, stationaries and more</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={recalcThresholds}><Sparkles className="h-4 w-4 mr-2" />Recalculate Thresholds</Button>
          <Button variant="outline" onClick={downloadUniformTemplate}><Download className="h-4 w-4 mr-2" />Bulk Upload Format</Button>
          <Button variant="outline" onClick={downloadExport}><Download className="h-4 w-4 mr-2" />Export (.xlsx)</Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}><Upload className="h-4 w-4 mr-2" />Bulk Upload Uniforms</Button>
          <Button variant="outline" onClick={() => setInvBulkOpen(true)}><Upload className="h-4 w-4 mr-2" />Bulk Upload Inventory</Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Items</p><p className="text-2xl font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Units in Stock</p><p className="text-2xl font-bold">{totalUnits}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock Value</p><p className="text-2xl font-bold">LKR {totalValue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Critical Low Stock</p><p className="text-2xl font-bold text-destructive">{lowStockItems.length}</p></CardContent></Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Low Stock Alerts — Critical Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStockItems.map((i) => (
              <Badge key={i.id} variant="destructive" className="text-xs">
                {i.item_name}{i.size ? ` ${i.size}` : ""}{i.color ? ` ${i.color}` : ""} — {i.quantity} left (min {i.low_stock_threshold})
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <Input placeholder="Search item / size / color / supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              {CATEGORIES.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No items</TableCell></TableRow>
                  ) : filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                      <TableCell className="font-medium">
                        {i.item_name}
                        {i.epaulet_rank ? <div className="text-xs text-muted-foreground">{i.epaulet_rank}</div> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.inventory_type === "critical" ? "default" : "secondary"}>
                          {i.inventory_type === "critical" ? "Critical" : "Non-Critical"}
                        </Badge>
                      </TableCell>
                      <TableCell>{i.size || "—"}</TableCell>
                      <TableCell>{i.color || "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={isLow(i) ? "text-destructive font-semibold" : ""}>{i.quantity}</span>
                        {isLow(i) && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {i.low_stock_threshold}
                        <div className="text-xs text-muted-foreground">{i.auto_threshold ? "auto" : "manual"}</div>
                      </TableCell>
                      <TableCell className="text-right">{i.unit_cost ? `LKR ${Number(i.unit_cost).toFixed(2)}` : "—"}</TableCell>
                      <TableCell>{i.supplier || "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => { setMoveItem(i); setMoveQty(""); setMoveReason(""); }}>Adjust</Button>
                        <Button size="sm" variant="outline" onClick={() => { setSettingsItem(i); setSettingsForm({ inventory_type: i.inventory_type, low_stock_threshold: String(i.low_stock_threshold ?? 3), auto_threshold: i.auto_threshold !== false }); }}>Settings</Button>
                        <Button size="sm" variant="secondary" onClick={() => { setIssueItem(i); setIssueQty("1"); setIssueEmployeeId(""); setIssueMonths("3"); }}>
                          <UserCheck className="h-3.5 w-3.5 mr-1" />Issue
                        </Button>
                        {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* STOCK MOVEMENT INSIGHTS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5" />Stock Movement Insights</CardTitle>
          <p className="text-sm text-muted-foreground">Consumption over the last {WINDOW_DAYS} days — drives adaptive thresholds.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Issued ({WINDOW_DAYS}d)</TableHead>
                <TableHead className="text-right">Avg / month</TableHead>
                <TableHead>Velocity</TableHead>
                <TableHead className="text-right">Suggested Threshold</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insightRows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No movement recorded yet</TableCell></TableRow>
              ) : insightRows.map(({ item, stat }) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_name}{item.size ? ` ${item.size}` : ""}{item.color ? ` ${item.color}` : ""}</TableCell>
                  <TableCell><Badge variant={item.inventory_type === "critical" ? "default" : "secondary"}>{item.inventory_type === "critical" ? "Critical" : "Non-Critical"}</Badge></TableCell>
                  <TableCell className="text-right">{stat.totalIssued}</TableCell>
                  <TableCell className="text-right">{stat.perMonth.toFixed(1)}</TableCell>
                  <TableCell>
                    <Badge variant={stat.velocity === "fast" ? "default" : stat.velocity === "medium" ? "secondary" : "outline"}>
                      {stat.velocity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{stat.suggestedThreshold}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {/* ADD ITEM DIALOG */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2 col-span-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, size: "", color: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Item Name</Label>
              <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Uniform Shirt White" />
            </div>
            {SIZES[form.category] && (
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{SIZES[form.category].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {COLORS[form.category] && (
              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{COLORS[form.category].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.category === "Epaulet" && (
              <div className="space-y-2 col-span-2">
                <Label>Epaulet Rank</Label>
                <Select value={form.epaulet_rank} onValueChange={(v) => setForm({ ...form, epaulet_rank: v })}>
                  <SelectTrigger><SelectValue placeholder="Select stripes" /></SelectTrigger>
                  <SelectContent>{EPAULET_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit Cost (LKR)</Label>
              <Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Inventory Type</Label>
              <Select value={form.inventory_type} onValueChange={(v) => setForm({ ...form, inventory_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical (monitored, alerts)</SelectItem>
                  <SelectItem value="non_critical">Non-Critical (no alerts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Low Stock Threshold</Label>
              <Input type="number" min="0" value={form.low_stock_threshold} disabled={form.auto_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <Switch checked={form.auto_threshold} onCheckedChange={(v) => setForm({ ...form, auto_threshold: v })} />
              <Label>Adaptive threshold (auto-adjust from usage history)</Label>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Vendor</Label>
              <Select value={form.vendor_id || "none"} onValueChange={(v) => setForm({ ...form, vendor_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name} — {v.vendor_type}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Purchase amount = quantity × unit cost{" "}
                {parseInt(form.quantity) > 0 && form.unit_cost
                  ? `= LKR ${((parseFloat(form.unit_cost) || 0) * (parseInt(form.quantity) || 0)).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Invoice / Bill Ref</Label>
              <Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} />
            </div>
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
                    <SelectContent>
                      {["Cash", "Cheque", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.payment_method === "Cheque" && (
                  <>
                    <div className="space-y-2">
                      <Label>Cheque No</Label>
                      <Input value={form.cheque_number} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Cheque Dated To</Label>
                      <Input type="date" value={form.cheque_date} onChange={(e) => setForm({ ...form, cheque_date: e.target.value })} />
                    </div>
                  </>
                )}
              </>
            )}
            <div className="space-y-2 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={saveItem}>Add Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ITEM SETTINGS DIALOG */}
      <Dialog open={!!settingsItem} onOpenChange={(v) => !v && setSettingsItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Settings — {settingsItem?.item_name}</DialogTitle>
            <DialogDescription>
              Classification and low-stock threshold.
              {settingsItem && stats[settingsItem.id]
                ? ` Suggested: ${suggestThreshold(stats[settingsItem.id].perMonth, settingsForm.inventory_type)} (avg ${stats[settingsItem.id].perMonth.toFixed(1)}/month).`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Inventory Type</Label>
              <Select value={settingsForm.inventory_type} onValueChange={(v) => setSettingsForm({ ...settingsForm, inventory_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical (monitored, alerts)</SelectItem>
                  <SelectItem value="non_critical">Non-Critical (no alerts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={settingsForm.auto_threshold} onCheckedChange={(v) => setSettingsForm({ ...settingsForm, auto_threshold: v })} />
              <Label>Adaptive threshold</Label>
            </div>
            <div className="space-y-2">
              <Label>Low Stock Threshold {settingsForm.auto_threshold && <span className="text-xs text-muted-foreground">(auto — turn off to override)</span>}</Label>
              <Input type="number" min="0" disabled={settingsForm.auto_threshold}
                value={settingsForm.low_stock_threshold}
                onChange={(e) => setSettingsForm({ ...settingsForm, low_stock_threshold: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsItem(null)}>Cancel</Button>
              <Button onClick={saveSettings}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* STOCK ADJUST DIALOG */}
      <Dialog open={!!moveItem} onOpenChange={(v) => !v && setMoveItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {moveItem?.item_name}</DialogTitle>
            <DialogDescription>Current: {moveItem?.quantity} units</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason / Reference</Label>
              <Input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="e.g. Issued to Emp #123" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => adjust(-1)}><Minus className="h-4 w-4 mr-1" />Remove</Button>
              <Button onClick={() => adjust(1)}><PlusCircle className="h-4 w-4 mr-1" />Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BULK UPLOAD DIALOG */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Uniforms</DialogTitle>
            <DialogDescription>
              Upload the .xlsx template. Invoice No and Grand Total are read from the file. A batch entry and an accounts payable are created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Excel File (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setBulk({ ...bulk, file: e.target.files?.[0] || null })} />
              <Button variant="link" className="h-auto p-0 text-xs" onClick={downloadUniformTemplate}>Download template</Button>
            </div>
            <div className="space-y-2">
              <Label>Supplier (optional)</Label>
              <Input value={bulk.supplier} onChange={(e) => setBulk({ ...bulk, supplier: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={bulk.notes} onChange={(e) => setBulk({ ...bulk, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={processBulkUpload}><Upload className="h-4 w-4 mr-1" />Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ISSUE TO EMPLOYEE DIALOG */}
      <Dialog open={!!issueItem} onOpenChange={(v) => !v && setIssueItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Uniform — {issueItem?.item_name}</DialogTitle>
            <DialogDescription>
              Charge is auto-split across N months and posted to uniform advances.
              {issueItem?.unit_cost ? ` Unit cost: LKR ${Number(issueItem.unit_cost).toFixed(2)}` : " No unit cost set — set one first."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={issueEmployeeId} onValueChange={setIssueEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.employee_id} — {e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Deduct over (months)</Label>
                <Input type="number" min="1" value={issueMonths} onChange={(e) => setIssueMonths(e.target.value)} />
              </div>
            </div>
            {issueItem?.unit_cost && parseInt(issueQty) > 0 && (
              <div className="rounded-md border p-3 text-sm bg-muted/30">
                Total: <strong>LKR {(Number(issueItem.unit_cost) * (parseInt(issueQty) || 0)).toLocaleString()}</strong>
                {" · "}Monthly: <strong>LKR {(Number(issueItem.unit_cost) * (parseInt(issueQty) || 0) / (Math.max(1, parseInt(issueMonths) || 3))).toFixed(2)}</strong>
                {" × "}{Math.max(1, parseInt(issueMonths) || 3)} months
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIssueItem(null)}>Cancel</Button>
              <Button onClick={issueToEmployee}><UserCheck className="h-4 w-4 mr-1" />Issue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GENERAL INVENTORY BULK UPLOAD DIALOG */}
      <Dialog open={invBulkOpen} onOpenChange={setInvBulkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Inventory</DialogTitle>
            <DialogDescription>
              Upload a simple sheet with Category, Item Name, Size, Color, Quantity, Unit Cost, Vendor and Invoice No.
              Stock is added or topped up, and a purchase + expense is recorded automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Excel File (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setInvBulk({ ...invBulk, file: e.target.files?.[0] || null })} />
              <Button variant="link" className="h-auto p-0 text-xs" onClick={downloadInventoryTemplate}>Download bulk upload format</Button>
            </div>
            <div className="space-y-2">
              <Label>Default Vendor (used when the sheet has no Vendor column)</Label>
              <Select value={invBulk.vendor_id} onValueChange={(v) => setInvBulk({ ...invBulk, vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Invoice No (optional)</Label>
              <Input value={invBulk.invoice_ref} onChange={(e) => setInvBulk({ ...invBulk, invoice_ref: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={invBulk.is_paid} onCheckedChange={(v) => setInvBulk({ ...invBulk, is_paid: v })} />
              <Label>Already paid</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInvBulkOpen(false)}>Cancel</Button>
              <Button onClick={processInventoryBulk}><Upload className="h-4 w-4 mr-1" />Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssetsSection />
    </div>
  );
}
