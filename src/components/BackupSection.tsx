import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

// table -> date column used for range filtering (null = full snapshot)
const BACKUP_TABLES: { table: string; dateCol: string | null; sheet: string }[] = [
  { table: "employees", dateCol: null, sheet: "Employees" },
  { table: "companies", dateCol: null, sheet: "Companies" },
  { table: "attendance", dateCol: "attendance_date", sheet: "Attendance" },
  { table: "overtime_entries", dateCol: "ot_date", sheet: "Overtime" },
  { table: "salaries", dateCol: "salary_month", sheet: "Salaries" },
  { table: "salary_manual_deductions", dateCol: "salary_month", sheet: "ManualDeductions" },
  { table: "invoices", dateCol: "invoice_date", sheet: "Invoices" },
  { table: "invoice_payments", dateCol: "payment_date", sheet: "InvoicePayments" },
  { table: "expenses", dateCol: "expense_date", sheet: "Expenses" },
  { table: "cash_advances", dateCol: "advance_date", sheet: "CashAdvances" },
  { table: "food_advances", dateCol: "advance_date", sheet: "FoodAdvances" },
  { table: "uniform_advances", dateCol: "advance_date", sheet: "UniformAdvances" },
  { table: "food_charges", dateCol: "month", sheet: "FoodCharges" },
  { table: "uniform_batches", dateCol: "upload_date", sheet: "UniformBatches" },
  { table: "inventory_items", dateCol: null, sheet: "Inventory" },
  { table: "inventory_movements", dateCol: "moved_at", sheet: "InventoryMoves" },
];

export default function BackupSection() {
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const downloadBackup = async () => {
    if (!from || !to || from > to) {
      toast.error("Please choose a valid date range");
      return;
    }
    setBusy(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const { table, dateCol, sheet } of BACKUP_TABLES) {
        let query = supabase.from(table as any).select("*");
        if (dateCol) {
          query = query.gte(dateCol, from).lte(dateCol, dateCol === "moved_at" ? `${to}T23:59:59` : to);
        }
        const { data, error } = await query;
        if (error) {
          console.error(table, error);
          continue;
        }
        const rows = (data as any[]) || [];
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "No records" }]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
      }
      XLSX.writeFile(wb, `GSS_Backup_${from}_to_${to}.xlsx`);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error("Backup failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Backup</CardTitle>
        <CardDescription>
          Download a full Excel backup of all records. Dated records are filtered by the selected range;
          employees, companies and inventory items are always included in full.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={downloadBackup} disabled={busy}>
            <Download className="h-4 w-4 mr-2" />
            {busy ? "Preparing…" : "Download Backup (.xlsx)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
