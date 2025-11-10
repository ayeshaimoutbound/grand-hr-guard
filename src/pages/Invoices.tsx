import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  charge_oic: number;
  charge_sso: number;
  charge_jso: number;
  charge_lso: number;
}

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  invoice_date: string;
  month_period: string;
  amount_to_collect: number;
  companies: {
    company_name: string;
  };
}

export default function Invoices() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [invoiceMonth, setInvoiceMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

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
      .select("*, companies(company_name)")
      .order("invoice_date", { ascending: false })
      .limit(10);

    if (error) {
      toast.error("Error fetching invoices");
      return;
    }

    setRecentInvoices(data || []);
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
      // Generate new invoice number
      const companyIndex = companies.findIndex(c => c.id === company.id) + 1;
      invoiceNumber = generateInvoiceNumber(companyIndex, selectedDate.getFullYear(), selectedDate.getMonth() + 1);
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
    setIsPreviewMode(true);
  };

  const confirmAndDownload = async () => {
    if (!previewData) return;

    const { company, invoiceNumber, monthStart, lineItems, totalAmount, existingInvoiceId } = previewData;

    let invoiceError;

    if (existingInvoiceId) {
      // Update existing invoice
      const { error } = await supabase
        .from("invoices")
        .update({
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
          invoice_number: invoiceNumber,
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
      invoiceNumber: invoiceNumber,
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
          Generate Invoice
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No invoices generated yet
                  </TableCell>
                </TableRow>
              ) : (
                recentInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.companies.company_name}</TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {new Date(invoice.month_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">Rs. {invoice.amount_to_collect.toLocaleString()}</TableCell>
                  </TableRow>
                ))
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
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger id="company_select">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <p className="font-semibold">{previewData.invoiceNumber}</p>
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
                        <TableCell className="text-right">Rs. {item.rate.toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={4} className="text-right">Total Amount</TableCell>
                      <TableCell className="text-right">Rs. {previewData.totalAmount.toLocaleString()}</TableCell>
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
    </div>
  );
}
