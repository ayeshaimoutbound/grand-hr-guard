# Grand HR Suite

App name: Grand Senaro – Human Resources

Build a secure HR management system for a security firm with role-based access control. Include modules for Employee, Company, Attendance, and Salary management.

Login Roles:

Super Admin

Username: Super

Password: GS305321

Full access: can add, view, edit, and delete everything.

Can add/remove admins, change passwords, and export/backup/restore data.

Admin

Username: admin

Password: Grands17

Can add new employees and companies (cannot edit or delete after saving).

Can manage attendance and calculate/view salaries.

Cannot create new users or change system settings.

Modules:

Employee Module

Fields: Full Name, Employee ID (manual entry), NIC, Bank Name, Branch, Account Number, Phone Number.

Rank not required.

Admin can only add; Super Admin full edit/delete.

Search by name or ID.

Company Module

Fields: Company Name, Location, Pay per shift (OIC, SSO, JSO, LSO).

Admin can add only; Super Admin can edit/delete.

Each company has pay rates for all ranks.

Attendance Module

Ask user to select a company, then show a unique calendar for that company and month.

Fields: Employee Name (select), Employee ID (auto-filled), Rank (OIC/SSO/JSO/LSO), Company (auto), Shift Type (Day/Night).

Mark “1” for Present; blank = Absent.

Automatically calculate shift payments per rank, total shifts per employee, and total shifts for the company.

Admin can add/edit/delete attendance; Super Admin full control.

Export attendance to PDF/Excel.

Salary Module

Salary = worked shifts + manually entered Basic Salary.

Fields: Basic Salary, Total Shifts Worked, Pay per Shift, Gross Shift Total (Shifts × Pay per Shift).

Deductions: Salary Advance, EPF (8% of Basic Salary auto-calculated), Uniforms, Food, Transport, Other.

Final Salary = (Gross Shift Total – Basic Salary) – Total Deductions.

Admin can view/generate salary sheets; Super Admin can edit.

Export payslips and summaries by employee, company, or month.

System Rules:

Admin cannot edit/delete saved employees or companies.

Super Admin can edit/delete all data.

Employees can work for multiple companies (link in Attendance).

Export and print attendance and salary data.

Dashboard: total employees, companies, shifts per month, total salary processed.

Clean, responsive UI with sidebar navigation.

Manual data entry only (no automated imports).

Build exactly as described, maintaining all roles, permissions, and calculations.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://grand-hr-guard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/943b507b-3ac8-4090-9b21-62b7d609f4ea).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
