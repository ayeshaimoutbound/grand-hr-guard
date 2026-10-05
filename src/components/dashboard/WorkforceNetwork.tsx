import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Pause, Play, Building2, User, Bell, ArrowRight } from "lucide-react";
import { toMonthStr } from "@/lib/dateUtils";

interface Co { id: string; company_name: string; location: string | null; archived: boolean }
interface Emp { id: string; full_name: string; employee_id: string | null }
interface Att { employee_id: string; company_id: string; attendance_date: string }

/** Fetch every present attendance row in pages (the API caps each request at 1000). */
async function fetchAllAttendance() {
  const out: Att[] = [];
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
const coLabel = (c: Co) => `${c.company_name}${c.location ? ` — ${c.location}` : ""}`;

/** One star: company hub in the middle, one branch per employee who last worked there. */
function Star({ c, emps }: { c: Co; emps: { e: Emp; date: string }[] }) {
  const n = emps.length;
  const R = n <= 6 ? 105 : n <= 14 ? 125 : 140;
  const size = 2 * R + 130;
  const cx = size / 2, cy = size / 2;
  const dim = c.archived;
  const line = dim ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      {emps.map(({ e }, i) => {
        const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
        return <line key={e.id} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke={line} strokeOpacity={0.45} strokeWidth={1.5} />;
      })}
      {emps.map(({ e, date }, i) => {
        const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const below = Math.sin(a) > -0.3;
        return (
          <g key={e.id}>
            <title>{`${e.full_name}${e.employee_id ? ` (${e.employee_id})` : ""}\nLast worked: ${fmtDate(date)}`}</title>
            <circle cx={x} cy={y} r={7} fill={dim ? "hsl(var(--muted-foreground))" : "hsl(var(--accent))"} stroke="hsl(var(--background))" strokeWidth={2} />
            <text x={x} y={below ? y + 20 : y - 22} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
              {e.full_name.length > 16 ? e.full_name.slice(0, 15) + "…" : e.full_name}
            </text>
            <text x={x} y={below ? y + 32 : y - 10} textAnchor="middle" fontSize={9.5} fill="hsl(var(--muted-foreground))">{fmtDate(date)}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={30} fill={dim ? "hsl(var(--muted))" : "hsl(var(--primary))"} stroke="hsl(var(--background))" strokeWidth={3} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill={dim ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))"}>{n}</text>
      {n === 0 && <text x={cx} y={cy + 52} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">No employees last worked here</text>}
    </svg>
  );
}

export default function WorkforceNetwork() {
  const [companies, setCompanies] = useState<Co[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ type: "co" | "emp"; id: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [co, em, a] = await Promise.all([
        supabase.from("companies").select("id, company_name, location, archived").order("company_name"),
        supabase.from("employees").select("id, full_name, employee_id"),
        fetchAllAttendance(),
      ]);
      setCompanies((co.data as any) || []);
      setEmployees((em.data as any) || []);
      setAtt(a);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 60000); // refresh every minute so new moves show up
    return () => clearInterval(t);
  }, []);

  // Latest updates: an employee placed at a location for the first time, or moved to a different one
  const updates = useMemo(() => {
    const per = new Map<string, Att[]>();
    for (const a of att) {
      if (!per.has(a.employee_id)) per.set(a.employee_id, []);
      per.get(a.employee_id)!.push(a);
    }
    const ev: { employee_id: string; from: string | null; to: string; date: string }[] = [];
    per.forEach((rows, empId) => {
      rows.sort((a, b) => (a.attendance_date < b.attendance_date ? -1 : 1));
      let prev: string | null = null;
      for (const r of rows) {
        if (r.company_id !== prev) ev.push({ employee_id: empId, from: prev, to: r.company_id, date: r.attendance_date });
        prev = r.company_id;
      }
    });
    return ev.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  }, [att]);

  const last = useMemo(() => {
    const m = new Map<string, { company_id: string; date: string }>();
    for (const a of att) {
      const cur = m.get(a.employee_id);
      if (!cur || a.attendance_date > cur.date) m.set(a.employee_id, { company_id: a.company_id, date: a.attendance_date });
    }
    return m;
  }, [att]);

  const byCo = useMemo(() => {
    const m = new Map<string, { e: Emp; date: string }[]>();
    for (const e of employees) {
      const l = last.get(e.id);
      if (!l) continue;
      if (!m.has(l.company_id)) m.set(l.company_id, []);
      m.get(l.company_id)!.push({ e, date: l.date });
    }
    m.forEach((list) => list.sort((a, b) => a.e.full_name.localeCompare(b.e.full_name)));
    return m;
  }, [employees, last]);

  // Active companies first, archived (greyed) last
  const ordered = useMemo(() => [...companies].sort((a, b) => Number(a.archived) - Number(b.archived)), [companies]);

  // Gentle auto-scroll down; pauses on hover; loops back to top
  useEffect(() => {
    if (!auto || hover || loading) return;
    const t = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) el.scrollTop = 0;
      else el.scrollTop += 1;
    }, 40);
    return () => clearInterval(t);
  }, [auto, hover, loading]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { cos: [], emps: [] };
    return {
      cos: companies.filter((c) => coLabel(c).toLowerCase().includes(s)).slice(0, 15),
      emps: employees.filter((e) => e.full_name.toLowerCase().includes(s) || (e.employee_id || "").toLowerCase().includes(s)).slice(0, 15),
    };
  }, [q, companies, employees]);

  const month = toMonthStr();
  const coStats = (id: string) => {
    const rows = att.filter((a) => a.company_id === id);
    const monthRows = rows.filter((a) => a.attendance_date.startsWith(month));
    return {
      allShifts: rows.length,
      monthShifts: monthRows.length,
      monthPeople: new Set(monthRows.map((r) => r.employee_id)).size,
      everPeople: new Set(rows.map((r) => r.employee_id)).size,
      lastDate: rows[0]?.attendance_date || null,
    };
  };
  const empStats = (id: string) => {
    const rows = att.filter((a) => a.employee_id === id);
    return {
      allShifts: rows.length,
      monthShifts: rows.filter((a) => a.attendance_date.startsWith(month)).length,
      places: new Set(rows.map((r) => r.company_id)).size,
    };
  };
  const coById = (id: string) => companies.find((c) => c.id === id);

  const jumpTo = (companyId: string) => {
    setAuto(false);
    setLookOpen(false);
    setTimeout(() => document.getElementById(`star-${companyId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle>Company Stars</CardTitle>
          <p className="text-sm text-muted-foreground">Each company is a hub; its branches are the employees who last worked there, with that date. Archived companies are greyed out.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAuto((v) => !v)}>
            {auto ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Auto-scroll</>}
          </Button>
          <Button size="sm" onClick={() => { setLookOpen(true); setPicked(null); }}>
            <Search className="h-4 w-4 mr-1" /> Look up
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : (
          <>
          <div className="mb-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Bell className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">Latest Updates</p>
              <span className="text-xs text-muted-foreground">guards moved or added to a location</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y">
              {updates.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-3">No updates yet.</p>
              ) : updates.map((u, i) => {
                const e = employees.find((x) => x.id === u.employee_id);
                const to = coById(u.to); const from = u.from ? coById(u.from) : undefined;
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Badge variant={u.from ? "default" : "secondary"} className="shrink-0">{u.from ? "Moved" : "Added"}</Badge>
                    <span className="min-w-0 flex-1">
                      <b>{e?.full_name || "Unknown"}</b>
                      {u.from ? <> moved from <span className="text-muted-foreground">{from ? coLabel(from) : "—"}</span> <ArrowRight className="inline h-3 w-3" /> <b>{to ? coLabel(to) : "—"}</b></>
                        : <> added to <b>{to ? coLabel(to) : "—"}</b></>}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmtDate(u.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div ref={scrollRef} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className="overflow-y-auto rounded-lg border bg-muted/20 p-4" style={{ height: 640 }}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map((c) => (
                <div key={c.id} id={`star-${c.id}`}
                  className={`rounded-xl border bg-card p-3 transition ${c.archived ? "opacity-50 grayscale" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.company_name}</p>
                      {c.location && <p className="text-xs text-muted-foreground truncate">{c.location}</p>}
                    </div>
                    {c.archived && <Badge variant="secondary">Archived</Badge>}
                  </div>
                  <Star c={c} emps={byCo.get(c.id) || []} />
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { setPicked({ type: "co", id: c.id }); setLookOpen(true); }}>
                    View analytics
                  </Button>
                </div>
              ))}
            </div>
          </div>
          </>
        )}
      </CardContent>

      <Dialog open={lookOpen} onOpenChange={setLookOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Look up</DialogTitle>
            <DialogDescription>Search a company or an employee to see their details.</DialogDescription>
          </DialogHeader>
          <Input autoFocus placeholder="Type a company or employee name..." value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} />

          {!picked && q.trim() && (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {results.cos.map((c) => (
                <button key={c.id} onClick={() => setPicked({ type: "co", id: c.id })}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                  <Building2 className="h-4 w-4 text-primary" /> <span className="truncate">{coLabel(c)}</span>
                  {c.archived && <Badge variant="secondary" className="ml-auto">Archived</Badge>}
                </button>
              ))}
              {results.emps.map((e) => (
                <button key={e.id} onClick={() => setPicked({ type: "emp", id: e.id })}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                  <User className="h-4 w-4 text-accent" /> <span className="truncate">{e.full_name}{e.employee_id ? ` (${e.employee_id})` : ""}</span>
                </button>
              ))}
              {!results.cos.length && !results.emps.length && <p className="text-sm text-muted-foreground py-2">Nothing found.</p>}
            </div>
          )}

          {picked?.type === "co" && (() => {
            const c = coById(picked.id); if (!c) return null;
            const s = coStats(c.id); const here = byCo.get(c.id) || [];
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2"><p className="font-semibold">{coLabel(c)}</p>{c.archived && <Badge variant="secondary">Archived</Badge>}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Shifts this month", s.monthShifts], ["Employees this month", s.monthPeople],
                    ["Shifts all time", s.allShifts], ["Employees ever", s.everPeople],
                    ["Last worked here now", here.length], ["Last activity", s.lastDate ? fmtDate(s.lastDate) : "—"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold">{v}</p></div>
                  ))}
                </div>
                {here.length > 0 && (
                  <div className="max-h-40 overflow-y-auto text-sm border rounded-md divide-y">
                    {here.map(({ e, date }) => (
                      <div key={e.id} className="flex justify-between px-2 py-1"><span>{e.full_name}</span><span className="text-muted-foreground">{fmtDate(date)}</span></div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => jumpTo(c.id)}>Show on the board</Button>
              </div>
            );
          })()}

          {picked?.type === "emp" && (() => {
            const e = employees.find((x) => x.id === picked.id); if (!e) return null;
            const l = last.get(e.id); const c = l ? coById(l.company_id) : undefined; const s = empStats(e.id);
            return (
              <div className="space-y-3">
                <p className="font-semibold">{e.full_name}{e.employee_id ? ` (${e.employee_id})` : ""}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Last worked at", c ? coLabel(c) : "Never worked"], ["Last worked on", l ? fmtDate(l.date) : "—"],
                    ["Shifts this month", s.monthShifts], ["Shifts all time", s.allShifts],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold break-words">{v}</p></div>
                  ))}
                </div>
                {c && <Button variant="outline" className="w-full" onClick={() => jumpTo(c.id)}>Show on the board</Button>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
