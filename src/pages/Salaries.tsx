import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
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

interface EmployeeSalaryRecord {
  employee: Employee;
  salary_id: string;
  total_shifts: number;
  pay_per_shift: number;
  gross_shift_total: number;
  basic_salary: number;
  epf: number;
  salary_advance: number;
  transport: number;
  food: number;
  uniforms: number;
  other_deductions: number;
  final_salary: number;
}

interface CompanySalaryData {
  company: Company;
  employees: EmployeeSalaryRecord[];
  totalShifts: number;
  totalGross: number;
}

export default function Salaries() {
  const [companySalaryData, setCompanySalaryData] = useState<CompanySalaryData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [editingCell, setEditingCell] = useState<{ salaryId: string; field: string } | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    const [employeesRes, companiesRes, salariesRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("companies").select("id, company_name"),
      supabase.from("salaries").select("*").gte("salary_month", `${selectedMonth}-01`).lte("salary_month", `${selectedMonth}-31`),
    ]);

    if (employeesRes.error || companiesRes.error) {
      toast.error("Error fetching data");
      return;
    }

    const employeesList = employeesRes.data || [];
    const companiesList = companiesRes.data || [];
    const salariesList = salariesRes.data || [];

    // Group salaries by company
    const companyDataMap = new Map<string, CompanySalaryData>();

    salariesList.forEach(salary => {
      if (!salary.company_id) return;

      const employee = employeesList.find(e => e.id === salary.employee_id);
      const company = companiesList.find(c => c.id === salary.company_id);
      
      if (!employee || !company) return;

      if (!companyDataMap.has(salary.company_id)) {
        companyDataMap.set(salary.company_id, {
          company,
          employees: [],
          totalShifts: 0,
          totalGross: 0,
        });
      }

      const companyData = companyDataMap.get(salary.company_id)!;
      
      companyData.employees.push({
        employee,
        salary_id: salary.id,
        total_shifts: salary.total_shifts || 0,
        pay_per_shift: salary.pay_per_shift || 0,
        gross_shift_total: salary.gross_shift_total || 0,
        basic_salary: salary.basic_salary || 0,
        epf: salary.epf || 0,
        salary_advance: salary.salary_advance || 0,
        transport: salary.transport || 0,
        food: salary.food || 0,
        uniforms: salary.uniforms || 0,
        other_deductions: salary.other_deductions || 0,
        final_salary: salary.final_salary || 0,
      });

      companyData.totalShifts += salary.total_shifts || 0;
      companyData.totalGross += salary.gross_shift_total || 0;
    });

    setCompanySalaryData(Array.from(companyDataMap.values()));
    // Expand all companies by default
    setExpandedCompanies(new Set(Array.from(companyDataMap.keys())));
  };

  const handleCellEdit = async (salaryId: string, field: string, value: number, employeeRecord: EmployeeSalaryRecord) => {
    // Validate input
    const salaryFieldSchema = z.number()
      .min(0, 'Value cannot be negative')
      .max(10000000, 'Value exceeds maximum allowed');
    
    try {
      salaryFieldSchema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Calculate new final salary
    const newValues = { ...employeeRecord, [field]: value };
    const newFinalSalary = newValues.basic_salary + newValues.gross_shift_total - 
      newValues.epf - newValues.salary_advance - newValues.transport - 
      newValues.food - newValues.uniforms - newValues.other_deductions;

    // Update local state
    setCompanySalaryData(prev =>
      prev.map(companyData => ({
        ...companyData,
        employees: companyData.employees.map(emp =>
          emp.salary_id === salaryId
            ? { ...emp, [field]: value, final_salary: newFinalSalary }
            : emp
        ),
      }))
    );

    // Update in database
    const { error } = await supabase
      .from("salaries")
      .update({ 
        [field]: value,
        final_salary: newFinalSalary 
      })
      .eq("id", salaryId);

    if (error) {
      toast.error("Failed to update salary");
    }

    setEditingCell(null);
  };

  const handlePrintSalarySlip = (employeeRecord: EmployeeSalaryRecord, companyName: string) => {
    // Security: Restrict salary slip printing to super admins only
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
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; margin: 5px 0; }
          .info-label { font-weight: bold; width: 150px; }
          .info-value { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .final-row { font-weight: bold; background-color: #e8f5e9; font-size: 16px; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SALARY SLIP</h1>
          <p>Month: ${new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <p>Company: ${companyName}</p>
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
            <span class="info-label">NIC:</span>
            <span class="info-value">${employeeRecord.employee.nic}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${employeeRecord.employee.phone_number}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Bank:</span>
            <span class="info-value">${employeeRecord.employee.bank_name} - ${employeeRecord.employee.branch}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Account Number:</span>
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
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">${employeeRecord.basic_salary.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Shift Earnings (${employeeRecord.total_shifts} shifts × Rs. ${employeeRecord.pay_per_shift})</td>
              <td style="text-align: right;">${employeeRecord.gross_shift_total.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Gross Salary</td>
              <td style="text-align: right;">${(employeeRecord.basic_salary + employeeRecord.gross_shift_total).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="background-color: #f5f5f5; font-weight: bold;">Deductions</td>
            </tr>
            <tr>
              <td>EPF</td>
              <td style="text-align: right;">${employeeRecord.epf.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Salary Advance</td>
              <td style="text-align: right;">${employeeRecord.salary_advance.toFixed(2)}</td>
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
              <td style="text-align: right;">${(employeeRecord.epf + employeeRecord.salary_advance + employeeRecord.transport + employeeRecord.food + employeeRecord.uniforms + employeeRecord.other_deductions).toFixed(2)}</td>
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

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const renderEditableCell = (
    salaryId: string,
    field: string,
    value: number,
    employeeRecord: EmployeeSalaryRecord
  ) => {
    if (editingCell?.salaryId === salaryId && editingCell?.field === field) {
      return (
        <Input
          type="number"
          defaultValue={value}
          onBlur={(e) => handleCellEdit(salaryId, field, parseFloat(e.target.value) || 0, employeeRecord)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(salaryId, field, parseFloat(e.currentTarget.value) || 0, employeeRecord);
            }
          }}
          autoFocus
          className="w-24 h-8"
        />
      );
    }

    return (
      <span 
        onClick={() => isSuperAdmin && setEditingCell({ salaryId, field })} 
        className={isSuperAdmin ? "cursor-pointer hover:bg-muted px-2 py-1 rounded" : ""}
      >
        Rs. {value.toFixed(2)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground">Manage employee salaries by company</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="salary_month">Select Month</Label>
              <Input
                id="salary_month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {companySalaryData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No salary data found for selected month
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {companySalaryData.map((companyData) => (
            <Collapsible
              key={companyData.company.id}
              open={expandedCompanies.has(companyData.company.id)}
              onOpenChange={() => toggleCompany(companyData.company.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">{companyData.company.company_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {companyData.employees.length} employee{companyData.employees.length !== 1 ? 's' : ''} • 
                          {companyData.totalShifts} total shifts • 
                          Rs. {companyData.totalGross.toFixed(2)} total gross
                        </p>
                      </div>
                      {expandedCompanies.has(companyData.company.id) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Shifts</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Basic</TableHead>
                            <TableHead className="text-right">EPF</TableHead>
                            <TableHead className="text-right">Advance</TableHead>
                            <TableHead className="text-right">Transport</TableHead>
                            <TableHead className="text-right">Food</TableHead>
                            <TableHead className="text-right">Uniforms</TableHead>
                            <TableHead className="text-right">Other</TableHead>
                            <TableHead className="text-right bg-muted font-bold">Final Salary</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyData.employees.map((empRecord) => (
                            <TableRow key={empRecord.salary_id}>
                              <TableCell className="font-medium">{empRecord.employee.employee_id}</TableCell>
                              <TableCell>{empRecord.employee.full_name}</TableCell>
                              <TableCell className="text-right">{empRecord.total_shifts}</TableCell>
                              <TableCell className="text-right text-sm">Rs. {empRecord.pay_per_shift}</TableCell>
                              <TableCell className="text-right font-medium">Rs. {empRecord.gross_shift_total.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'basic_salary', empRecord.basic_salary, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'epf', empRecord.epf, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'salary_advance', empRecord.salary_advance, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'transport', empRecord.transport, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'food', empRecord.food, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'uniforms', empRecord.uniforms, empRecord)}
                              </TableCell>
                              <TableCell className="text-right">
                                {renderEditableCell(empRecord.salary_id, 'other_deductions', empRecord.other_deductions, empRecord)}
                              </TableCell>
                              <TableCell className="text-right font-bold bg-muted">
                                Rs. {empRecord.final_salary.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handlePrintSalarySlip(empRecord, companyData.company.company_name)}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
