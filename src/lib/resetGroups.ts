export const RESET_GROUPS = [
  { key: "invoices", label: "Invoices", description: "Invoices and their payments" },
  { key: "payments", label: "Invoice payments", description: "Payments only; resets received totals" },
  { key: "salaries", label: "Salaries / EPF & ETF records", description: "Saved salary records and deductions; attendance-based calculations remain" },
  { key: "attendance", label: "Attendance", description: "All shifts; recalculates existing invoices and salaries" },
  { key: "overtime", label: "Overtime", description: "OT entries; recalculates existing invoices and salaries" },
  { key: "cash_advances", label: "Cash advances", description: "Cash advance records" },
  { key: "food_advances", label: "Food advances", description: "Food advance records" },
  { key: "uniform_advances", label: "Uniform advances", description: "Uniform deduction instalments" },
  { key: "food", label: "Food", description: "Charges, rates and food vendors" },
  { key: "inventory", label: "Inventory", description: "Items, movements, purchases, uniform batches and assets; linked expenses remain" },
  { key: "maintenance", label: "Maintenance", description: "Maintenance records; linked expenses remain" },
  { key: "expenses", label: "Accounts expenses", description: "Expenses only; linked maintenance and purchases remain" },
  { key: "expense_categories", label: "Expense categories", description: "Custom expense category choices" },
  { key: "files", label: "Files", description: "All file records; uploaded copies are retained in storage" },
  { key: "complaints", label: "Complaints & investigations", description: "Investigations, notes and file records; uploaded copies remain in storage" },
  { key: "vendors", label: "Vendors", description: "Vendor records; other records lose vendor links" },
  { key: "rates", label: "Custom / historical rates", description: "Employee overrides and company rate history" },
  { key: "companies", label: "All companies", description: "Also deletes linked attendance, OT, invoices, salaries, company files and investigations" },
  { key: "employees", label: "All employees — Super Admin only", description: "Also deletes linked attendance, OT, salaries, advances, food charges, employee files and investigations" },
] as const;

export function canResetData(role: string | null): boolean { return role === "super_admin"; }