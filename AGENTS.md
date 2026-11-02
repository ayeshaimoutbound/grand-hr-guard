# Project rules
- Contact export uses a pure selection/order helper; exporting must never implicitly include unselected employees.
- Bulk module clearing uses one transaction through a server-authorized RPC; UI visibility is not authorization.
- Attendance and logged OT synchronize existing invoice totals server-side; received payments and invoice identity must be preserved.
- Monthly payroll analytics use the same calculation engine as Salaries, rather than stale saved salary totals.