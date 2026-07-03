import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Download, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { companySchema } from "@/lib/validationSchemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const filtered = companies.filter((comp) =>
      comp.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCompanies(filtered);
  }, [searchTerm, companies]);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching companies");
      return;
    }

    setCompanies(data || []);
    setFilteredCompanies(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      company_name: formData.company_name,
      company_number: formData.company_number,
      location: formData.location,
      pay_oic: parseFloat(formData.pay_oic),
      pay_sso: parseFloat(formData.pay_sso),
      pay_jso: parseFloat(formData.pay_jso),
      pay_lso: parseFloat(formData.pay_lso),
      charge_oic: parseFloat(formData.charge_oic),
      charge_sso: parseFloat(formData.charge_sso),
      charge_jso: parseFloat(formData.charge_jso),
      charge_lso: parseFloat(formData.charge_lso),
    };

    // Validate input (client_ot_rate excluded from strict schema)
    const validation = companySchema.safeParse(payload);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    const fullPayload = { ...payload, client_ot_rate: parseFloat(formData.client_ot_rate) || 0 };

    if (isEditMode && currentCompany) {
      const { error } = await supabase
        .from("companies")
        .update(fullPayload)
        .eq("id", currentCompany.id);

      if (error) {
        toast.error("Error updating company");
        return;
      }
      toast.success("Company updated successfully");
    } else {
      const { error } = await supabase.from("companies").insert([fullPayload]);

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
    setIsEditMode(true);
    setIsDialogOpen(true);
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
    setFormData({
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
    });
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
    XLSX.writeFile(wb, `Companies_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Companies exported");
  };

  const handleDownloadTemplate = () => {
    const sample = [{
      "Company Name": "Sample Corp",
      "Company Number": "GS-001",
      Location: "Colombo",
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
        const payload = {
          company_name: String(r["Company Name"] || r.company_name || "").trim(),
          company_number: String(r["Company Number"] || r.company_number || "").trim(),
          location: String(r.Location || r.location || "").trim(),
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
        const { error } = await supabase.from("companies").insert([payload]);
        if (error) fail++; else ok++;
      }
      toast.success(`Uploaded ${ok} companies${fail ? `, ${fail} failed` : ""}`);
      fetchCompanies();
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    }
  };

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Company" : "Add New Company"}</DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update company information and pay rates"
                  : "Enter company details and pay rates for all ranks"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <h3 className="text-sm font-semibold mb-3">Amount Given to Employee per Shift (LKR)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pay_oic">OIC Pay</Label>
                    <Input
                      id="pay_oic"
                      type="number"
                      step="0.01"
                      value={formData.pay_oic}
                      onChange={(e) => setFormData({ ...formData, pay_oic: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay_sso">SSO Pay</Label>
                    <Input
                      id="pay_sso"
                      type="number"
                      step="0.01"
                      value={formData.pay_sso}
                      onChange={(e) => setFormData({ ...formData, pay_sso: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay_jso">JSO Pay</Label>
                    <Input
                      id="pay_jso"
                      type="number"
                      step="0.01"
                      value={formData.pay_jso}
                      onChange={(e) => setFormData({ ...formData, pay_jso: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay_lso">LSO Pay</Label>
                    <Input
                      id="pay_lso"
                      type="number"
                      step="0.01"
                      value={formData.pay_lso}
                      onChange={(e) => setFormData({ ...formData, pay_lso: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3">Amount Charged to Company per Shift (LKR)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="charge_oic">OIC Charge</Label>
                    <Input
                      id="charge_oic"
                      type="number"
                      step="0.01"
                      value={formData.charge_oic}
                      onChange={(e) => setFormData({ ...formData, charge_oic: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge_sso">SSO Charge</Label>
                    <Input
                      id="charge_sso"
                      type="number"
                      step="0.01"
                      value={formData.charge_sso}
                      onChange={(e) => setFormData({ ...formData, charge_sso: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge_jso">JSO Charge</Label>
                    <Input
                      id="charge_jso"
                      type="number"
                      step="0.01"
                      value={formData.charge_jso}
                      onChange={(e) => setFormData({ ...formData, charge_jso: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge_lso">LSO Charge</Label>
                    <Input
                      id="charge_lso"
                      type="number"
                      step="0.01"
                      value={formData.charge_lso}
                      onChange={(e) => setFormData({ ...formData, charge_lso: e.target.value })}
                      required
                    />
                  </div>
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
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or location..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Company No.</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>OIC Pay</TableHead>
                <TableHead>SSO Pay</TableHead>
                <TableHead>JSO Pay</TableHead>
                <TableHead>LSO Pay</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell className="font-mono text-sm">{company.company_number || "-"}</TableCell>
                    <TableCell>{company.location}</TableCell>
                    <TableCell>LKR {company.pay_oic.toFixed(2)}</TableCell>
                    <TableCell>LKR {company.pay_sso.toFixed(2)}</TableCell>
                    <TableCell>LKR {company.pay_jso.toFixed(2)}</TableCell>
                    <TableCell>LKR {company.pay_lso.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {isSuperAdmin && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(company)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(company.id)}
                          >
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
        </CardContent>
      </Card>
    </div>
  );
}
