import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CompanyCombobox } from "@/components/CompanyCombobox";
import { fetchRateOverrides, type RateOverride } from "@/lib/employeeRates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: { id: string; full_name: string } | null;
  onSaved?: () => void;
}

const RANKS = ["OIC", "SSO", "JSO", "LSO"] as const;

export default function EmployeeRatesDialog({ open, onOpenChange, employee, onSaved }: Props) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [rows, setRows] = useState<RateOverride[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [rank, setRank] = useState<string>("LSO");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!employee) return;
    setRows(await fetchRateOverrides(employee.id));
  };

  useEffect(() => {
    if (!open) return;
    supabase.from("companies").select("*").order("company_name").then(({ data }) => setCompanies(data || []));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const company = companies.find((c) => c.id === companyId);
  const standardRate = company ? Number(company[`pay_${rank.toLowerCase()}`]) || 0 : null;

  const save = async () => {
    if (!employee || !companyId) { toast.error("Please select a company/location first"); return; }
    const value = parseFloat(rate);
    if (!Number.isFinite(value) || value < 0) { toast.error("Invalid number: enter the pay per shift for this employee"); return; }
    const { error } = await (supabase as any).from("employee_rate_overrides").upsert(
      { employee_id: employee.id, company_id: companyId, rank, pay_rate: value, notes: notes || null },
      { onConflict: "employee_id,company_id,rank" },
    );
    if (error) { toast.error("Could not save rate: " + error.message); return; }
    toast.success("Custom rate saved — salaries will use it");
    setRate(""); setNotes("");
    load(); onSaved?.();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("employee_rate_overrides").delete().eq("id", id);
    if (error) { toast.error("Could not remove rate: " + error.message); return; }
    toast.success("Custom rate removed — standard company rate applies");
    load(); onSaved?.();
  };

  const name = (id: string) => {
    const c = companies.find((x) => x.id === id);
    return c ? `${c.company_name}${c.location ? ` — ${c.location}` : ""}` : "—";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Custom pay rates — {employee?.full_name}</DialogTitle>
          <DialogDescription>
            Exceptions to the company's standard pay per shift. They apply to this employee's salary for that location and rank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Company / location</Label>
            <CompanyCombobox value={companyId} onChange={setCompanyId} companies={companies} placeholder="Select company" />
          </div>
          <div className="space-y-1">
            <Label>Rank</Label>
            <Select value={rank} onValueChange={setRank}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pay per shift (LKR)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
              placeholder={standardRate !== null ? `Standard: ${standardRate}` : ""} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason (optional)" />
          </div>
        </div>
        <Button onClick={save}>Save rate</Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead><TableHead>Rank</TableHead>
              <TableHead className="text-right">Rate</TableHead><TableHead>Notes</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No custom rates — standard company rates apply</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{name(r.company_id)}</TableCell>
                <TableCell>{r.rank}</TableCell>
                <TableCell className="text-right">LKR {Number(r.pay_rate).toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{r.notes || ""}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
