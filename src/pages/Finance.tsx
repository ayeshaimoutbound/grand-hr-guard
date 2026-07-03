import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Edit, Trash2, FileDown, DollarSign, AlertCircle, CheckCircle2, Plus, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: 'Cash' | 'Cheque' | 'Bank Transfer';
  reference_number: string | null;
  notes: string | null;
}

type PaymentStatus = "all" | "unpaid" | "partial" | "paid";

export default function Finance() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    invoice_number: "",
    invoice_sent: false,
    printed: false,
    emailed: false,
  });

  const [paymentFormData, setPaymentFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: "",
    payment_method: "Cash" as 'Cash' | 'Cheque' | 'Bank Transfer',
    reference_number: "",
    notes: "",
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const getPaymentStatus = (invoice: Invoice): PaymentStatus => {
    if (invoice.amount_received === 0) return "unpaid";
    if (invoice.amount_received >= invoice.amount_to_collect) return "paid";
    return "partial";
  };

  const getPaymentStatusBadge = (invoice: Invoice) => {
    const status = getPaymentStatus(invoice);
    
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <DollarSign className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unpaid
          </Badge>
        );
    }
  };

  useEffect(() => {
    let filtered = invoices.filter((inv) =>
      inv.companies.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply payment status filter
    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter(inv => getPaymentStatus(inv) === paymentStatusFilter);
    }

    setFilteredInvoices(filtered);
  }, [searchTerm, invoices, paymentStatusFilter]);

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

  const fetchPayments = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false });

    if (error) {
      toast.error("Error fetching payments");
      return;
    }

    setPayments((data || []) as Payment[]);
  };

  const handleEdit = (invoice: Invoice) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit invoices");
      return;
    }

    setCurrentInvoice(invoice);
    setFormData({
      invoice_number: invoice.invoice_number,
      invoice_sent: invoice.invoice_sent,
      printed: invoice.printed,
      emailed: invoice.emailed,
    });
    fetchPayments(invoice.id);
    setIsDialogOpen(true);
  };

  const handleAddPayment = (invoice: Invoice) => {
    setCurrentInvoice(invoice);
    fetchPayments(invoice.id);
    setIsPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentInvoice) return;

    const amount = parseFloat(paymentFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Amount must be a valid positive number");
      return;
    }

    // Validate reference number for Cheque and Bank Transfer
    if ((paymentFormData.payment_method === "Cheque" || paymentFormData.payment_method === "Bank Transfer") && 
        !paymentFormData.reference_number.trim()) {
      toast.error(`Reference number is required for ${paymentFormData.payment_method}`);
      return;
    }

    const { error } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: currentInvoice.id,
        payment_date: paymentFormData.payment_date,
        amount: amount,
        payment_method: paymentFormData.payment_method,
        reference_number: paymentFormData.reference_number.trim() || null,
        notes: paymentFormData.notes.trim() || null,
      });

    if (error) {
      toast.error("Error recording payment");
      return;
    }

    toast.success("Payment recorded successfully");
    setIsPaymentDialogOpen(false);
    fetchInvoices();
    fetchPayments(currentInvoice.id);
    resetPaymentForm();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentInvoice) return;

    // Validate invoice number
    if (!formData.invoice_number.trim()) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    const { error } = await supabase
      .from("invoices")
      .update({
        invoice_number: formData.invoice_number,
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

  const handleAddNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentInvoice) return;

    // Validate amount
    const amount = parseFloat(paymentFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Amount must be a valid positive number");
      return;
    }

    // Validate reference for cheque and bank transfer
    if ((paymentFormData.payment_method === "Cheque" || paymentFormData.payment_method === "Bank Transfer") 
        && !paymentFormData.reference_number.trim()) {
      toast.error(`Reference number is required for ${paymentFormData.payment_method} payments`);
      return;
    }

    const { error } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: currentInvoice.id,
        payment_date: paymentFormData.payment_date,
        amount: amount,
        payment_method: paymentFormData.payment_method,
        reference_number: paymentFormData.reference_number.trim() || null,
        notes: paymentFormData.notes.trim() || null,
      });

    if (error) {
      toast.error("Error recording payment");
      return;
    }

    toast.success("Payment recorded successfully");
    setIsPaymentDialogOpen(false);
    fetchInvoices();
    fetchPayments(currentInvoice.id);
    resetPaymentForm();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete payments");
      return;
    }

    if (!confirm("Are you sure you want to delete this payment?")) return;

    const { error } = await supabase
      .from("invoice_payments")
      .delete()
      .eq("id", paymentId);

    if (error) {
      toast.error("Error deleting payment");
      return;
    }

    toast.success("Payment deleted successfully");
    if (currentInvoice) {
      fetchPayments(currentInvoice.id);
    }
    fetchInvoices();
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
      invoice_number: "",
      invoice_sent: false,
      printed: false,
      emailed: false,
    });
    setCurrentInvoice(null);
    setPayments([]);
  };

  const resetPaymentForm = () => {
    setPaymentFormData({
      payment_date: new Date().toISOString().split('T')[0],
      amount: "",
      payment_method: "Cash" as 'Cash' | 'Cheque' | 'Bank Transfer',
      reference_number: "",
      notes: "",
    });
  };

  const calculateTotals = () => {
    const totalToCollect = filteredInvoices.reduce((sum, inv) => sum + inv.amount_to_collect, 0);
    const totalReceived = filteredInvoices.reduce((sum, inv) => sum + inv.amount_received, 0);
    const outstanding = totalToCollect - totalReceived;
    
    // Count invoices by status
    const unpaidCount = filteredInvoices.filter(inv => getPaymentStatus(inv) === "unpaid").length;
    const partialCount = filteredInvoices.filter(inv => getPaymentStatus(inv) === "partial").length;
    const paidCount = filteredInvoices.filter(inv => getPaymentStatus(inv) === "paid").length;
    
    return { totalToCollect, totalReceived, outstanding, unpaidCount, partialCount, paidCount };
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
            <p className="text-2xl font-bold">LKR {totals.totalToCollect.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Total Received</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">LKR {totals.totalReceived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">LKR {totals.outstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{totals.unpaidCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Partially Paid</p>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{totals.partialCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Fully Paid</p>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totals.paidCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or invoice number..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={paymentStatusFilter} onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partially Paid</SelectItem>
                <SelectItem value="paid">Fully Paid</SelectItem>
              </SelectContent>
            </Select>
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
                <TableHead>Payment Status</TableHead>
                <TableHead>Delivery Status</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                    <TableCell>LKR {invoice.amount_to_collect.toLocaleString()}</TableCell>
                    <TableCell>LKR {invoice.amount_received.toLocaleString()}</TableCell>
                    <TableCell className={invoice.amount_to_collect > invoice.amount_received ? "text-destructive font-semibold" : "text-green-600"}>
                      LKR {(invoice.amount_to_collect - invoice.amount_received).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(invoice)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
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
                            onClick={() => handleAddPayment(invoice)}
                            title="Add Payment"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(invoice)}
                            title="Edit Invoice"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(invoice.id)}
                            title="Delete Invoice"
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Invoice</DialogTitle>
            <DialogDescription>
              Update invoice status and view payment history
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
              />
            </div>
            
            {currentInvoice && (
              <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount to Collect:</span>
                  <span className="font-semibold">LKR {currentInvoice.amount_to_collect.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount Received:</span>
                  <span className="font-semibold text-green-600">LKR {currentInvoice.amount_received.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Outstanding:</span>
                  <span className="font-semibold text-destructive">
                    LKR {(currentInvoice.amount_to_collect - currentInvoice.amount_received).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {payments.length > 0 && (
              <div className="space-y-2">
                <Label>Payment History</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        {isSuperAdmin && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell>LKR {payment.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payment.payment_method}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{payment.reference_number || "-"}</TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePayment(payment.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>Delivery Status</Label>
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
        setIsPaymentDialogOpen(open);
        if (!open) {
          resetPaymentForm();
          setCurrentInvoice(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Add a new payment for {currentInvoice?.companies.company_name} - Invoice #{currentInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          
          {currentInvoice && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/50 mb-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount to Collect:</span>
                <span className="font-semibold">LKR {currentInvoice.amount_to_collect.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount Received:</span>
                <span className="font-semibold text-green-600">LKR {currentInvoice.amount_received.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Outstanding:</span>
                <span className="font-semibold text-destructive">
                  LKR {(currentInvoice.amount_to_collect - currentInvoice.amount_received).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleAddNewPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentFormData.payment_date}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (LKR)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select 
                value={paymentFormData.payment_method} 
                onValueChange={(value: 'Cash' | 'Cheque' | 'Bank Transfer') => 
                  setPaymentFormData({ ...paymentFormData, payment_method: value, reference_number: "" })
                }
              >
                <SelectTrigger id="payment_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(paymentFormData.payment_method === "Cheque" || paymentFormData.payment_method === "Bank Transfer") && (
              <div className="space-y-2">
                <Label htmlFor="reference_number">
                  {paymentFormData.payment_method === "Cheque" ? "Cheque Number" : "Transaction Reference"}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="reference_number"
                  type="text"
                  value={paymentFormData.reference_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  placeholder={paymentFormData.payment_method === "Cheque" ? "Enter cheque number" : "Enter transaction reference"}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={paymentFormData.notes}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                placeholder="Add any additional notes about this payment"
                rows={3}
              />
            </div>

            {payments.length > 0 && (
              <div className="space-y-2">
                <Label>Recent Payments</Label>
                <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.slice(0, 3).map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm">LKR {payment.amount.toLocaleString()}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{payment.payment_method}</Badge></TableCell>
                          <TableCell className="text-sm">{payment.reference_number || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPaymentDialogOpen(false);
                  resetPaymentForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a new payment for invoice {currentInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentFormData.payment_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (LKR)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={paymentFormData.amount}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select 
                value={paymentFormData.payment_method} 
                onValueChange={(value) => setPaymentFormData({ ...paymentFormData, payment_method: value as 'Cash' | 'Cheque' | 'Bank Transfer', reference_number: "" })}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(paymentFormData.payment_method === "Cheque" || paymentFormData.payment_method === "Bank Transfer") && (
              <div className="space-y-2">
                <Label htmlFor="reference_number">
                  {paymentFormData.payment_method === "Cheque" ? "Cheque Number" : "Transaction Reference"}
                </Label>
                <Input
                  id="reference_number"
                  type="text"
                  value={paymentFormData.reference_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  placeholder={paymentFormData.payment_method === "Cheque" ? "Enter cheque number" : "Enter transaction reference"}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                type="text"
                value={paymentFormData.notes}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                placeholder="Additional notes about this payment"
              />
            </div>
            
            {currentInvoice && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span>Total Amount:</span>
                  <span className="font-semibold">LKR {currentInvoice.amount_to_collect.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Already Received:</span>
                  <span className="font-semibold text-green-600">LKR {currentInvoice.amount_received.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Outstanding:</span>
                  <span className="font-semibold text-destructive">
                    LKR {(currentInvoice.amount_to_collect - currentInvoice.amount_received).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment History</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">No payments recorded yet</p>
                ) : (
                  <div className="p-2 space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                        <div>
                          <div className="font-semibold">{new Date(payment.payment_date).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            {payment.payment_method}
                            {payment.reference_number && ` - ${payment.reference_number}`}
                          </div>
                        </div>
                        <div className="font-semibold">LKR {payment.amount.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
