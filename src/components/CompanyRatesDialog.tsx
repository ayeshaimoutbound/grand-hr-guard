import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRateHistory, RateHistoryRow, RATE_FIELDS } from "@/lib/companyRates";
import { toMonthStr } from "@/lib/dateUtils";

const RANKS = ["oic", "sso", "jso", "lso"] as const;

interface Props {
  company: any | null;
  onClose: () => void;
}

const fmtMonth = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });

export function CompanyRatesDialog({ company, onClose }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<RateHistoryRow[]>([]);
  const [month, setMonth] = useState(toMonthStr());
  const [form, setForm] = useState<Record<string, string>>({});

  const prefill = (src: any) => {
    const f: Record<string, string> = {};
    RATE_FIELDS.forEach((k) => (f[k] = String(Number(src?.[k]) || 0)));
    setForm(f);
  };

  const load = async () => {
    if (!company) return;
    const h = await fetchRateHistory(company.id);
    setRows(h);
    prefill(h[0] || company);
  };

  useEffect(() => { if (company) { setMonth(toMonthStr()); load(); } }, [company?.id]);

  const active: string[] = company?.active_ranks || ["OIC", "SSO", "JSO", "LSO"];

  const save = async () => {
    if (!company || !month) return;
    const payload: any = { company_id: company.id, effective_month: `${month}-01`, created_by: user?.id };
    RATE_FIELDS.forEach((k) => (payload[k] = parseFloat(form[k]) || 0));
    const { error } = await (supabase as any)
      .from("company_rate_history")
      .upsert(payload, { onConflict: "company_id,effective_month" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Rates saved from ${fmtMonth(payload.effective_month)} onward. Re-save attendance or regenerate invoices for that month to apply.`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this rate change?")) return;
    const { error } = await (supabase as any).from("company_rate_history").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const field = (k: string, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly rates — {company?.company_name}</DialogTitle>
          <DialogDescription>
            Set new pay and charge rates starting from a month. They apply to that month and every later month until the next change. Earlier months keep their old rates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-w-xs space-y-1">
            <Label>Effective from month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RANKS.filter((r) => active.includes(r.toUpperCase())).map((r) => (
              <div key={r} className="space-y-2 rounded-md border border-border p-2">
                <p className="text-sm font-semibold">{r.toUpperCase()}</p>
                {field(`pay_${r}`, "Pay / shift")}
                {field(`charge_${r}`, "Charge / shift")}
              </div>
            ))}
          </div>
          <div className="max-w-xs">{field("client_ot_rate", "Client O/T rate (LKR/hour)")}</div>
          <div className="flex justify-end">
            <Button onClick={save}>Save rates for this month</Button>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Rate history</p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes yet — the company's original rates are used for all months.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    {RANKS.map((r) => <TableHead key={r} className="text-right">{r.toUpperCase()} pay / charge</TableHead>)}
                    <TableHead className="text-right">O/T</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{fmtMonth(h.effective_month)}</TableCell>
                      {RANKS.map((r) => (
                        <TableCell key={r} className="text-right text-xs">
                          {Number(h[`pay_${r}`]).toLocaleString()} / {Number(h[`charge_${r}`]).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-xs">{Number(h.client_ot_rate).toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => { setMonth(h.effective_month.slice(0, 7)); prefill(h); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(h.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
