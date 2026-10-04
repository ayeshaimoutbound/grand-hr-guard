import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZoomIn, ZoomOut } from "lucide-react";

interface Co { id: string; company_name: string; location: string | null; archived: boolean }
interface Emp { id: string; full_name: string; employee_id: string | null }
interface Last { company_id: string; date: string }

/** Fetch every present attendance row in pages (the API caps each request at 1000). */
async function fetchAllAttendance() {
  const out: { employee_id: string; company_id: string; attendance_date: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("attendance")
      .select("employee_id, company_id, attendance_date").eq("present", true)
      .order("attendance_date", { ascending: false }).range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as any));
    if (data.length < 1000) break;
  }
  return out;
}

const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function WorkforceNetwork() {
  const [companies, setCompanies] = useState<Co[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [last, setLast] = useState<Map<string, Last>>(new Map());
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [co, em, att] = await Promise.all([
        supabase.from("companies").select("id, company_name, location, archived").order("company_name"),
        supabase.from("employees").select("id, full_name, employee_id"),
        fetchAllAttendance(),
      ]);
      const m = new Map<string, Last>();
      for (const a of att) {
        const cur = m.get(a.employee_id);
        if (!cur || a.attendance_date > cur.date) m.set(a.employee_id, { company_id: a.company_id, date: a.attendance_date });
      }
      setCompanies((co.data as any) || []);
      setEmployees((em.data as any) || []);
      setLast(m);
      setLoading(false);
    })();
  }, []);

  const layout = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCo = new Map<string, Emp[]>();
    for (const e of employees) {
      const l = last.get(e.id);
      if (!l) continue;
      if (q && !e.full_name.toLowerCase().includes(q) && !(e.employee_id || "").toLowerCase().includes(q)) continue;
      if (!byCo.has(l.company_id)) byCo.set(l.company_id, []);
      byCo.get(l.company_id)!.push(e);
    }
    const cos = companies.filter((c) => !q || byCo.has(c.id) || c.company_name.toLowerCase().includes(q));
    const maxEmp = Math.max(1, ...cos.map((c) => byCo.get(c.id)?.length || 0));
    const empR = Math.max(110, Math.min(260, 70 + maxEmp * 9));
    const n = Math.max(cos.length, 1);
    // Company ring large enough that neighbouring employee clusters don't overlap
    const coR = Math.max(380, (n * (empR * 2 + 60)) / (2 * Math.PI));
    const size = 2 * (coR + empR + 140);
    const cx = size / 2, cy = size / 2;
    const nodes = cos.map((c, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = cx + coR * Math.cos(a), y = cy + coR * Math.sin(a);
      const list = byCo.get(c.id) || [];
      const emps = list.map((e, j) => {
        const span = list.length === 1 ? 0 : Math.min(Math.PI * 1.6, list.length * 0.35);
        const b = a - span / 2 + (list.length === 1 ? 0 : (span * j) / (list.length - 1));
        const ring = j % 2 === 0 ? empR : empR * 0.72; // stagger to fit labels
        return { e, x: x + ring * Math.cos(b), y: y + ring * Math.sin(b), date: last.get(e.id)!.date };
      });
      return { c, x, y, emps };
    });
    return { size, cx, cy, nodes };
  }, [companies, employees, last, search]);

  const { size, cx, cy, nodes } = layout;
  const placed = nodes.reduce((s, n) => s + n.emps.length, 0);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle>Workforce Network</CardTitle>
          <p className="text-sm text-muted-foreground">Each employee is linked to the company where they last worked, with that date. Archived companies are greyed out.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input className="w-56" placeholder="Search employee or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" size="icon" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" title="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}><ZoomIn className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading network...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">{nodes.length} companies · {placed} employees with a last worked location</p>
            <div className="overflow-auto rounded-lg border bg-muted/20" style={{ height: 640 }}>
              <svg width={size * zoom * 0.5} height={size * zoom * 0.5} viewBox={`0 0 ${size} ${size}`}>
                {nodes.map(({ c, x, y, emps }) => {
                  const dim = c.archived;
                  return (
                    <g key={c.id} opacity={dim ? 0.35 : 1}>
                      <line x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--primary))" strokeOpacity={0.4} strokeWidth={2} />
                      {emps.map(({ e, x: ex, y: ey }) => (
                        <line key={e.id} x1={x} y1={y} x2={ex} y2={ey} stroke={dim ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"} strokeOpacity={0.35} />
                      ))}
                    </g>
                  );
                })}
                {nodes.map(({ c, x, y, emps }) => {
                  const dim = c.archived;
                  const fill = dim ? "hsl(var(--muted))" : "hsl(var(--primary))";
                  const text = dim ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))";
                  return (
                    <g key={c.id} opacity={dim ? 0.55 : 1}>
                      {emps.map(({ e, x: ex, y: ey, date }) => (
                        <g key={e.id}>
                          <title>{`${e.full_name}${e.employee_id ? ` (${e.employee_id})` : ""}\nLast worked: ${fmtDate(date)}\nAt: ${c.company_name}${c.location ? ` — ${c.location}` : ""}`}</title>
                          <circle cx={ex} cy={ey} r={7} fill={dim ? "hsl(var(--muted-foreground))" : "hsl(var(--accent))"} stroke="hsl(var(--background))" strokeWidth={2} />
                          <text x={ex} y={ey + 20} textAnchor="middle" fontSize={11} fill={text} fontWeight={600}>{e.full_name.length > 18 ? e.full_name.slice(0, 17) + "…" : e.full_name}</text>
                          <text x={ex} y={ey + 33} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{fmtDate(date)}</text>
                        </g>
                      ))}
                      <title>{`${c.company_name}${c.location ? ` — ${c.location}` : ""}${dim ? " (archived)" : ""}`}</title>
                      <circle cx={x} cy={y} r={22} fill={fill} stroke="hsl(var(--background))" strokeWidth={3} />
                      <text x={x} y={y + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={dim ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))"}>{emps.length}</text>
                      <text x={x} y={y - 30} textAnchor="middle" fontSize={13} fontWeight={700} fill={text}>{c.company_name}{dim ? " (archived)" : ""}</text>
                      {c.location && <text x={x} y={y - 16 - 30 + 30 + 44} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{c.location}</text>}
                    </g>
                  );
                })}
                <circle cx={cx} cy={cy} r={48} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={4} />
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={800} fill="hsl(var(--primary-foreground))">Grand Senaro</text>
                <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fill="hsl(var(--primary-foreground))">Security</text>
              </svg>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tip: point at any dot to see full details. The number in each company circle is how many employees last worked there.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
