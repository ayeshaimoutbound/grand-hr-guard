import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Download, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { generateInvoicePDF, generateInvoiceNumber } from "@/lib/invoiceGenerator";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyCombobox } from "@/components/CompanyCombobox";
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
  company_number: string;
  location: string;
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

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  invoice_date: string;
  month_period: string;
  amount_to_collect: number;
  amount_received?: number;
  invoice_data?: any;
  companies: {
    company_name: string;
    location: string;
  };
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
}

export default function Invoices() {
  const { isOffice } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [invoiceMonth, setInvoiceMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [editableInvoiceNumber, setEditableInvoiceNumber] = useState("");

  // Payment collection state
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [existingPayments, setExistingPayments] = useState<Payment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "cheque" | "bank_transfer">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);


  useEffect(() => {
    fetchCompanies();
    fetchRecentInvoices();
  }, []);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("company_name", { ascending: true });

    if (error) {
      toast.error("Error fetching companies");
      return;
    }

    setCompanies(data || []);
  };

  const fetchRecentInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*, companies(company_name, location)")
      .order("invoice_date", { ascending: false })
      .limit(10);

    if (error) {
      toast.error("Error fetching invoices");
      return;
    }

    setRecentInvoices(data || []);
  };

  const openPaymentDialog = async (invoice: Invoice) => {
    setPaymentInvoice(invoice);
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("id, payment_date, amount, payment_method, reference_number, notes")
      .eq("invoice_id", invoice.id)
      .order("payment_date", { ascending: false });
    if (error) {
      toast.error("Error loading payments");
      return;
    }
    setExistingPayments(data || []);
  };

  const savePayment = async () => {
    if (!paymentInvoice) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if ((paymentMethod === "cheque" || paymentMethod === "bank_transfer") && !paymentReference.trim()) {
      toast.error(paymentMethod === "cheque" ? "Cheque number is required" : "Bank transfer reference is required");
      return;
    }
    const received = existingPayments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = paymentInvoice.amount_to_collect - received;
    if (amt > balance + 0.001) {
      toast.error(`Amount exceeds outstanding balance (LKR ${balance.toLocaleString()})`);
      return;
    }
    setSavingPayment(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: paymentInvoice.id,
      payment_date: paymentDate,
      amount: amt,
      payment_method: paymentMethod,
      reference_number: paymentMethod === "cash" ? null : paymentReference.trim(),
      notes: paymentNotes.trim() || null,
      created_by: userData.user?.id,
    });
    setSavingPayment(false);
    if (error) {
      toast.error("Error saving payment: " + error.message);
      return;
    }
    toast.success("Payment recorded");
    setPaymentInvoice(null);
    fetchRecentInvoices();
  };


  const generatePreview = async () => {
    if (!selectedCompany) {
      toast.error("Please select a company");
      return;
    }

    const company = companies.find(c => c.id === selectedCompany);
    if (!company) return;

    const selectedDate = new Date(invoiceMonth + "-01");
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    // Fetch attendance data for the selected month
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance")
      .select("*, employees(full_name)")
      .eq("company_id", company.id)
      .gte("attendance_date", format(monthStart, "yyyy-MM-dd"))
      .lte("attendance_date", format(monthEnd, "yyyy-MM-dd"))
      .eq("present", true);

    if (attendanceError) {
      toast.error("Error fetching attendance data");
      return;
    }

    // Group by rank and count shifts
    const rankCounts: Record<string, { day: number; night: number }> = {
      OIC: { day: 0, night: 0 },
      SSO: { day: 0, night: 0 },
      JSO: { day: 0, night: 0 },
      LSO: { day: 0, night: 0 },
    };

    attendanceData?.forEach((record) => {
      const rank = record.rank as keyof typeof rankCounts;
      const shift = record.shift_type === "Day" ? "day" : "night";
      rankCounts[rank][shift]++;
    });

    // Generate line items
    const lineItems = [];
    let totalAmount = 0;
    const periodStr = format(monthStart, "dd") + "-" + format(monthEnd, "dd MMM yy").toUpperCase();

    Object.entries(rankCounts).forEach(([rank, counts]) => {
      const rate = company[`charge_${rank.toLowerCase()}` as keyof Company] as number;
      
      if (counts.day > 0) {
        const amount = counts.day * rate;
        lineItems.push({
          period: periodStr,
          rank: rank,
          officers: "1 X DAY",
          shifts: counts.day,
          rate: rate,
          amount: amount,
        });
        totalAmount += amount;
      }

      if (counts.night > 0) {
        const amount = counts.night * rate;
        lineItems.push({
          period: periodStr,
          rank: rank,
          officers: "1 X NIGHT",
          shifts: counts.night,
          rate: rate,
          amount: amount,
        });
        totalAmount += amount;
      }
    });

    // Add overtime line if client OT rate is set and OT was logged this month
    const otRate = Number(company.client_ot_rate || 0);
    if (otRate > 0) {
      const { data: otData } = await supabase
        .from("overtime_entries")
        .select("hours")
        .eq("company_id", company.id)
        .gte("ot_date", format(monthStart, "yyyy-MM-dd"))
        .lte("ot_date", format(monthEnd, "yyyy-MM-dd"));
      const totalOtHours = (otData || []).reduce((s, r) => s + Number(r.hours || 0), 0);
      if (totalOtHours > 0) {
        const otAmount = totalOtHours * otRate;
        lineItems.push({
          period: periodStr,
          rank: "OVERTIME",
          officers: "Hours",
          shifts: totalOtHours,
          rate: otRate,
          amount: otAmount,
        });
        totalAmount += otAmount;
      }
    }

    if (lineItems.length === 0) {
      toast.error("No attendance records found for the selected period");
      return;
    }

    // Check if invoice already exists for this company and month
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("company_id", company.id)
      .eq("month_period", format(monthStart, "yyyy-MM-dd"))
      .maybeSingle();

    let invoiceNumber: string;
    
    if (existingInvoice) {
      // Use existing invoice number
      invoiceNumber = existingInvoice.invoice_number;
    } else {
      // Generate new invoice number using company number
      if (!company.company_number) {
        toast.error("Company number is missing. Please update company details.");
        return;
      }
      invoiceNumber = generateInvoiceNumber(company.company_number, selectedDate.getFullYear(), selectedDate.getMonth() + 1);
    }

    setPreviewData({
      company,
      invoiceNumber,
      selectedDate,
      monthStart,
      monthEnd,
      periodStr,
      lineItems,
      totalAmount,
      existingInvoiceId: existingInvoice?.id,
    });
    setEditableInvoiceNumber(invoiceNumber);
    setIsPreviewMode(true);
  };

  const confirmAndDownload = async () => {
    if (!previewData) return;

    if (!editableInvoiceNumber.trim()) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    const { company, monthStart, lineItems, totalAmount, existingInvoiceId } = previewData;

    let invoiceError;

    if (existingInvoiceId) {
      // Update existing invoice
      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: editableInvoiceNumber,
          invoice_date: format(new Date(), "yyyy-MM-dd"),
          amount_to_collect: totalAmount,
          invoice_data: { lineItems },
        })
        .eq("id", existingInvoiceId);
      
      invoiceError = error;
      
      if (!error) {
        toast.success("Invoice updated successfully");
      }
    } else {
      // Create new invoice
      const { error } = await supabase
        .from("invoices")
        .insert({
          company_id: company.id,
          invoice_number: editableInvoiceNumber,
          invoice_date: format(new Date(), "yyyy-MM-dd"),
          month_period: format(monthStart, "yyyy-MM-dd"),
          amount_to_collect: totalAmount,
          amount_received: 0,
          invoice_data: { lineItems },
        });
      
      invoiceError = error;
      
      if (!error) {
        toast.success("Invoice generated successfully");
      }
    }

    if (invoiceError) {
      toast.error("Error saving invoice: " + invoiceError.message);
      return;
    }

    // Generate PDF
    generateInvoicePDF({
      invoiceNumber: editableInvoiceNumber,
      invoiceDate: format(new Date(), "MMMM d, yyyy"),
      duration: previewData.periodStr,
      companyName: company.company_name,
      companyAddress: company.location,
      lineItems: lineItems,
      total: totalAmount,
    });

    setIsDialogOpen(false);
    setIsPreviewMode(false);
    setSelectedCompany("");
    setPreviewData(null);
    fetchRecentInvoices();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Generate and manage company invoices</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {isOffice ? "Update Invoice" : "Generate Invoice"}
        </Button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Total Companies</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Invoices This Month</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {recentInvoices.filter(inv => 
                new Date(inv.invoice_date).getMonth() === new Date().getMonth()
              ).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm text-muted-foreground">Total Generated</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recentInvoices.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No invoices generated yet
                  </TableCell>
                </TableRow>
              ) : (
                recentInvoices.map((invoice) => {
                  const received = Number(invoice.amount_received || 0);
                  const balance = invoice.amount_to_collect - received;
                  return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.companies.company_name}</TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {new Date(invoice.month_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">LKR {invoice.amount_to_collect.toLocaleString()}</TableCell>
                    <TableCell className="text-right">LKR {received.toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${balance > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      LKR {balance.toLocaleString()}
                      <div className="mt-1">
                        {received <= 0 ? (
                          <Badge variant="destructive">Unpaid</Badge>
                        ) : balance > 0.01 ? (
                          <Badge variant="secondary">Partially Paid</Badge>
                        ) : (
                          <Badge>Paid</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!isOffice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPaymentDialog(invoice)}
                          >
                            <Wallet className="h-4 w-4 mr-1" /> Payment
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const lineItems = invoice.invoice_data?.lineItems || [];
                            const monthStart = new Date(invoice.month_period);
                            const monthEnd = endOfMonth(monthStart);
                            const periodStr =
                              format(monthStart, "dd") + "-" + format(monthEnd, "dd MMM yy").toUpperCase();
                            generateInvoicePDF({
                              invoiceNumber: invoice.invoice_number,
                              invoiceDate: format(new Date(invoice.invoice_date), "MMMM d, yyyy"),
                              duration: periodStr,
                              companyName: invoice.companies.company_name,
                              companyAddress: invoice.companies.location,
                              lineItems,
                              total: invoice.amount_to_collect,
                            });
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" /> PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setIsPreviewMode(false);
          setPreviewData(null);
          setSelectedCompany("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isPreviewMode ? "Invoice Preview" : "Generate Invoice"}</DialogTitle>
            <DialogDescription>
              {isPreviewMode 
                ? previewData?.existingInvoiceId 
                  ? "This invoice already exists and will be updated with the new data" 
                  : "Review the invoice details before generating"
                : "Select a company and month to generate an invoice based on attendance records"}
            </DialogDescription>
          </DialogHeader>
          
          {!isPreviewMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_select">Company</Label>
                <CompanyCombobox
                  id="company_select"
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  companies={companies}
                  placeholder="Select a company"
                />

              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_month">Invoice Month</Label>
                <Input
                  id="invoice_month"
                  type="month"
                  value={invoiceMonth}
                  onChange={(e) => setInvoiceMonth(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedCompany("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={generatePreview}>
                  Preview Invoice
                </Button>
              </div>
            </div>
          ) : previewData && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company</p>
                    <p className="font-semibold">{previewData.company.company_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-semibold">{previewData.company.location}</p>
                  </div>
                   <div>
                     <p className="text-muted-foreground">Invoice Number</p>
                     <Input
                       value={editableInvoiceNumber}
                       onChange={(e) => setEditableInvoiceNumber(e.target.value)}
                       className="mt-1 font-semibold"
                     />
                   </div>
                  <div>
                    <p className="text-muted-foreground">Period</p>
                    <p className="font-semibold">{previewData.periodStr}</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Shifts</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.lineItems.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.rank}</TableCell>
                        <TableCell>{item.officers}</TableCell>
                        <TableCell className="text-right">{item.shifts}</TableCell>
                        <TableCell className="text-right">LKR {item.rate.toLocaleString()}</TableCell>
                        <TableCell className="text-right">LKR {item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={4} className="text-right">Total Amount</TableCell>
                      <TableCell className="text-right">LKR {previewData.totalAmount.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewMode(false)}
                >
                  Back
                </Button>
                <Button onClick={confirmAndDownload}>
                  <FileText className="h-4 w-4 mr-2" />
                  {previewData?.existingInvoiceId ? "Update & Download" : "Generate & Download"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentInvoice} onOpenChange={(open) => { if (!open) setPaymentInvoice(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              {paymentInvoice && (
                <>Invoice {paymentInvoice.invoice_number} — {paymentInvoice.companies.company_name}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {paymentInvoice && (() => {
            const received = existingPayments.reduce((s, p) => s + Number(p.amount), 0);
            const balance = paymentInvoice.amount_to_collect - received;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">LKR {paymentInvoice.amount_to_collect.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Received</p>
                    <p className="font-semibold">LKR {received.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Balance</p>
                    <p className="font-semibold text-primary">LKR {balance.toLocaleString()}</p>
                  </div>
                </div>

                {existingPayments.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingPayments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                            <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                            <TableCell>{p.reference_number || "—"}</TableCell>
                            <TableCell className="text-right">LKR {Number(p.amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {balance > 0 ? (
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="font-semibold">Record New Payment</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={balance}
                          placeholder={`Max ${balance.toLocaleString()}`}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={(v: any) => { setPaymentMethod(v); setPaymentReference(""); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {paymentMethod !== "cash" && (
                        <div className="space-y-2">
                          <Label>{paymentMethod === "cheque" ? "Cheque Number" : "B/T Reference"}</Label>
                          <Input
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder={paymentMethod === "cheque" ? "e.g. 123456" : "e.g. TXN-987654"}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPaymentInvoice(null)}>Cancel</Button>
                      <Button onClick={savePayment} disabled={savingPayment}>
                        <Wallet className="h-4 w-4 mr-2" />
                        {savingPayment ? "Saving..." : "Record Payment"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground border-t pt-4">
                    Invoice fully paid.
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
