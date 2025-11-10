import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface EmployeeSalaryData {
  employee: Employee;
  companies: {
    [companyId: string]: {
      company_name: string;
      total_shifts: number;
      pay_per_shift: number;
      gross_total: number;
    };
  };
  total_shifts: number;
  total_gross: number;
  basic_salary: number;
  epf: number;
  salary_advance: number;
  transport: number;
  food: number;
  uniforms: number;
  other_deductions: number;
  final_salary: number;
}

export default function Salaries() {
  const [employeesSalaryData, setEmployeesSalaryData] = useState<EmployeeSalaryData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCell, setEditingCell] = useState<{ employeeId: string; field: string } | null>(null);
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

    setEmployees(employeesList);
    setCompanies(companiesList);

    // Build salary data structure
    const salaryData: EmployeeSalaryData[] = employeesList.map((emp) => {
      const employeeSalaries = salariesList.filter(s => s.employee_id === emp.id);
      
      const companiesData: { [key: string]: any } = {};
      let totalShifts = 0;
      let totalGross = 0;
      let basicSalary = 0;
      let epf = 0;
      let salaryAdvance = 0;
      let transport = 0;
      let food = 0;
      let uniforms = 0;
      let otherDeductions = 0;

      employeeSalaries.forEach(salary => {
        if (salary.company_id) {
          const company = companiesList.find(c => c.id === salary.company_id);
          companiesData[salary.company_id] = {
            company_name: company?.company_name || "Unknown",
            total_shifts: salary.total_shifts || 0,
            pay_per_shift: salary.pay_per_shift || 0,
            gross_total: salary.gross_shift_total || 0,
          };
          totalShifts += salary.total_shifts || 0;
          totalGross += salary.gross_shift_total || 0;
        }
        
        // Use the latest values for deductions
        basicSalary = salary.basic_salary || 0;
        epf = salary.epf || 0;
        salaryAdvance = salary.salary_advance || 0;
        transport = salary.transport || 0;
        food = salary.food || 0;
        uniforms = salary.uniforms || 0;
        otherDeductions = salary.other_deductions || 0;
      });

      const finalSalary = basicSalary + totalGross - epf - salaryAdvance - transport - food - uniforms - otherDeductions;

      return {
        employee: emp,
        companies: companiesData,
        total_shifts: totalShifts,
        total_gross: totalGross,
        basic_salary: basicSalary,
        epf,
        salary_advance: salaryAdvance,
        transport,
        food,
        uniforms,
        other_deductions: otherDeductions,
        final_salary: finalSalary,
      };
    });

    setEmployeesSalaryData(salaryData);
  };

  const handleCellEdit = async (employeeId: string, field: string, value: number) => {
    // Update the local state
    setEmployeesSalaryData(prev => 
      prev.map(data => {
        if (data.employee.id === employeeId) {
          const updated = { ...data, [field]: value };
          updated.final_salary = updated.basic_salary + updated.total_gross - updated.epf - updated.salary_advance - updated.transport - updated.food - updated.uniforms - updated.other_deductions;
          return updated;
        }
        return data;
      })
    );

    // Update in database
    const salaryMonth = `${selectedMonth}-01`;
    const { data: salaries } = await supabase
      .from("salaries")
      .select("id")
      .eq("employee_id", employeeId)
      .gte("salary_month", salaryMonth)
      .lte("salary_month", `${selectedMonth}-31`);

    if (salaries && salaries.length > 0) {
      const employeeData = employeesSalaryData.find(d => d.employee.id === employeeId);
      if (employeeData) {
        const finalSalary = (field === 'basic_salary' ? value : employeeData.basic_salary) + 
                           employeeData.total_gross - 
                           (field === 'epf' ? value : employeeData.epf) - 
                           (field === 'salary_advance' ? value : employeeData.salary_advance) - 
                           (field === 'transport' ? value : employeeData.transport) - 
                           (field === 'food' ? value : employeeData.food) - 
                           (field === 'uniforms' ? value : employeeData.uniforms) - 
                           (field === 'other_deductions' ? value : employeeData.other_deductions);

        for (const salary of salaries) {
          await supabase
            .from("salaries")
            .update({ 
              [field]: value,
              final_salary: finalSalary 
            })
            .eq("id", salary.id);
        }
      }
    }

    setEditingCell(null);
  };

  const handlePrintSalarySlip = (employeeData: EmployeeSalaryData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Slip - ${employeeData.employee.full_name}</title>
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
        </div>

        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Employee ID:</span>
            <span class="info-value">${employeeData.employee.employee_id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${employeeData.employee.full_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">NIC:</span>
            <span class="info-value">${employeeData.employee.nic}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${employeeData.employee.phone_number}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Bank:</span>
            <span class="info-value">${employeeData.employee.bank_name} - ${employeeData.employee.branch}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Account Number:</span>
            <span class="info-value">${employeeData.employee.account_number}</span>
          </div>
        </div>

        <h3>Company-wise Shift Details</h3>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Total Shifts</th>
              <th>Pay per Shift</th>
              <th>Gross Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(employeeData.companies).map(comp => `
              <tr>
                <td>${comp.company_name}</td>
                <td>${comp.total_shifts}</td>
                <td>Rs. ${comp.pay_per_shift.toFixed(2)}</td>
                <td>Rs. ${comp.gross_total.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>Total</td>
              <td>${employeeData.total_shifts}</td>
              <td>-</td>
              <td>Rs. ${employeeData.total_gross.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <h3>Earnings & Deductions</h3>
        <table>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">Rs. ${employeeData.basic_salary.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Shift Total</td>
              <td style="text-align: right;">Rs. ${employeeData.total_gross.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Gross Earnings</td>
              <td style="text-align: right;">Rs. ${(employeeData.basic_salary + employeeData.total_gross).toFixed(2)}</td>
            </tr>
            <tr>
              <td>EPF</td>
              <td style="text-align: right;">Rs. ${employeeData.epf.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Salary Advance</td>
              <td style="text-align: right;">Rs. ${employeeData.salary_advance.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Transport</td>
              <td style="text-align: right;">Rs. ${employeeData.transport.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Food</td>
              <td style="text-align: right;">Rs. ${employeeData.food.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Uniforms</td>
              <td style="text-align: right;">Rs. ${employeeData.uniforms.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Other Deductions</td>
              <td style="text-align: right;">Rs. ${employeeData.other_deductions.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Deductions</td>
              <td style="text-align: right;">Rs. ${(employeeData.epf + employeeData.salary_advance + employeeData.transport + employeeData.food + employeeData.uniforms + employeeData.other_deductions).toFixed(2)}</td>
            </tr>
            <tr class="final-row">
              <td>NET SALARY</td>
              <td style="text-align: right;">Rs. ${employeeData.final_salary.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
          <p>This is a computer-generated salary slip</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredData = employeesSalaryData.filter(data =>
    data.employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground">Manage employee salaries across all companies</p>
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
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Salary Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Employee ID</TableHead>
                  <TableHead className="sticky left-[120px] bg-background z-10">Name</TableHead>
                  {companies.map(company => (
                    <TableHead key={company.id} className="text-center" colSpan={3}>
                      {company.company_name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total Shifts</TableHead>
                  <TableHead className="text-right">Total Gross</TableHead>
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
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="sticky left-[120px] bg-background z-10"></TableHead>
                  {companies.map(company => (
                    <>
                      <TableHead key={`${company.id}-shifts`} className="text-xs text-center">Shifts</TableHead>
                      <TableHead key={`${company.id}-rate`} className="text-xs text-center">Rate</TableHead>
                      <TableHead key={`${company.id}-total`} className="text-xs text-center">Total</TableHead>
                    </>
                  ))}
                  <TableHead colSpan={10}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13 + companies.length * 3} className="text-center text-muted-foreground">
                      No salary data found for selected month
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((data) => (
                    <TableRow key={data.employee.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">{data.employee.employee_id}</TableCell>
                      <TableCell className="sticky left-[120px] bg-background">{data.employee.full_name}</TableCell>
                      {companies.map(company => {
                        const companyData = data.companies[company.id];
                        return (
                          <>
                            <TableCell key={`${company.id}-shifts`} className="text-center">
                              {companyData?.total_shifts || 0}
                            </TableCell>
                            <TableCell key={`${company.id}-rate`} className="text-center text-xs">
                              {companyData ? `Rs. ${companyData.pay_per_shift}` : '-'}
                            </TableCell>
                            <TableCell key={`${company.id}-total`} className="text-right">
                              {companyData ? `Rs. ${companyData.gross_total.toFixed(2)}` : '-'}
                            </TableCell>
                          </>
                        );
                      })}
                      <TableCell className="text-right font-medium">{data.total_shifts}</TableCell>
                      <TableCell className="text-right font-medium">Rs. {data.total_gross.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'basic_salary' ? (
                          <Input
                            type="number"
                            defaultValue={data.basic_salary}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'basic_salary', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'basic_salary', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'basic_salary' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.basic_salary.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'epf' ? (
                          <Input
                            type="number"
                            defaultValue={data.epf}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'epf', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'epf', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'epf' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.epf.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'salary_advance' ? (
                          <Input
                            type="number"
                            defaultValue={data.salary_advance}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'salary_advance', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'salary_advance', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'salary_advance' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.salary_advance.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'transport' ? (
                          <Input
                            type="number"
                            defaultValue={data.transport}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'transport', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'transport', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'transport' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.transport.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'food' ? (
                          <Input
                            type="number"
                            defaultValue={data.food}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'food', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'food', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'food' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.food.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'uniforms' ? (
                          <Input
                            type="number"
                            defaultValue={data.uniforms}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'uniforms', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'uniforms', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'uniforms' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.uniforms.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCell?.employeeId === data.employee.id && editingCell?.field === 'other_deductions' ? (
                          <Input
                            type="number"
                            defaultValue={data.other_deductions}
                            onBlur={(e) => handleCellEdit(data.employee.id, 'other_deductions', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellEdit(data.employee.id, 'other_deductions', parseFloat(e.currentTarget.value) || 0);
                            }}
                            autoFocus
                            className="w-24 h-8"
                          />
                        ) : (
                          <span onClick={() => isSuperAdmin && setEditingCell({ employeeId: data.employee.id, field: 'other_deductions' })} className={isSuperAdmin ? "cursor-pointer hover:bg-muted" : ""}>
                            Rs. {data.other_deductions.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right bg-muted font-bold">
                        Rs. {data.final_salary.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintSalarySlip(data)}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Print
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
