import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, ChevronDown, ChevronUp, FileDown, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  nic: string;
  phone_number: string;
  bank_name: string;
  branch: string;
  account_number: string;
}

interface Company {
  id: string;
  company_name: string;
}

interface CompanyWorkDetail {
  company: Company;
  company_id: string;
  rank: string;
  total_shifts: number;
  pay_per_shift: number;
  gross_shift_total: number;
  salary_id: string;
}

interface ConsolidatedEmployeeSalary {
  employee: Employee;
  companyWork: CompanyWorkDetail[];
  total_shifts_all: number;
  gross_shift_total_all: number;
  basic_salary: number;
  epf_employee: number;
  epf_employer: number;
  etf_employer: number;
  salary_advance: number;
  salary_advance_2: number;
  transport: number;
  food: number;
  uniforms: number;
  other_deductions: number;
  final_salary: number;
  primary_salary_id: string;
}

export default function Salaries() {
  const [consolidatedSalaries, setConsolidatedSalaries] = useState<ConsolidatedEmployeeSalary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ConsolidatedEmployeeSalary | null>(null);
  const [editFormData, setEditFormData] = useState({
    basic_salary: "",
    salary_advance: "",
    salary_advance_2: "",
    transport: "",
    food: "",
    uniforms: "",
    other_deductions: "",
  });
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    const [employeesRes, companiesRes, attendanceRes, salariesRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("companies").select("*"),
      supabase.from("attendance").select("*").gte("attendance_date", startDate).lte("attendance_date", endDate).eq("present", true),
      supabase.from("salaries").select("*").gte("salary_month", startDate).lte("salary_month", endDate),
    ]);

    if (employeesRes.error || companiesRes.error || attendanceRes.error) {
      toast.error("Error fetching data");
      return;
    }

    const employeesList = employeesRes.data || [];
    const companiesList = companiesRes.data || [];
    const attendanceList = attendanceRes.data || [];
    const salariesList = salariesRes.data || [];

    // Build consolidated employee data
    const consolidatedMap = new Map<string, ConsolidatedEmployeeSalary>();

    employeesList.forEach(employee => {
      // Get all companies where this employee worked
      const employeeAttendance = attendanceList.filter(att => att.employee_id === employee.id);
      
      // Group attendance by company
      const companyWorkMap = new Map<string, { shifts: number; rank: string; payPerShift: number }>();
      
      employeeAttendance.forEach(att => {
        const company = companiesList.find(c => c.id === att.company_id);
        if (!company) return;

        // Get pay rate based on rank
        let payPerShift = 0;
        if (att.rank === 'OIC') payPerShift = company.pay_oic || 0;
        else if (att.rank === 'SSO') payPerShift = company.pay_sso || 0;
        else if (att.rank === 'JSO') payPerShift = company.pay_jso || 0;
        else if (att.rank === 'LSO') payPerShift = company.pay_lso || 0;

        if (!companyWorkMap.has(att.company_id)) {
          companyWorkMap.set(att.company_id, { shifts: 0, rank: att.rank, payPerShift });
        }
        
        const workData = companyWorkMap.get(att.company_id)!;
        workData.shifts += 1;
      });

      // Build company work details
      const companyWork: CompanyWorkDetail[] = [];
      let totalShiftsAll = 0;
      let grossShiftTotalAll = 0;

      companyWorkMap.forEach((workData, companyId) => {
        const company = companiesList.find(c => c.id === companyId);
        if (!company) return;

        const grossForCompany = workData.shifts * workData.payPerShift;
        const salaryRecord = salariesList.find(s => s.employee_id === employee.id && s.company_id === companyId);

        companyWork.push({
          company: company,
          company_id: companyId,
          rank: workData.rank,
          total_shifts: workData.shifts,
          pay_per_shift: workData.payPerShift,
          gross_shift_total: grossForCompany,
          salary_id: salaryRecord?.id || `temp-${employee.id}-${companyId}`,
        });

        totalShiftsAll += workData.shifts;
        grossShiftTotalAll += grossForCompany;
      });

      // Get consolidated salary data
      const employeeSalaries = salariesList.filter(s => s.employee_id === employee.id);
      
      let basicSalary = 0;
      let salaryAdvance = 0;
      let salaryAdvance2 = 0;
      let transport = 0;
      let food = 0;
      let uniforms = 0;
      let otherDeductions = 0;
      let primarySalaryId = '';

      if (employeeSalaries.length > 0) {
        const primarySalary = employeeSalaries[0] as any;
        primarySalaryId = primarySalary.id;
        basicSalary = primarySalary.basic_salary || 0;
        salaryAdvance = primarySalary.salary_advance || 0;
        salaryAdvance2 = primarySalary.salary_advance_2 || 0;
        transport = primarySalary.transport || 0;
        food = primarySalary.food || 0;
        uniforms = primarySalary.uniforms || 0;
        otherDeductions = primarySalary.other_deductions || 0;
      } else {
        primarySalaryId = `temp-${employee.id}`;
      }

      const epfEmployee = basicSalary * 0.08;
      const epfEmployer = basicSalary * 0.12;
      const etfEmployer = basicSalary * 0.03;
      const finalSalary = grossShiftTotalAll - epfEmployee - salaryAdvance - salaryAdvance2 - transport - food - uniforms - otherDeductions;

      if (totalShiftsAll > 0) {
        consolidatedMap.set(employee.id, {
          employee,
          companyWork,
          total_shifts_all: totalShiftsAll,
          gross_shift_total_all: grossShiftTotalAll,
          basic_salary: basicSalary,
          epf_employee: epfEmployee,
          epf_employer: epfEmployer,
          etf_employer: etfEmployer,
          salary_advance: salaryAdvance,
          salary_advance_2: salaryAdvance2,
          transport: transport,
          food: food,
          uniforms: uniforms,
          other_deductions: otherDeductions,
          final_salary: finalSalary,
          primary_salary_id: primarySalaryId,
        });
      }
    });

    setConsolidatedSalaries(Array.from(consolidatedMap.values()));
  };

  const handleOpenEditDialog = (record: ConsolidatedEmployeeSalary) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit salaries");
      return;
    }
    
    setEditingRecord(record);
    setEditFormData({
      basic_salary: record.basic_salary.toString(),
      salary_advance: record.salary_advance.toString(),
      salary_advance_2: (record.salary_advance_2 || 0).toString(),
      transport: record.transport.toString(),
      food: record.food.toString(),
      uniforms: record.uniforms.toString(),
      other_deductions: record.other_deductions.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingRecord) return;

    const salaryFieldSchema = z.number()
      .min(0, 'Value cannot be negative')
      .max(10000000, 'Value exceeds maximum allowed');
    
    const values = {
      basic_salary: parseFloat(editFormData.basic_salary) || 0,
      salary_advance: parseFloat(editFormData.salary_advance) || 0,
      salary_advance_2: parseFloat(editFormData.salary_advance_2) || 0,
      transport: parseFloat(editFormData.transport) || 0,
      food: parseFloat(editFormData.food) || 0,
      uniforms: parseFloat(editFormData.uniforms) || 0,
      other_deductions: parseFloat(editFormData.other_deductions) || 0,
    };

    try {
      Object.values(values).forEach(val => salaryFieldSchema.parse(val));
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    const epfEmployee = values.basic_salary * 0.08;
    const epfEmployer = values.basic_salary * 0.12;
    const etfEmployer = values.basic_salary * 0.03;
    const finalSalary = editingRecord.gross_shift_total_all - epfEmployee - values.salary_advance - values.salary_advance_2 - values.transport - values.food - values.uniforms - values.other_deductions;

    // Update the primary salary record
    const isNewRecord = editingRecord.primary_salary_id.startsWith('temp-');
    
    if (isNewRecord) {
      // Create salary record for first company
      const firstCompany = editingRecord.companyWork[0];
      const { error } = await supabase
        .from("salaries")
        .insert({
          employee_id: editingRecord.employee.id,
          company_id: firstCompany.company_id,
          salary_month: `${selectedMonth}-01`,
          total_shifts: editingRecord.total_shifts_all,
          pay_per_shift: 0,
          gross_shift_total: editingRecord.gross_shift_total_all,
          ...values,
          epf: epfEmployee,
          final_salary: finalSalary,
        } as any);

      if (error) {
        toast.error("Failed to create salary record");
        return;
      }
    } else {
      // Update existing record
      const { error } = await supabase
        .from("salaries")
        .update({
          ...values,
          epf: epfEmployee,
          final_salary: finalSalary,
        } as any)
        .eq("id", editingRecord.primary_salary_id);

      if (error) {
        toast.error("Failed to update salary");
        return;
      }
    }

    toast.success("Salary updated successfully");
    setIsEditDialogOpen(false);
    setEditingRecord(null);
    fetchData();
  };

  const handlePrintSalarySlip = (employeeRecord: ConsolidatedEmployeeSalary) => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can print salary slips");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Slip - ${employeeRecord.employee.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { width: 80px; height: 80px; margin: 0 auto 15px; display: block; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; margin: 5px 0; }
          .info-label { font-weight: bold; width: 150px; }
          .info-value { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .company-detail { background-color: #f9f9f9; font-weight: bold; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .final-row { font-weight: bold; background-color: #e8f5e9; font-size: 16px; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Company Logo" class="logo">
          <h1>SALARY SLIP</h1>
          <p>Month: ${new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Employee ID:</span>
            <span class="info-value">${employeeRecord.employee.employee_id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${employeeRecord.employee.full_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Bank:</span>
            <span class="info-value">${employeeRecord.employee.bank_name} - ${employeeRecord.employee.branch}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Account No:</span>
            <span class="info-value">${employeeRecord.employee.account_number}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${employeeRecord.companyWork.map(work => `
              <tr class="company-detail">
                <td colspan="2">${work.company.company_name} - ${work.rank} (${work.total_shifts} shifts)</td>
              </tr>
              <tr>
                <td style="padding-left: 30px;">Gross Earnings</td>
                <td style="text-align: right;">${work.gross_shift_total.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total Shifts</td>
              <td style="text-align: right;">${employeeRecord.total_shifts_all}</td>
            </tr>
            <tr class="total-row">
              <td>Gross Shift Total</td>
              <td style="text-align: right;">${employeeRecord.gross_shift_total_all.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Deductions:</strong></td>
              <td></td>
            </tr>
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">${employeeRecord.basic_salary.toFixed(2)}</td>
            </tr>
            <tr>
              <td>EPF - Employee (8%)</td>
              <td style="text-align: right;">${employeeRecord.epf_employee.toFixed(2)}</td>
            </tr>
            <tr>
              <td>EPF - Employer (12%)</td>
              <td style="text-align: right;">${employeeRecord.epf_employer.toFixed(2)}</td>
            </tr>
            <tr>
              <td>ETF - Employer (3%)</td>
              <td style="text-align: right;">${employeeRecord.etf_employer.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Salary Advance</td>
              <td style="text-align: right;">${employeeRecord.salary_advance.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Salary Advance 2</td>
              <td style="text-align: right;">${(employeeRecord.salary_advance_2 || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Transport</td>
              <td style="text-align: right;">${employeeRecord.transport.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Food</td>
              <td style="text-align: right;">${employeeRecord.food.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Uniforms</td>
              <td style="text-align: right;">${employeeRecord.uniforms.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Other Deductions</td>
              <td style="text-align: right;">${employeeRecord.other_deductions.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td style="text-align: right;">${(employeeRecord.epf_employee + employeeRecord.salary_advance + (employeeRecord.salary_advance_2 || 0) + employeeRecord.transport + employeeRecord.food + employeeRecord.uniforms + employeeRecord.other_deductions).toFixed(2)}</td>
            </tr>
            <tr class="final-row">
              <td>NET SALARY</td>
              <td style="text-align: right;">Rs. ${employeeRecord.final_salary.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 50px;">
          <div style="display: flex; justify-content: space-between;">
            <div>
              <p>_____________________</p>
              <p>Employee Signature</p>
            </div>
            <div>
              <p>_____________________</p>
              <p>Authorized Signature</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const handleExportToExcel = () => {
    if (consolidatedSalaries.length === 0) {
      toast.error("No data to export");
      return;
    }

    const wb = XLSX.utils.book_new();

    const excelData = consolidatedSalaries.map(emp => ({
      'Employee ID': emp.employee.employee_id,
      'Full Name': emp.employee.full_name,
      'Total Shifts': emp.total_shifts_all,
      'Companies': emp.companyWork.map(w => w.company.company_name).join(', '),
      'Ranks': emp.companyWork.map(w => w.rank).join(', '),
      'Gross Total': `Rs. ${emp.gross_shift_total_all.toFixed(2)}`,
      'Basic Salary': `Rs. ${emp.basic_salary.toFixed(2)}`,
      'EPF Employee (8%)': `Rs. ${emp.epf_employee.toFixed(2)}`,
      'EPF Employer (12%)': `Rs. ${emp.epf_employer.toFixed(2)}`,
      'ETF Employer (3%)': `Rs. ${emp.etf_employer.toFixed(2)}`,
      'Salary Advance': `Rs. ${emp.salary_advance.toFixed(2)}`,
      'Salary Advance 2': `Rs. ${(emp.salary_advance_2 || 0).toFixed(2)}`,
      'Transport': `Rs. ${emp.transport.toFixed(2)}`,
      'Food': `Rs. ${emp.food.toFixed(2)}`,
      'Uniforms': `Rs. ${emp.uniforms.toFixed(2)}`,
      'Other Deductions': `Rs. ${emp.other_deductions.toFixed(2)}`,
      'Final Salary': `Rs. ${emp.final_salary.toFixed(2)}`
    }));

    // Add totals row
    excelData.push({
      'Employee ID': 'TOTAL',
      'Full Name': '',
      'Total Shifts': consolidatedSalaries.reduce((sum, emp) => sum + emp.total_shifts_all, 0),
      'Companies': '',
      'Ranks': '',
      'Gross Total': `Rs. ${consolidatedSalaries.reduce((sum, emp) => sum + emp.gross_shift_total_all, 0).toFixed(2)}`,
      'Basic Salary': '',
      'EPF Employee (8%)': '',
      'EPF Employer (12%)': '',
      'ETF Employer (3%)': '',
      'Salary Advance': '',
      'Salary Advance 2': '',
      'Transport': '',
      'Food': '',
      'Uniforms': '',
      'Other Deductions': '',
      'Final Salary': `Rs. ${consolidatedSalaries.reduce((sum, emp) => sum + emp.final_salary, 0).toFixed(2)}`
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    ws['!cols'] = [
      { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Consolidated Salaries');

    const monthYear = new Date(selectedMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const filename = `Consolidated_Salary_Report_${monthYear}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success(`Exported to ${filename}`);
  };

  const totalGross = consolidatedSalaries.reduce((sum, emp) => sum + emp.gross_shift_total_all, 0);
  const totalFinal = consolidatedSalaries.reduce((sum, emp) => sum + emp.final_salary, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salaries</h1>
          <p className="text-muted-foreground">Manage employee salaries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportToExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="month-select">Select Month</Label>
              <Input
                id="month-select"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-4 items-end">
              <div>
                <p className="text-sm text-muted-foreground">Total Gross</p>
                <p className="text-2xl font-bold">Rs. {totalGross.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Final</p>
                <p className="text-2xl font-bold text-green-600">Rs. {totalFinal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Employee Salaries - Consolidated</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Total Shifts</TableHead>
                <TableHead className="text-right">Gross Total</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Final Salary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidatedSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No salary data for selected month
                  </TableCell>
                </TableRow>
              ) : (
                consolidatedSalaries.map((empSalary) => (
                  <Collapsible key={empSalary.employee.id} asChild>
                    <>
                      <TableRow>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleEmployee(empSalary.employee.id)}
                            >
                              {expandedEmployees.has(empSalary.employee.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">{empSalary.employee.employee_id}</TableCell>
                        <TableCell>{empSalary.employee.full_name}</TableCell>
                        <TableCell className="text-right">{empSalary.total_shifts_all}</TableCell>
                        <TableCell className="text-right">Rs. {empSalary.gross_shift_total_all.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          Rs. {(empSalary.epf_employee + empSalary.salary_advance + (empSalary.salary_advance_2 || 0) + empSalary.transport + empSalary.food + empSalary.uniforms + empSalary.other_deductions).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">Rs. {empSalary.final_salary.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditDialog(empSalary)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintSalarySlip(empSalary)}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/50">
                            <div className="p-4">
                              <h4 className="font-semibold mb-3">Company-wise Breakdown:</h4>
                              <div className="space-y-2">
                                {empSalary.companyWork.map((work) => (
                                  <div key={work.company_id} className="flex justify-between items-center bg-background p-3 rounded">
                                    <div>
                                      <span className="font-medium">{work.company.company_name}</span>
                                      <span className="text-muted-foreground ml-2">({work.rank})</span>
                                    </div>
                                    <div className="flex gap-6 text-sm">
                                      <span>{work.total_shifts} shifts</span>
                                      <span>@ Rs. {work.pay_per_shift}</span>
                                      <span className="font-semibold">Rs. {work.gross_shift_total.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary Details</DialogTitle>
            <DialogDescription>
              Update deductions for {editingRecord?.employee.full_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="basic_salary">Basic Salary</Label>
              <Input
                id="basic_salary"
                type="number"
                step="0.01"
                value={editFormData.basic_salary}
                onChange={(e) => setEditFormData({ ...editFormData, basic_salary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_advance">Salary Advance</Label>
              <Input
                id="salary_advance"
                type="number"
                step="0.01"
                value={editFormData.salary_advance}
                onChange={(e) => setEditFormData({ ...editFormData, salary_advance: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary_advance_2">Salary Advance 2</Label>
              <Input
                id="salary_advance_2"
                type="number"
                step="0.01"
                value={editFormData.salary_advance_2}
                onChange={(e) => setEditFormData({ ...editFormData, salary_advance_2: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport">Transport</Label>
              <Input
                id="transport"
                type="number"
                step="0.01"
                value={editFormData.transport}
                onChange={(e) => setEditFormData({ ...editFormData, transport: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="food">Food</Label>
              <Input
                id="food"
                type="number"
                step="0.01"
                value={editFormData.food}
                onChange={(e) => setEditFormData({ ...editFormData, food: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uniforms">Uniforms</Label>
              <Input
                id="uniforms"
                type="number"
                step="0.01"
                value={editFormData.uniforms}
                onChange={(e) => setEditFormData({ ...editFormData, uniforms: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_deductions">Other Deductions</Label>
              <Input
                id="other_deductions"
                type="number"
                step="0.01"
                value={editFormData.other_deductions}
                onChange={(e) => setEditFormData({ ...editFormData, other_deductions: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
