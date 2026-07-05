
## 1. Replace uniform bulk upload template

Copy the newly uploaded `Uniform_Bulk_Upload_Template-4.xlsx` over `public/Uniform_Bulk_Upload_Template.xlsx`. The template now includes an `Invoice No` cell (B2), per-row `Amount/unit`, per-row `Total` (formulas), section subtotals, and a `Grand Total` cell (B45). The parser in `src/pages/Inventory.tsx` will be rewritten to:

- Read `Invoice No` from B2 and `Grand Total` from B45 (recalculated values).
- Detect each pivot block by scanning for header rows containing `Category` / `Item` / (`Size` optional) / one or more color columns / `Amount/unit` / `Total`.
- Emit one movement row per (item, size, color) with a non-zero qty, capturing unit price.
- Create one **uniform batch** row grouping all movements from that upload.

## 2. Uniform batches and 3-month amortization

New table `uniform_batches`:
- `batch_number` (auto: `UB-YYYYMM-####`)
- `invoice_number`, `grand_total`, `upload_date`, `notes`, `created_by`

Extend `inventory_movements` (already tracks per-employee issuance) with `batch_id` FK.

Extend `uniform_advances` (existing table) with `batch_id`, `monthly_installment`, `months_remaining` (default 3), `start_month`.

When a uniform is issued to an employee (existing flow in Inventory), it auto-creates a `uniform_advances` row with:
- `total_amount` = uniform cost
- `monthly_installment` = total / 3
- `start_month` = current month
- `months_remaining` = 3

Salary engine (`src/lib/salaryEngine.ts`) already reads `uniform_advances`. Update it to only charge `monthly_installment` per salary month if the salary month falls within `[start_month, start_month + 2]`, decrement `months_remaining` when a salary for that month is finalized.

## 3. Food module

New tables:
- `food_vendors` — `company_id`, `vendor_name`, `contact`
- `food_rates` — `company_id`, `location` (optional), `breakfast_rate`, `lunch_rate`, `dinner_rate`, `effective_from`
- `food_charges` — `employee_id`, `company_id`, `location`, `month` (YYYY-MM-01), `breakfast_count`, `lunch_count`, `dinner_count`, `total_amount`, `vendor_id`, `manual_entry` (bool)

New page `src/pages/Food.tsx` (route `/food`, admin/office access):
1. Select **Company** + **Location** + **Month**.
2. Auto-populate employees who have attendance rows for that company+location+month.
3. Table columns: Employee, Breakfast qty, Lunch qty, Dinner qty, Total (auto = sum(qty × rate)).
4. "Add employee manually" button for non-roster people.
5. Vendor picker (add-new inline) + save-all button.
6. On save, upsert `food_charges` and mirror totals into `salary_manual_deductions` with category `Food` for that employee/month so the salary engine picks them up automatically.

Sidebar: add "Food" link under Salaries/Attendance area (respect office-role access).

## 4. Salary engine hookup

- Uniform: use `monthly_installment` gating by month window (already in `uniform_advances`).
- Food: `salary_manual_deductions` already flows into salary; food entries are written there so no engine change is needed beyond ensuring category = "Food".

## Technical notes
- Currency labels remain `LKR`.
- All new tables: GRANT + RLS with `private.is_admin_or_super` / `private.is_office` helpers already established.
- No changes to Finance / User Management modules (restricted).
- Batch number generator: `private.next_uniform_batch_number()` using a sequence per month.
