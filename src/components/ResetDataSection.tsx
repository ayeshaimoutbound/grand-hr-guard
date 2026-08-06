import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

const PASSCODE_1 = "198114";
const PASSCODE_2 = "29374";

// Ordered so child rows are removed before their parents.
const TRANSACTION_TABLES = [
  "invoice_payments",
  "invoices",
  "salary_manual_deductions",
  "salaries",
  "overtime_entries",
  "attendance",
  "cash_advances",
  "food_advances",
  "uniform_advances",
  "food_charges",
  "inventory_movements",
  "inventory_purchases",
  "uniform_batches",
  "maintenance_records",
  "expenses",
] as const;

const MASTER_TABLES = ["inventory_items", "food_rates", "food_vendors", "vendors", "assets"] as const;

export default function ResetDataSection() {
  const [open, setOpen] = useState(false);
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");
  const [includeMaster, setIncludeMaster] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (code1.trim() !== PASSCODE_1 || code2.trim() !== PASSCODE_2) {
      toast.error("Both passcodes must be correct");
      return;
    }
    if (!confirm("This permanently deletes all entered data. Continue?")) return;

    setBusy(true);
    const tables: string[] = [...TRANSACTION_TABLES, ...(includeMaster ? MASTER_TABLES : [])];
    const failed: string[] = [];
    for (const t of tables) {
      const { error } = await (supabase.from(t as any) as any)
        .delete()
        .not("id", "is", null);
      if (error) failed.push(`${t}: ${error.message}`);
    }
    setBusy(false);
    setCode1(""); setCode2("");
    if (failed.length) {
      toast.error(`Some tables failed: ${failed[0]}`);
    } else {
      toast.success("All entered data cleared. Employees and companies were kept.");
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
          Clears all entered records — attendance, salaries, invoices, payments, advances, food, inventory movements,
          purchases, maintenance and expenses. Employees and companies are always kept. Requires two passcodes.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4 mr-2" /> Reset All Data
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Data Reset</DialogTitle>
            <DialogDescription>Enter both authorisation passcodes. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Passcode 1</Label>
              <Input type="password" value={code1} onChange={(e) => setCode1(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Passcode 2</Label>
              <Input type="password" value={code2} onChange={(e) => setCode2(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={includeMaster} onCheckedChange={setIncludeMaster} />
              <Label>Also clear inventory items, vendors and assets</Label>
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
