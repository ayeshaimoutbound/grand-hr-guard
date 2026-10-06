import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PDF_HEADER_STYLES, getPdfHeaderHtml } from "@/lib/pdfHeader";
import { toDateStr } from "@/lib/dateUtils";

interface Line { item: string; size: string; color: string; qty: string; remarks: string }
const EMPTY: Line = { item: "", size: "", color: "", qty: "", remarks: "" };
const ITEMS = ["Shirt (Men)", "Trouser (Men)", "Blouse (Women)", "Skirt (Women)", "Shoes", "Epaulet", "Lanyard", "Belt", "Cap", "Umbrella", "Other"];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fmt = (d: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "");

export default function UniformRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [vendors, setVendors] = useState<{ vendor_name: string; contact_person: string | null; address: string | null; phone: string | null; email: string | null }[]>([]);
  const [supplier, setSupplier] = useState("");
  const [attn, setAttn] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(toDateStr());
  const [requiredBy, setRequiredBy] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY }]);

  useEffect(() => {
    if (!open) return;
    const d = new Date();
    setRef(`GSS/UR/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`);
    supabase.from("vendors").select("vendor_name, contact_person, address, phone, email").order("vendor_name")
      .then(({ data }) => setVendors((data as any) || []));
  }, [open]);

  const pickSupplier = (name: string) => {
    setSupplier(name);
    const v = vendors.find((x) => x.vendor_name === name);
    if (v) { setAttn(v.contact_person || ""); setAddress([v.address, v.phone, v.email].filter(Boolean).join("\n")); }
  };

  const setLine = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const generate = () => {
    const valid = lines.filter((l) => l.item.trim() && parseInt(l.qty) > 0);
    if (!supplier.trim()) { toast.error("Please enter the supplier name"); return; }
    if (!valid.length) { toast.error("Add at least one item with a quantity"); return; }
    const total = valid.reduce((s, l) => s + parseInt(l.qty), 0);
    const w = window.open("", "_blank");
    if (!w) { toast.error("Please allow pop-ups to download the request"); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Uniform Request ${esc(ref)}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;font-size:12px;color:#111}${PDF_HEADER_STYLES}
      .meta{display:flex;justify-content:space-between;margin-bottom:16px}.meta div{line-height:1.6}
      table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #cfd8d6;padding:7px;text-align:left}
      th{background:#e6f4ef;color:#014d3a}.r{text-align:right}.tot{font-weight:bold;background:#f4faf7}
      .sig{margin-top:60px;display:flex;justify-content:space-between}.sig div{width:40%;border-top:1px solid #444;padding-top:6px;text-align:center}
      p{line-height:1.6}</style></head><body>
      ${getPdfHeaderHtml("REQUEST FOR QUOTATION — UNIFORMS")}
      <div class="meta">
        <div><b>To:</b> ${esc(supplier)}<br/>${attn ? `<b>Attn:</b> ${esc(attn)}<br/>` : ""}${esc(address).replace(/\n/g, "<br/>")}</div>
        <div style="text-align:right"><b>Ref No:</b> ${esc(ref)}<br/><b>Date:</b> ${fmt(date)}<br/>${requiredBy ? `<b>Required by:</b> ${fmt(requiredBy)}` : ""}</div>
      </div>
      <p>Dear Sir/Madam,</p>
      <p>Grand Senaro Security (Pvt) Ltd kindly requests your quotation for the supply of the following uniform items. Please send us your best prices and delivery time.</p>
      <table><thead><tr><th style="width:36px">#</th><th>Item</th><th>Size</th><th>Colour</th><th class="r">Quantity</th><th>Remarks</th></tr></thead><tbody>
      ${valid.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.item)}</td><td>${esc(l.size) || "—"}</td><td>${esc(l.color) || "—"}</td><td class="r">${parseInt(l.qty)}</td><td>${esc(l.remarks)}</td></tr>`).join("")}
      <tr class="tot"><td colspan="4">TOTAL QUANTITY</td><td class="r">${total}</td><td></td></tr></tbody></table>
      ${notes.trim() ? `<p><b>Notes:</b><br/>${esc(notes).replace(/\n/g, "<br/>")}</p>` : ""}
      <p>Thank you.<br/>Yours faithfully,</p>
      <div class="sig"><div>Authorised Signature</div><div>Date</div></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uniform Request Form</DialogTitle>
          <DialogDescription>Fill in the items and quantities. You'll get a letter on the company letterhead to send to the supplier. No prices are included.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Input list="ur-vendors" value={supplier} onChange={(e) => pickSupplier(e.target.value)} placeholder="Type or pick a supplier" />
            <datalist id="ur-vendors">{vendors.map((v) => <option key={v.vendor_name} value={v.vendor_name} />)}</datalist>
          </div>
          <div className="space-y-1"><Label>Attention (optional)</Label><Input value={attn} onChange={(e) => setAttn(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Supplier address / contact (optional)</Label><Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="space-y-1"><Label>Reference No</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Required by (optional)</Label><Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} /></div>
        </div>

        <div className="space-y-2">
          <Label>Items</Label>
          <datalist id="ur-items">{ITEMS.map((i) => <option key={i} value={i} />)}</datalist>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <Input className="col-span-4" list="ur-items" placeholder="Item" value={l.item} onChange={(e) => setLine(i, "item", e.target.value)} />
              <Input className="col-span-2" placeholder="Size" value={l.size} onChange={(e) => setLine(i, "size", e.target.value)} />
              <Input className="col-span-2" placeholder="Colour" value={l.color} onChange={(e) => setLine(i, "color", e.target.value)} />
              <Input className="col-span-1 px-2" type="number" min="1" placeholder="Qty" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
              <Input className="col-span-2" placeholder="Remarks" value={l.remarks} onChange={(e) => setLine(i, "remarks", e.target.value)} />
              <Button className="col-span-1" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { ...EMPTY }])}><Plus className="h-4 w-4 mr-1" />Add item</Button>
        </div>
        <div className="space-y-1"><Label>Notes (optional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery address, special instructions..." /></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={generate}><Printer className="h-4 w-4 mr-2" />Create & Download (PDF)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
