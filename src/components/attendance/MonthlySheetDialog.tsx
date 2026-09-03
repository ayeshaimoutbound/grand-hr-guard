import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, UserPlus } from "lucide-react";
import { QuickAddEmployeeDialog } from "@/components/QuickAddEmployeeDialog";

interface Employee { id: string; employee_id: string; full_name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  companyName: string;
  selectedMonth: Date;
  employees: Employee[];
  activeRanks: string[];
  /** `${employeeId}|${rank}|${date}|${shift}` for records that already exist. */
  existingKeys: Set<string>;
  onDone: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function MonthlySheetDialog({
  open, onOpenChange, companyId, companyName, selectedMonth,
  employees, activeRanks, existingKeys, onDone,
}: Props) {
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const monthLabel = selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [ranks, setRanks] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Employees created from this dialog during the session, merged with the prop list.
  const [extra, setExtra] = useState<Employee[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const allEmployees = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    return [...employees, ...extra.filter((e) => !ids.has(e.id))];
  }, [employees, extra]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter((e) =>
      e.full_name.toLowerCase().includes(q) || (e.employee_id || "").toLowerCase().includes(q));
  }, [allEmployees, search]);

  const pickedIds = Object.keys(picked).filter((k) => picked[k]);
  const defaultRank = activeRanks[0] || "LSO";

  const downloadTemplate = () => {
    if (pickedIds.length === 0) { toast.error("Select at least one employee first"); return; }

    const aoa: any[][] = [];
    aoa.push([`MONTHLY TIME SHEET - ${companyName} - ${monthLabel}`]);
    aoa.push([]);

    const dayRow: any[] = ["NO", "RANK", "NAME"];
    const dnRow: any[] = ["", "", ""];
    for (let d = 1; d <= daysInMonth; d++) {
      dayRow.push(d, "");
      dnRow.push("D", "N");
    }
    dayRow.push("TOTAL");
    dnRow.push("");
    aoa.push(dayRow, dnRow);

    employees
      .filter((e) => picked[e.id])
      .forEach((e) => {
        const row: any[] = [e.employee_id || "", ranks[e.id] || defaultRank, e.full_name];
        for (let d = 1; d <= daysInMonth; d++) row.push("", "");
        row.push("");
        aoa.push(row);
      });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 24 }, ...Array(daysInMonth * 2).fill({ wch: 3 }), { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(
      wb,
      `Attendance_${companyName.replace(/[^a-z0-9]+/gi, "_")}_${selectedMonth.getFullYear()}-${pad(selectedMonth.getMonth() + 1)}.xlsx`
    );
    toast.success("Template downloaded — mark 1 under each shift worked");
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      const headerIdx = rows.findIndex(
        (r) => String(r?.[0] ?? "").trim().toUpperCase() === "NO" &&
          String(r?.[2] ?? "").trim().toUpperCase() === "NAME"
      );
      if (headerIdx === -1) {
        toast.error("Could not find the header row (NO / RANK / NAME). Use the downloaded format.");
        return;
      }

      const byNo = new Map(employees.filter((e) => e.employee_id).map((e) => [String(e.employee_id).trim().toLowerCase(), e]));
      const byName = new Map(employees.map((e) => [e.full_name.trim().toLowerCase(), e]));

      const y = selectedMonth.getFullYear();
      const m = selectedMonth.getMonth() + 1;
      const inserts: any[] = [];
      const unknown: string[] = [];
      let skipped = 0;

      for (let i = headerIdx + 2; i < rows.length; i++) {
        const row = rows[i] || [];
        const no = String(row[0] ?? "").trim();
        const name = String(row[2] ?? "").trim();
        if (!no && !name) continue;
        if (no.toLowerCase() === "total") continue;

        const emp = byNo.get(no.toLowerCase()) || byName.get(name.toLowerCase());
        if (!emp) { if (name || no) unknown.push(name || no); continue; }

        const rank = (String(row[1] ?? "").trim().toUpperCase() || defaultRank);

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${y}-${pad(m)}-${pad(d)}`;
          const cells: Array<["Day" | "Night", any]> = [
            ["Day", row[3 + (d - 1) * 2]],
            ["Night", row[4 + (d - 1) * 2]],
          ];
          for (const [shift, val] of cells) {
            const marked = String(val ?? "").trim();
            if (!marked || marked === "0") continue;
            const key = `${emp.id}|${rank}|${dateStr}|${shift}`;
            if (existingKeys.has(key)) { skipped++; continue; }
            inserts.push({
              employee_id: emp.id,
              company_id: companyId,
              attendance_date: dateStr,
              present: true,
              shift_type: shift,
              rank,
            });
          }
        }
      }

      if (inserts.length === 0) {
        toast.error(skipped ? `No new shifts — ${skipped} already recorded` : "No marked shifts found in the sheet");
        return;
      }

      const { error } = await supabase.from("attendance").insert(inserts);
      if (error) { toast.error(error.message); return; }

      toast.success(
        `${inserts.length} shifts uploaded${skipped ? `, ${skipped} already existed` : ""}` +
        (unknown.length ? ` — not matched: ${[...new Set(unknown)].slice(0, 5).join(", ")}` : "")
      );
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to read the file");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Monthly Attendance Sheet — {monthLabel}</DialogTitle>
          <DialogDescription>
            Select the employees working at {companyName}, download the sheet with their names filled in,
            mark "1" under each day/shift worked (D = Day, N = Night), then upload it back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => {
                const all: Record<string, boolean> = { ...picked };
                const allPicked = filtered.every((e) => picked[e.id]);
                filtered.forEach((e) => { all[e.id] = !allPicked; });
                setPicked(all);
              }}
            >
              Select all
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={!!picked[e.id]}
                  onCheckedChange={(v) => setPicked((p) => ({ ...p, [e.id]: !!v }))}
                />
                <span className="flex-1 text-sm">
                  {e.full_name}{e.employee_id ? ` (${e.employee_id})` : ""}
                </span>
                <Select
                  value={ranks[e.id] || defaultRank}
                  onValueChange={(v) => setRanks((r) => ({ ...r, [e.id]: v }))}
                >
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeRanks.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">No employees found.</div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">{pickedIds.length} selected</div>

          <div>
            <Label className="text-sm">Upload filled sheet</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="mt-1"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
