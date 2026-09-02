import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface Employee { id: string; employee_id: string; full_name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  companyName: string;
  location?: string;
  selectedMonth: Date;
  employees: Employee[];
  activeRanks: string[];
  existingKeys: Set<string>;
  onDone: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function BulkAttendanceDialog({
  open, onOpenChange, companyId, companyName, location, selectedMonth,
  employees, activeRanks, existingKeys, onDone,
}: Props) {
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [rank, setRank] = useState<string>(activeRanks[0] || "LSO");
  const [shift, setShift] = useState<"Day" | "Night">("Day");
  const [fromDay, setFromDay] = useState(1);
  const [toDay, setToDay] = useState(daysInMonth);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      e.full_name.toLowerCase().includes(q) || (e.employee_id || "").toLowerCase().includes(q));
  }, [employees, search]);

  const pickedIds = Object.keys(picked).filter((k) => picked[k]);

  const handleSave = async () => {
    if (pickedIds.length === 0) { toast.error("Select at least one employee"); return; }
    if (fromDay < 1 || toDay > daysInMonth || fromDay > toDay) { toast.error("Invalid day range"); return; }

    setSaving(true);
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth() + 1;
    const rows: any[] = [];

    for (const empId of pickedIds) {
      for (let d = fromDay; d <= toDay; d++) {
        const dateStr = `${y}-${pad(m)}-${pad(d)}`;
        const key = `${empId}|${rank}|${dateStr}|${shift}`;
        if (existingKeys.has(key)) continue;
        rows.push({
          employee_id: empId,
          company_id: companyId,
          attendance_date: dateStr,
          present: true,
          shift_type: shift,
          rank,
        });
      }
    }

    if (rows.length === 0) {
      setSaving(false);
      toast.info("All selected shifts are already marked");
      return;
    }

    // Insert in chunks so large months don't hit request limits
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await supabase.from("attendance").insert(rows.slice(i, i + 400) as any);
      if (error) { setSaving(false); toast.error("Bulk attendance failed: " + error.message); return; }
    }

    setSaving(false);
    toast.success(`Marked ${rows.length} shifts for ${pickedIds.length} employee(s)`);
    setPicked({});
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Bulk Attendance</DialogTitle>
          <DialogDescription>
            Mark a whole date range at once for {companyName}{location ? ` — ${location}` : ""} (
            {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Rank</Label>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeRanks.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Shift</Label>
            <Select value={shift} onValueChange={(v: any) => setShift(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Day">Day</SelectItem>
                <SelectItem value="Night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From day</Label>
            <Input type="number" min={1} max={daysInMonth} value={fromDay}
              onChange={(e) => setFromDay(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>To day</Label>
            <Input type="number" min={1} max={daysInMonth} value={toDay}
              onChange={(e) => setToDay(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Employees ({pickedIds.length} selected)</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const next: Record<string, boolean> = { ...picked };
                filtered.forEach((e) => { next[e.id] = true; });
                setPicked(next);
              }}>Select all shown</Button>
              <Button variant="outline" size="sm" onClick={() => setPicked({})}>Clear</Button>
            </div>
          </div>
          <Input placeholder="Search employees by name or ID"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No employees found</p>
            ) : filtered.map((e) => (
              <label key={e.id} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/40">
                <Checkbox checked={!!picked[e.id]}
                  onCheckedChange={(c) => setPicked({ ...picked, [e.id]: !!c })} />
                <span className="text-sm">{e.full_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{e.employee_id || "—"}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Mark attendance"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
