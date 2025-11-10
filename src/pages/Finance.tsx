import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Edit, Trash2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  invoice_date: string;
  month_period: string;
  amount_to_collect: number;
  amount_received: number;
  invoice_sent: boolean;
  printed: boolean;
  emailed: boolean;
  companies: {
    company_name: string;
    location: string;
  };
}

export default function Finance() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    amount_received: "",
    invoice_sent: false,
    printed: false,
    emailed: false,
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    const filtered = invoices.filter((inv) =>
      inv.companies.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredInvoices(filtered);
  }, [searchTerm, invoices]);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*, companies(company_name, location)")
      .order("invoice_date", { ascending: false });

    if (error) {
      toast.error("Error fetching invoices");
      return;
    }

    setInvoices(data || []);
    setFilteredInvoices(data || []);
  };

  const handleEdit = (invoice: Invoice) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit invoices");
      return;
    }

    setCurrentInvoice(invoice);
    setFormData({
      amount_received: invoice.amount_received.toString(),
      invoice_sent: invoice.invoice_sent,
      printed: invoice.printed,
      emailed: invoice.emailed,
    });
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentInvoice) return;

    const { error } = await supabase
      .from("invoices")
      .update({
        amount_received: parseFloat(formData.amount_received),
        invoice_sent: formData.invoice_sent,
        printed: formData.printed,
        emailed: formData.emailed,
      })
      .eq("id", currentInvoice.id);

    if (error) {
      toast.error("Error updating invoice");
      return;
    }

    toast.success("Invoice updated successfully");
    setIsDialogOpen(false);
    fetchInvoices();
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete invoices");
      return;
    }

    if (!confirm("Are you sure you want to delete this invoice?")) return;

    const { error } = await supabase.from("invoices").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting invoice");
      return;
    }

    toast.success("Invoice deleted successfully");
    fetchInvoices();
  };

  const resetForm = () => {
    setFormData({
      amount_received: "",
      invoice_sent: false,
      printed: false,
      emailed: false,
    });
    setCurrentInvoice(null);
  };

  const calculateTotals = () => {
    const totalToCollect = filteredInvoices.reduce((sum, inv) => sum + inv.amount_to_collect, 0);
    const totalReceived = filteredInvoices.reduce((sum, inv) => sum + inv.amount_received, 0);
    const outstanding = totalToCollect - totalReceived;
    return { totalToCollect, totalReceived, outstanding };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-muted-foreground">Track invoices and payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Total to Collect</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Rs. {totals.totalToCollect.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Total Received</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">Rs. {totals.totalReceived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">Rs. {totals.outstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or invoice number..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount to Collect</TableHead>
                <TableHead>Amount Received</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.companies.company_name}</TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(invoice.month_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</TableCell>
                    <TableCell>Rs. {invoice.amount_to_collect.toLocaleString()}</TableCell>
                    <TableCell>Rs. {invoice.amount_received.toLocaleString()}</TableCell>
                    <TableCell className={invoice.amount_to_collect > invoice.amount_received ? "text-destructive font-semibold" : "text-green-600"}>
                      Rs. {(invoice.amount_to_collect - invoice.amount_received).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {invoice.invoice_sent && <Badge variant="secondary" className="text-xs">Sent</Badge>}
                        {invoice.printed && <Badge variant="secondary" className="text-xs">Printed</Badge>}
                        {invoice.emailed && <Badge variant="secondary" className="text-xs">Emailed</Badge>}
                      </div>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(invoice)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(invoice.id)}
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Invoice</DialogTitle>
            <DialogDescription>
              Update payment and status information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount_received">Amount Received (Rs.)</Label>
              <Input
                id="amount_received"
                type="number"
                step="0.01"
                value={formData.amount_received}
                onChange={(e) => setFormData({ ...formData, amount_received: e.target.value })}
                required
              />
            </div>
            <div className="space-y-3">
              <Label>Status</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="invoice_sent"
                  checked={formData.invoice_sent}
                  onCheckedChange={(checked) => setFormData({ ...formData, invoice_sent: checked as boolean })}
                />
                <Label htmlFor="invoice_sent" className="font-normal cursor-pointer">Invoice Sent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="printed"
                  checked={formData.printed}
                  onCheckedChange={(checked) => setFormData({ ...formData, printed: checked as boolean })}
                />
                <Label htmlFor="printed" className="font-normal cursor-pointer">Printed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="emailed"
                  checked={formData.emailed}
                  onCheckedChange={(checked) => setFormData({ ...formData, emailed: checked as boolean })}
                />
                <Label htmlFor="emailed" className="font-normal cursor-pointer">Emailed</Label>
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
              <Button type="submit">Update Invoice</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
