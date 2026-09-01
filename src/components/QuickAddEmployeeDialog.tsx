import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export interface QuickAddEmployeeResult {
  id: string;
  employee_id: string;
  full_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called with the newly created employee so the caller can select it. */
  onCreated: (employee: QuickAddEmployeeResult) => void;
  defaultName?: string;
}

const EMPTY = {
  full_name: "",
  employee_id: "",
  epf_no: "",
  nic: "",
  phone_number: "",
  bank_name: "",
  branch: "",
  account_number: "",
};

export function QuickAddEmployeeDialog({ open, onOpenChange, onCreated, defaultName = "" }: Props) {
  const [form, setForm] = useState({ ...EMPTY, full_name: defaultName });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("employees")
      .insert({
        // Employee No and EPF No are optional at onboarding and can be edited later.
        employee_id: form.employee_id.trim() || null,
        epf_no: form.epf_no.trim() || null,
        full_name: form.full_name.trim(),
        nic: form.nic.trim(),
        phone_number: form.phone_number.trim(),
        bank_name: form.bank_name.trim(),
        branch: form.branch.trim(),
        account_number: form.account_number.trim(),
        created_by: u.user?.id,
      } as any)
      .select("id, employee_id, full_name")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee added");
    onCreated({ ...(data as any), employee_id: (data as any).employee_id || "" });
    setForm({ ...EMPTY });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            Only the full name is required. Employee No and EPF No can be added later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Employee No (optional)</Label>
            <Input value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>EPF No (optional)</Label>
            <Input value={form.epf_no} onChange={(e) => set("epf_no", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>NIC</Label>
            <Input value={form.nic} onChange={(e) => set("nic", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bank</Label>
            <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input value={form.branch} onChange={(e) => set("branch", e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Account No</Label>
            <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add Employee"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
