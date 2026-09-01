import { useEffect, useMemo, useState } from "react";
import { toDateStr, toMonthStr } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EmployeeCombobox } from "@/components/EmployeeCombobox";


interface Employee { id: string; employee_id: string; full_name: string; }
interface Advance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  notes: string | null;
}

export default function Advances() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>(toMonthStr());

  // form
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState<string>(toDateStr());
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => { fetchAll(); }, [monthFilter]);

  const fetchAll = async () => {
    const [y, m] = monthFilter.split("-").map(Number);
    const start = `${monthFilter}-01`;
    const end = `${monthFilter}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    const [empRes, advRes] = await Promise.all([
      supabase.from("employees").select("id,employee_id,full_name").order("full_name"),
      supabase.from("cash_advances")
        .select("id,employee_id,advance_date,amount,notes")
        .gte("advance_date", start)
        .lte("advance_date", end)
        .order("advance_date", { ascending: false }),
    ]);
    if (empRes.error || advRes.error) { toast.error("Error loading advances"); return; }
    setEmployees(empRes.data || []);
    setAdvances((advRes.data || []) as Advance[]);
  };

  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    employees.forEach(e => (m[e.id] = e));
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return advances;
    return advances.filter(a => {
      const e = empMap[a.employee_id];
      if (!e) return false;
      return e.full_name.toLowerCase().includes(q)
        || e.employee_id.toLowerCase().includes(q)
        || (a.notes || "").toLowerCase().includes(q);
    });
  }, [advances, search, empMap]);

  const totalMonth = filtered.reduce((s, a) => s + Number(a.amount || 0), 0);

  const handleAdd = async () => {
    if (!employeeId || !amount || Number(amount) <= 0) {
      toast.error("Select employee and enter a positive amount");
      return;
    }
    const { error } = await supabase.from("cash_advances").insert({
      employee_id: employeeId,
      advance_date: date,
      amount: Number(amount),
      notes: notes || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Salary advance recorded");
    setEmployeeId(""); setAmount(""); setNotes("");
    setDate(toDateStr());
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this salary advance? It will no longer be deducted.")) return;
    const { error } = await supabase.from("cash_advances").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Advance removed");
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Salary Advances</h1>
        <p className="text-muted-foreground">
          Manually record advances paid to employees. They are automatically deducted from that month's salary.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add Salary Advance</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1 md:col-span-2">
              <Label>Employee</Label>
              <EmployeeCombobox
                value={employeeId}
                onChange={setEmployeeId}
                employees={employees}
                placeholder="Search & select employee"
              />
            </div>

            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount (LKR)</Label>
              <Input type="number" min={0} step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Button onClick={handleAdd} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Advance
              </Button>
            </div>
            <div className="md:col-span-5 space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason / reference" rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex-1 min-w-[240px]">
              <Label>Month</Label>
              <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by employee name, ID or note"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Month Total</p>
              <p className="text-2xl font-bold text-emerald-600">LKR {totalMonth.toFixed(2)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No advances for this period
                  </TableCell>
                </TableRow>
              ) : filtered.map(a => {
                const e = empMap[a.employee_id];
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.advance_date}</TableCell>
                    <TableCell>
                      <div className="font-medium">{e?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{e?.employee_id}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      LKR {Number(a.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.notes || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
