import { useEffect, useMemo, useState } from "react";
import { toDateStr, toMonthStr } from "@/lib/dateUtils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, Download, Upload, FileSpreadsheet, Archive, ArchiveRestore } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RANKS = ["OIC", "SSO", "JSO", "LSO"] as const;
type RankKey = (typeof RANKS)[number];

interface Company {
  id: string;
  company_name: string;
  location: string;
  company_number: string;
  pay_oic: number;
  pay_sso: number;
  pay_jso: number;
  pay_lso: number;
  charge_oic: number;
  charge_sso: number;
  charge_jso: number;
  charge_lso: number;
  client_ot_rate?: number;
  active_ranks?: string[] | null;
  archived?: boolean;
  archived_at?: string | null;
  created_at?: string;
}

const emptyForm = {
  company_name: "",
  company_number: "",
  location: "",
  pay_oic: "",
  pay_sso: "",
  pay_jso: "",
  pay_lso: "",
  charge_oic: "",
  charge_sso: "",
  charge_jso: "",
  charge_lso: "",
  client_ot_rate: "0",
};

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({ ...emptyForm });
  const [activeRanks, setActiveRanks] = useState<RankKey[]>([...RANKS]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const [{ data, error }, { data: att }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("attendance").select("company_id, attendance_date").eq("present", true),
    ]);

    if (error) {
      toast.error("Error fetching companies");
      return;
    }

    const activity: Record<string, string> = {};
    for (const a of (att as any[]) || []) {
      const cur = activity[a.company_id];
      if (!cur || a.attendance_date > cur) activity[a.company_id] = a.attendance_date;
    }
    setLastActivity(activity);

    const list = ((data as any) || []) as Company[];
    setCompanies(list);

    // Auto-archive companies inactive for more than 2 months.
    if (isSuperAdmin) {
      const stale = list.filter((c) => !c.archived && isInactive(c, activity));
      if (stale.length) {
        await supabase
          .from("companies")
          .update({ archived: true, archived_at: new Date().toISOString() } as any)
          .in("id", stale.map((c) => c.id));
        setCompanies(list.map((c) => (stale.some((s) => s.id === c.id) ? { ...c, archived: true } : c)));
      }
    }
  };

  const cutoff = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d;
  };

  function isInactive(c: Company, activity: Record<string, string>) {
    const last = activity[c.id];
    const ref = last ? new Date(last) : c.created_at ? new Date(c.created_at) : new Date();
    return ref < cutoff();
  }

  const activeCompanies = useMemo(() => companies.filter((c) => !c.archived), [companies]);
  const archivedCompanies = useMemo(() => companies.filter((c) => c.archived), [companies]);

  const matches = (c: Company) =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.company_number || "").toLowerCase().includes(searchTerm.toLowerCase());

  // A company number belonging to an archived company is freed up for reuse.
  const reusableNumber = useMemo(() => {
    const taken = new Set(activeCompanies.map((c) => (c.company_number || "").trim()).filter(Boolean));
    const freed = archivedCompanies
      .map((c) => (c.company_number || "").trim())
      .filter((n) => n && !taken.has(n))
      .sort();
    return freed[0] || "";
  }, [activeCompanies, archivedCompanies]);

  const toggleRank = (rank: RankKey, on: boolean) => {
    setActiveRanks((prev) => (on ? Array.from(new Set([...prev, rank])) : prev.filter((r) => r !== rank)));
  };

  const openCreate = () => {
    resetForm();
    setFormData({ ...emptyForm, company_number: reusableNumber });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_name.trim() || !formData.location.trim()) {
      toast.error("Company name and location are required");
      return;
    }
    if (!activeRanks.length) {
      toast.error("Enable at least one rank for this company");
      return;
    }

    const num = (v: string) => parseFloat(v) || 0;
    for (const r of activeRanks) {
      const key = r.toLowerCase() as "oic" | "sso" | "jso" | "lso";
      if (num((formData as any)[`pay_${key}`]) <= 0 || num((formData as any)[`charge_${key}`]) <= 0) {
        toast.error(`${r} pay and charge must be greater than 0`);
        return;
      }
    }

    const payload: any = {
      company_name: formData.company_name.trim(),
      company_number: formData.company_number.trim(),
      location: formData.location.trim(),
      client_ot_rate: num(formData.client_ot_rate),
      active_ranks: activeRanks,
    };
    for (const r of RANKS) {
      const key = r.toLowerCase();
      const on = activeRanks.includes(r);
      payload[`pay_${key}`] = on ? num((formData as any)[`pay_${key}`]) : 0;
      payload[`charge_${key}`] = on ? num((formData as any)[`charge_${key}`]) : 0;
    }

    if (isEditMode && currentCompany) {
      const { error } = await supabase.from("companies").update(payload).eq("id", currentCompany.id);
      if (error) {
        toast.error("Error updating company");
        return;
      }
      toast.success("Company updated successfully");
    } else {
      const { error } = await supabase.from("companies").insert([payload]);
      if (error) {
        toast.error("Error adding company");
        return;
      }
      toast.success("Company added successfully");
    }

    resetForm();
    fetchCompanies();
    setIsDialogOpen(false);
  };

  const handleEdit = (company: Company) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit companies");
      return;
    }

    setCurrentCompany(company);
    setFormData({
      company_name: company.company_name,
      company_number: company.company_number || "",
      location: company.location,
      pay_oic: company.pay_oic.toString(),
      pay_sso: company.pay_sso.toString(),
      pay_jso: company.pay_jso.toString(),
      pay_lso: company.pay_lso.toString(),
      charge_oic: company.charge_oic.toString(),
      charge_sso: company.charge_sso.toString(),
      charge_jso: company.charge_jso.toString(),
      charge_lso: company.charge_lso.toString(),
      client_ot_rate: (company.client_ot_rate ?? 0).toString(),
    });
    setActiveRanks(
      (company.active_ranks && company.active_ranks.length
        ? (company.active_ranks as RankKey[])
        : [...RANKS]) as RankKey[]
    );
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const setArchived = async (company: Company, archived: boolean) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can archive companies");
      return;
    }
    const { error } = await supabase
      .from("companies")
      .update({ archived, archived_at: archived ? new Date().toISOString() : null } as any)
      .eq("id", company.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(archived ? "Company archived" : "Company restored");
    fetchCompanies();
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete companies");
      return;
    }

    if (!confirm("Are you sure you want to delete this company?")) return;

    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting company");
      return;
    }

    toast.success("Company deleted successfully");
    fetchCompanies();
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setActiveRanks([...RANKS]);
    setIsEditMode(false);
    setCurrentCompany(null);
  };

  const handleBulkDownload = () => {
    if (!companies.length) {
      toast.error("No companies to export");
      return;
    }
    const rows = companies.map((c) => ({
      "Company Name": c.company_name,
      "Company Number": c.company_number || "",
      Location: c.location,
      Status: c.archived ? "Archived" : "Active",
      "Active Ranks": (c.active_ranks || RANKS).join(", "),
      "OIC Pay": c.pay_oic,
      "SSO Pay": c.pay_sso,
      "JSO Pay": c.pay_jso,
      "LSO Pay": c.pay_lso,
      "OIC Charge": c.charge_oic,
      "SSO Charge": c.charge_sso,
      "JSO Charge": c.charge_jso,
      "LSO Charge": c.charge_lso,
      "Client OT Rate": c.client_ot_rate || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, `Companies_${toDateStr()}.xlsx`);
    toast.success("Companies exported");
  };

  const handleDownloadTemplate = () => {
    const sample = [{
      "Company Name": "Sample Corp",
      "Company Number": "GS-001",
      Location: "Colombo",
      "Active Ranks": "OIC, SSO, JSO, LSO",
      "OIC Pay": 2000, "SSO Pay": 1800, "JSO Pay": 1600, "LSO Pay": 1500,
      "OIC Charge": 2500, "SSO Charge": 2300, "JSO Charge": 2100, "LSO Charge": 2000,
      "Client OT Rate": 250,
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, "Companies_Bulk_Upload_Template.xlsx");
    toast.success("Template downloaded");
  };

  const handleBulkUpload = async (file: File) => {
    if (!isSuperAdmin) { toast.error("Only Super Admin can bulk upload companies"); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) { toast.error("Sheet is empty"); return; }
      let ok = 0, fail = 0;
      for (const r of rows) {
        const ranksRaw = String(r["Active Ranks"] || "").toUpperCase();
        const ranks = RANKS.filter((rk) => (ranksRaw ? ranksRaw.includes(rk) : true));
        const payload = {
          company_name: String(r["Company Name"] || r.company_name || "").trim(),
          company_number: String(r["Company Number"] || r.company_number || "").trim(),
          location: String(r.Location || r.location || "").trim(),
          active_ranks: ranks.length ? ranks : [...RANKS],
          pay_oic: parseFloat(r["OIC Pay"]) || 0,
          pay_sso: parseFloat(r["SSO Pay"]) || 0,
          pay_jso: parseFloat(r["JSO Pay"]) || 0,
          pay_lso: parseFloat(r["LSO Pay"]) || 0,
          charge_oic: parseFloat(r["OIC Charge"]) || 0,
          charge_sso: parseFloat(r["SSO Charge"]) || 0,
          charge_jso: parseFloat(r["JSO Charge"]) || 0,
          charge_lso: parseFloat(r["LSO Charge"]) || 0,
          client_ot_rate: parseFloat(r["Client OT Rate"]) || 0,
        };
        if (!payload.company_name || !payload.location) { fail++; continue; }
        const { error } = await supabase.from("companies").insert([payload as any]);
        if (error) fail++; else ok++;
      }
      toast.success(`Uploaded ${ok} companies${fail ? `, ${fail} failed` : ""}`);
      fetchCompanies();
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    }
  };

  const renderTable = (list: Company[], archivedView: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company Name</TableHead>
          <TableHead>Company No.</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Ranks</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {archivedView ? "No archived companies" : "No companies found"}
            </TableCell>
          </TableRow>
        ) : (
          list.map((company) => (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.company_name}</TableCell>
              <TableCell className="font-mono text-sm">{company.company_number || "-"}</TableCell>
              <TableCell>{company.location}</TableCell>
              <TableCell className="space-x-1">
                {(company.active_ranks && company.active_ranks.length ? company.active_ranks : RANKS).map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                ))}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {lastActivity[company.id] ? new Date(lastActivity[company.id]).toLocaleDateString() : "No attendance"}
              </TableCell>
              <TableCell className="text-right">
                {isSuperAdmin && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title={archivedView ? "Restore" : "Archive"} onClick={() => setArchived(company, !archivedView)}>
                      {archivedView ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage company information and pay rates</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk Upload Format
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download (.xlsx)
          </Button>
          {isSuperAdmin && (
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBulkUpload(f);
                  e.target.value = "";
                }}
              />
              <Button asChild variant="outline" size="sm">
                <span><Upload className="h-4 w-4 mr-2" />Bulk Upload</span>
              </Button>
            </label>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Company" : "Add New Company"}</DialogTitle>
            <DialogDescription>
              Toggle the ranks this company uses — only enabled ranks need pay and charge rates.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_number">Company Number</Label>
                <Input
                  id="company_number"
                  value={formData.company_number}
                  onChange={(e) => setFormData({ ...formData, company_number: e.target.value })}
                  placeholder="e.g., GS-001"
                  required
                />
                {!isEditMode && reusableNumber && (
                  <p className="text-xs text-muted-foreground">
                    Number <span className="font-mono">{reusableNumber}</span> freed up from an archived company and reused here.
                  </p>
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Ranks Used by This Company</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {RANKS.map((r) => (
                  <div key={r} className="flex items-center gap-2 rounded-md border p-2">
                    <Switch
                      checked={activeRanks.includes(r)}
                      onCheckedChange={(v) => toggleRank(r, v)}
                      aria-label={`Toggle ${r}`}
                    />
                    <span className="text-sm font-medium">{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Amount Given to Employee per Shift (LKR)</h3>
              <div className="grid grid-cols-2 gap-4">
                {RANKS.filter((r) => activeRanks.includes(r)).map((r) => {
                  const key = `pay_${r.toLowerCase()}`;
                  return (
                    <div className="space-y-2" key={key}>
                      <Label htmlFor={key}>{r} Pay</Label>
                      <Input
                        id={key}
                        type="number"
                        step="0.01"
                        value={(formData as any)[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value } as any)}
                        required
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Amount Charged to Company per Shift (LKR)</h3>
              <div className="grid grid-cols-2 gap-4">
                {RANKS.filter((r) => activeRanks.includes(r)).map((r) => {
                  const key = `charge_${r.toLowerCase()}`;
                  return (
                    <div className="space-y-2" key={key}>
                      <Label htmlFor={key}>{r} Charge</Label>
                      <Input
                        id={key}
                        type="number"
                        step="0.01"
                        value={(formData as any)[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value } as any)}
                        required
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Client Overtime Billing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_ot_rate">Client O/T Rate (LKR/hour)</Label>
                  <Input
                    id="client_ot_rate"
                    type="number"
                    step="0.01"
                    value={formData.client_ot_rate}
                    onChange={(e) => setFormData({ ...formData, client_ot_rate: e.target.value })}
                    placeholder="0 = don't bill OT"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{isEditMode ? "Update" : "Add"} Company</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name, number or location..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({activeCompanies.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedCompanies.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              {renderTable(activeCompanies.filter(matches), false)}
            </TabsContent>
            <TabsContent value="archived" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Companies with no attendance for more than 2 months are archived automatically. Their company numbers are freed up and reused for the next company you add.
              </p>
              {renderTable(archivedCompanies.filter(matches), true)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
