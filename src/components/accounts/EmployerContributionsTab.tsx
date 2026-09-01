import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { fetchEmployerContributions, sumContributions, type ContributionRow } from "@/lib/employerContributions";
import { PDF_HEADER_STYLES, getPdfHeaderHtml } from "@/lib/pdfHeader";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EmployerContributionsTab() {
  const [month, setMonth] = useState(toMonthStr());
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setRows(await fetchEmployerContributions(month));
      setLoading(false);
    })();
  }, [month]);

  const totals = useMemo(() => sumContributions(rows), [rows]);
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const visible = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.full_name} ${r.employee_no} ${r.epf_no}`.toLowerCase().includes(q);
  });

  const exportExcel = () => {
    if (!rows.length) { toast.error("No contribution data for this month"); return; }
    const data = rows.map((r) => ({
      "Employee ID": r.employee_no,
      "Name": r.full_name,
      "EPF No": r.epf_no,
      "Shifts": r.shifts,
      "EPF Days": r.epf_days,
      "EPF Basic": r.epf_basic.toFixed(2),
      "EPF 12% (Employer)": r.epf_12.toFixed(2),
      "ETF 3% (Employer)": r.etf_3.toFixed(2),
      "Total": r.total.toFixed(2),
    }));
    data.push({
      "Employee ID": "", "Name": "TOTAL", "EPF No": "", "Shifts": "" as any, "EPF Days": "" as any,
      "EPF Basic": totals.epf_basic.toFixed(2),
      "EPF 12% (Employer)": totals.epf_12.toFixed(2),
      "ETF 3% (Employer)": totals.etf_3.toFixed(2),
      "Total": totals.total.toFixed(2),
    } as any);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "EPF-ETF");
    XLSX.writeFile(wb, `EPF_ETF_${month}.xlsx`);
    toast.success("Report exported");
  };

  const printReport = () => {
    if (!rows.length) { toast.error("No contribution data for this month"); return; }
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>EPF & ETF Report ${monthLabel}</title>
      <style>body{font-family:Arial;margin:28px;font-size:12px;color:#111}
      ${PDF_HEADER_STYLES}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #cfd8d6;padding:6px}
      th{background:#e6f4ef;color:#014d3a}
      .r{text-align:right}.tot{font-weight:bold;background:#f4faf7}</style></head><body>
      ${getPdfHeaderHtml("EPF &amp; ETF CONTRIBUTION REPORT")}
      <p><b>Period:</b> ${monthLabel}</p>
      <table><thead><tr>
      <th>Employee ID</th><th>Name</th><th>EPF No</th><th class="r">Shifts</th>
      <th class="r">EPF Basic</th><th class="r">EPF 12%</th><th class="r">ETF 3%</th><th class="r">Total</th>
      </tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.employee_no}</td><td>${r.full_name}</td><td>${r.epf_no}</td>
        <td class="r">${r.shifts}</td><td class="r">${money(r.epf_basic)}</td>
        <td class="r">${money(r.epf_12)}</td><td class="r">${money(r.etf_3)}</td><td class="r">${money(r.total)}</td></tr>`).join("")}
      <tr class="tot"><td colspan="4">TOTAL (${rows.length} employees)</td>
        <td class="r">${money(totals.epf_basic)}</td><td class="r">${money(totals.epf_12)}</td>
        <td class="r">${money(totals.etf_3)}</td><td class="r">${money(totals.total)}</td></tr>
      </tbody></table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle>Employer Contributions — EPF &amp; ETF</CardTitle>
          <p className="text-sm text-muted-foreground">Auto-generated from salary data. EPF 12% + ETF 3% of EPF basic — a company cost.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input className="w-48" placeholder="Search employee / EPF no..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
          <Button variant="outline" onClick={exportExcel}><FileDown className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" onClick={printReport}><Printer className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "EPF Basic Total", value: totals.epf_basic },
            { label: "EPF 12% (Employer)", value: totals.epf_12 },
            { label: "ETF 3% (Employer)", value: totals.etf_3 },
            { label: "Total Employer Cost", value: totals.total },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold">LKR {money(c.value)}</p>
            </div>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>EPF No</TableHead>
              <TableHead className="text-right">Shifts</TableHead>
              <TableHead className="text-right">EPF Basic</TableHead>
              <TableHead className="text-right">EPF 12%</TableHead>
              <TableHead className="text-right">ETF 3%</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No contributions for {monthLabel}</TableCell></TableRow>
            ) : visible.map((r) => (
              <TableRow key={r.employee_id}>
                <TableCell>
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">{r.employee_no}</div>
                </TableCell>
                <TableCell>{r.epf_no}</TableCell>
                <TableCell className="text-right">{r.shifts}</TableCell>
                <TableCell className="text-right">LKR {money(r.epf_basic)}</TableCell>
                <TableCell className="text-right">LKR {money(r.epf_12)}</TableCell>
                <TableCell className="text-right">LKR {money(r.etf_3)}</TableCell>
                <TableCell className="text-right font-semibold">LKR {money(r.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
