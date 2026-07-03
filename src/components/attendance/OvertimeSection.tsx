import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcOvertimeHours } from "@/lib/salaryEngine";

interface Props {
  companyId: string;
  selectedMonth: Date;
  employees: { id: string; full_name: string; employee_id: string }[];
}

interface OTEntry {
  id: string;
  employee_id: string;
  company_id: string;
  ot_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  ot_rate: number;
  amount: number;
  reason: string;
}

export default function OvertimeSection({ companyId, selectedMonth, employees }: Props) {
  const [entries, setEntries] = useState<OTEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OTEntry | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    ot_date: "",
    start_time: "",
    end_time: "",
    ot_rate: "",
    reason: "",
  });

  const startDate = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}-${String(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const load = async () => {
    const { data, error } = await supabase
      .from("overtime_entries")
      .select("*")
      .eq("company_id", companyId)
      .gte("ot_date", startDate)
      .lte("ot_date", endDate)
      .order("ot_date", { ascending: true });
    if (error) { toast.error("Error loading overtime"); return; }
    setEntries((data || []) as OTEntry[]);
  };

  useEffect(() => { if (companyId) load(); }, [companyId, startDate, endDate]);

  const hoursPreview = useMemo(() => {
    if (!form.start_time || !form.end_time) return 0;
    try { return calcOvertimeHours(form.start_time, form.end_time); } catch { return 0; }
  }, [form.start_time, form.end_time]);

  const empName = (id: string) => employees.find(e => e.id === id)?.full_name || id;

  const openCreate = () => {
    setEditing(null);
    setForm({ employee_id: "", ot_date: startDate, start_time: "", end_time: "", ot_rate: "", reason: "" });
    setOpen(true);
  };

  const openEdit = (e: OTEntry) => {
    setEditing(e);
    setForm({
      employee_id: e.employee_id,
      ot_date: e.ot_date,
      start_time: e.start_time?.slice(0, 5) || "",
      end_time: e.end_time?.slice(0, 5) || "",
      ot_rate: String(e.ot_rate),
      reason: e.reason,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.employee_id || !form.ot_date || !form.start_time || !form.end_time || !form.ot_rate || !form.reason.trim()) {
      toast.error("All fields including Reason are required");
      return;
    }
    const rate = parseFloat(form.ot_rate);
    if (!rate || rate <= 0) { toast.error("Rate must be > 0"); return; }
    const hours = calcOvertimeHours(form.start_time, form.end_time);
    if (hours <= 0) { toast.error("Invalid time range"); return; }
    const amount = hours * rate;
    const { data: u } = await supabase.auth.getUser();

    if (editing) {
      const { error } = await supabase.from("overtime_entries").update({
        employee_id: form.employee_id, ot_date: form.ot_date,
        start_time: form.start_time, end_time: form.end_time,
        hours, ot_rate: rate, amount, reason: form.reason.trim(),
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Overtime updated");
    } else {
      const { error } = await supabase.from("overtime_entries").insert({
        employee_id: form.employee_id, company_id: companyId,
        ot_date: form.ot_date, start_time: form.start_time, end_time: form.end_time,
        hours, ot_rate: rate, amount, reason: form.reason.trim(),
        created_by: u.user?.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Overtime logged");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this overtime entry?")) return;
    const { error } = await supabase.from("overtime_entries").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Overtime (O/T)</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Overtime</Button>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No overtime logged this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{empName(e.employee_id)}</TableCell>
                  <TableCell>{new Date(e.ot_date).toLocaleDateString()}</TableCell>
                  <TableCell>{e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)}</TableCell>
                  <TableCell className="text-right">{e.hours}</TableCell>
                  <TableCell className="text-right">LKR {Number(e.ot_rate).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">LKR {Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={e.reason}>{e.reason}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Overtime</DialogTitle>
            <DialogDescription>Partial hours round UP to the next full hour. End before start = crosses midnight.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" min={startDate} max={endDate} value={form.ot_date} onChange={e => setForm({ ...form, ot_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hours (auto)</Label>
                <Input value={hoursPreview} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>O/T Rate (LKR/hour)</Label>
                <Input type="number" step="0.01" value={form.ot_rate} onChange={e => setForm({ ...form, ot_rate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Why was OT required?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Update" : "Save"} Overtime</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
