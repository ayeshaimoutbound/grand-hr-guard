import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { canResetData, RESET_GROUPS } from "@/lib/resetGroups";

export default function ResetDataSection() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const chosen = RESET_GROUPS.filter((g) => selected[g.key]);
  if (!canResetData(role)) return null;

  const reset = async () => {
    if (confirmation !== "DELETE" || !chosen.length) return;
    if (!confirm(`Permanently erase ${chosen.map((g) => g.label).join(", ")}, including the linked records listed? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("reset_module_data", { modules: chosen.map((g) => g.key), confirmation });
      if (error) throw error;
      toast.success("Selected data cleared");
      setOpen(false); setSelected({}); setConfirmation("");
    } catch (e: any) { toast.error("No data was cleared: " + e.message); }
    finally { setBusy(false); }
  };

  return <Card className="border-destructive/40">
    <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Danger Zone — Reset Data</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Super Admin only. Choose individual data types to erase. Download a backup first. Linked records may also be removed, as listed below.</p>
      <Button variant="destructive" onClick={() => setOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Reset Data</Button>
    </CardContent>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); setConfirmation(""); } }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Confirm Data Reset</DialogTitle><DialogDescription>Only selected data and its listed linked records will be erased. User accounts and access settings are kept.</DialogDescription></DialogHeader>
        <Label>Data to clear ({chosen.length} selected)</Label>
        <div className="space-y-3">
          {RESET_GROUPS.map((g) => <div key={g.key} className="flex items-start gap-3">
            <Checkbox id={`reset-${g.key}`} checked={!!selected[g.key]} disabled={busy} onCheckedChange={(v) => setSelected((s) => ({ ...s, [g.key]: v === true }))} />
            <div><Label htmlFor={`reset-${g.key}`} className="cursor-pointer">{g.label}</Label><p className="text-xs text-muted-foreground">{g.description}</p></div>
          </div>)}
        </div>
        <Label htmlFor="reset-confirm">Type DELETE to confirm</Label>
        <Input id="reset-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} autoComplete="off" />
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" onClick={reset} disabled={busy || !chosen.length || confirmation !== "DELETE"}>{busy ? "Clearing…" : "Permanently Delete"}</Button></div>
      </DialogContent>
    </Dialog>
  </Card>;
}