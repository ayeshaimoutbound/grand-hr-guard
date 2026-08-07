import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

const PASSCODE_1 = "198114";
const PASSCODE_2 = "29374";

// Each group lists its tables ordered so child rows are removed before parents.
const GROUPS: { key: string; label: string; description: string; tables: string[] }[] = [
  { key: "invoices", label: "Invoices & Payments", description: "Invoices and all recorded payments", tables: ["invoice_payments", "invoices"] },
  { key: "salaries", label: "Salaries & Deductions", description: "Salary records and manual deductions", tables: ["salary_manual_deductions", "salaries"] },
  { key: "attendance", label: "Attendance & Overtime", description: "Attendance entries and OT logs", tables: ["overtime_entries", "attendance"] },
  { key: "advances", label: "Advances", description: "Cash, food and uniform advances", tables: ["cash_advances", "food_advances", "uniform_advances"] },
  { key: "food", label: "Food Charges", description: "Monthly meal charges", tables: ["food_charges"] },
  { key: "inventory_tx", label: "Inventory Movements & Purchases", description: "Stock movements, purchases and uniform batches", tables: ["inventory_movements", "inventory_purchases", "uniform_batches"] },
  { key: "maintenance", label: "Maintenance Records", description: "Repairs, services and utilities", tables: ["maintenance_records"] },
  { key: "expenses", label: "Expenses", description: "All expense entries", tables: ["expenses"] },
  { key: "inventory_items", label: "Inventory Items (master)", description: "Item catalogue and stock levels", tables: ["inventory_items"] },
  { key: "assets", label: "Company Assets (master)", description: "Laptops, vehicles, furniture etc.", tables: ["assets"] },
  { key: "food_master", label: "Food Rates & Vendors (master)", description: "Meal rates and food vendors", tables: ["food_rates", "food_vendors"] },
  { key: "vendors", label: "Vendors (master)", description: "All vendor records", tables: ["vendors"] },
];

export default function ResetDataSection() {
  const [open, setOpen] = useState(false);
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const chosen = GROUPS.filter((g) => selected[g.key]);
  const toggle = (key: string, v: boolean) => setSelected((s) => ({ ...s, [key]: v }));
  const setAll = (v: boolean) => setSelected(Object.fromEntries(GROUPS.map((g) => [g.key, v])));

  const reset = async () => {
    if (code1.trim() !== PASSCODE_1 || code2.trim() !== PASSCODE_2) {
      toast.error("Both passcodes must be correct");
      return;
    }
    if (!chosen.length) {
      toast.error("Select at least one data type to clear");
      return;
    }
    if (!confirm(`This permanently deletes: ${chosen.map((g) => g.label).join(", ")}. Continue?`)) return;

    setBusy(true);
    const failed: string[] = [];
    for (const t of chosen.flatMap((g) => g.tables)) {
      const { error } = await (supabase.from(t as any) as any).delete().not("id", "is", null);
      if (error) failed.push(`${t}: ${error.message}`);
    }
    setBusy(false);
    setCode1(""); setCode2("");
    if (failed.length) {
      toast.error(`Some tables failed: ${failed[0]}`);
    } else {
      toast.success("Selected data cleared. Employees and companies were kept.");
      setSelected({});
      setOpen(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" /> Danger Zone — Reset Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select exactly which data to clear — attendance, salaries, invoices, payments, advances, food, inventory,
          maintenance, expenses or master lists. Employees and companies are always kept. Requires two passcodes.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Reset Data
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Data Reset</DialogTitle>
            <DialogDescription>Choose the data to clear and enter both authorisation passcodes. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Data to clear ({chosen.length} selected)</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAll(true)}>Select all</Button>
                <Button size="sm" variant="outline" onClick={() => setAll(false)}>Clear</Button>
              </div>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              {GROUPS.map((g) => (
                <div key={g.key} className="flex items-start gap-3">
                  <Checkbox
                    id={`reset-${g.key}`}
                    checked={!!selected[g.key]}
                    onCheckedChange={(v) => toggle(g.key, v === true)}
                  />
                  <div>
                    <Label htmlFor={`reset-${g.key}`} className="cursor-pointer">{g.label}</Label>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Passcode 1</Label>
              <Input type="password" value={code1} onChange={(e) => setCode1(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Passcode 2</Label>
              <Input type="password" value={code2} onChange={(e) => setCode2(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant="destructive" onClick={reset} disabled={busy}>
                {busy ? "Clearing..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
