import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
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
  pay_oic: number;
  pay_sso: number;
  pay_jso: number;
  pay_lso: number;
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
    location: "",
    pay_oic: "",
    pay_sso: "",
    pay_jso: "",
    pay_lso: "",
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
      location: formData.location,
      pay_oic: parseFloat(formData.pay_oic),
      pay_sso: parseFloat(formData.pay_sso),
      pay_jso: parseFloat(formData.pay_jso),
      pay_lso: parseFloat(formData.pay_lso),
    };

    // Validate input
    const validation = companySchema.safeParse(payload);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (isEditMode && currentCompany) {
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", currentCompany.id);

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
      location: company.location,
      pay_oic: company.pay_oic.toString(),
      pay_sso: company.pay_sso.toString(),
      pay_jso: company.pay_jso.toString(),
      pay_lso: company.pay_lso.toString(),
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
      location: "",
      pay_oic: "",
      pay_sso: "",
      pay_jso: "",
      pay_lso: "",
    });
    setIsEditMode(false);
    setCurrentCompany(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage company information and pay rates</p>
        </div>
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
                <h3 className="text-sm font-semibold mb-3">Pay Rates per Shift (Rs.)</h3>
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
                <TableHead>Location</TableHead>
                <TableHead>OIC Pay</TableHead>
                <TableHead>SSO Pay</TableHead>
                <TableHead>JSO Pay</TableHead>
                <TableHead>LSO Pay</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell>{company.location}</TableCell>
                    <TableCell>Rs. {company.pay_oic.toFixed(2)}</TableCell>
                    <TableCell>Rs. {company.pay_sso.toFixed(2)}</TableCell>
                    <TableCell>Rs. {company.pay_jso.toFixed(2)}</TableCell>
                    <TableCell>Rs. {company.pay_lso.toFixed(2)}</TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
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
                      </TableCell>
                    )}
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
