import { useState } from "react";
import { toDateStr, toMonthStr } from "@/lib/dateUtils";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { useRef } from "react";

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
  { table: "uniform_batches", dateCol: "upload_date", sheet: "UniformBatches" },
  { table: "uniform_advances", dateCol: "advance_date", sheet: "UniformAdvances" },
  { table: "food_charges", dateCol: "month", sheet: "FoodCharges" },
  { table: "inventory_items", dateCol: null, sheet: "Inventory" },
  { table: "inventory_movements", dateCol: "moved_at", sheet: "InventoryMoves" },
];

export default function BackupSection() {
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const today = toDateStr();
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const restoreBackup = async (file: File) => {
    if (!confirm("Restore this backup? Records in the file will be added back, and records with the same ID will be overwritten with the backup version. Nothing else is deleted.")) return;
    setRestoring(true);
    const summary: string[] = [];
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      for (const { table, sheet } of BACKUP_TABLES) {
        const ws = wb.Sheets[sheet.slice(0, 31)];
        if (!ws) continue;
        const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
        const rows = raw.filter((r) => r.id).map((r) => {
          const o: any = {};
          for (const [k, v] of Object.entries(r)) {
            if (v === "") o[k] = null;
            else if (typeof v === "string" && /^[\[{]/.test(v)) { try { o[k] = JSON.parse(v); } catch { o[k] = v; } }
            else o[k] = v;
          }
          return o;
        });
        if (!rows.length) continue;
        let ok = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from(table as any).upsert(rows.slice(i, i + 500), { onConflict: "id" });
          if (error) { summary.push(`${sheet}: ${error.message}`); break; }
          ok += Math.min(500, rows.length - i);
        }
        if (ok) summary.push(`${sheet}: ${ok} restored`);
      }
      toast.success("Restore finished", { description: summary.join(" · ") || "No records found in the file" });
    } catch (e: any) {
      toast.error("Restore failed: " + e.message, { description: "Make sure you chose a backup file downloaded from this page." });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={(e) => e.target.files?.[0] && restoreBackup(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring}>
            <Upload className="h-4 w-4 mr-2" />
            {restoring ? "Restoring…" : "Restore from Backup"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Restore puts back every record in a backup file. Records with the same ID are replaced by the backup version; nothing else is deleted.</p>
      </CardContent>
    </Card>
  );
}
