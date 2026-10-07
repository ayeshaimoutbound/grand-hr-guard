import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, Upload, FolderSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyCombobox } from "@/components/CompanyCombobox";
import { EmployeeCombobox } from "@/components/EmployeeCombobox";

const db = supabase as any;
const BUCKET = "documents";
const COMPANY_CATS = ["Quotation", "Proposal", "Contract", "Increment", "Other"];
const GENERAL_CATS = ["Quotation", "Company registration", "Policy", "Letter", "Certificate", "Agreement", "Other"];
const EMPLOYEE_CATS: string[] = []; // employee files are kept together, no type needed

async function uploadFile(folder: string, file: File) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${folder}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) { toast.error("Could not open file: " + (error?.message || "file not found")); return; }
  window.open(data.signedUrl, "_blank");
}

export default function Documents() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canDelete = isAdmin || isSuperAdmin;
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  const load = async () => {
    const [c, e, d, k] = await Promise.all([
      supabase.from("companies").select("*").order("company_name"),
      supabase.from("employees").select("id, employee_id, full_name").order("full_name"),
      db.from("documents").select("*").order("created_at", { ascending: false }),
      db.from("employee_complaints").select("*").order("complaint_at", { ascending: false }),
    ]);
    setCompanies(c.data || []); setEmployees(e.data || []); setDocs(d.data || []); setComplaints(k.data || []);
  };
  useEffect(() => { load(); }, []);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.company_name || "—";
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.full_name || "—";

  const removeDoc = async (d: any) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    await supabase.storage.from(BUCKET).remove([d.file_path]);
    const { error } = await db.from("documents").delete().eq("id", d.id);
    if (error) { toast.error("Could not delete document: " + error.message); return; }
    toast.success("Document deleted"); load();
  };
  const removeComplaint = async (c: any) => {
    if (!confirm(`Delete complaint "${c.title}"?`)) return;
    if (c.proof_path) await supabase.storage.from(BUCKET).remove([c.proof_path]);
    const { error } = await db.from("employee_complaints").delete().eq("id", c.id);
    if (error) { toast.error("Could not delete complaint: " + error.message); return; }
    toast.success("Complaint deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Files</h1>
        <p className="text-muted-foreground">Upload and store our own company files and quotations, client company files, employee files and complaints.</p>
      </div>
      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">Our files &amp; quotations</TabsTrigger>
          <TabsTrigger value="company">Client company files</TabsTrigger>
          <TabsTrigger value="employee">Employee files</TabsTrigger>
          <TabsTrigger value="complaints">Complaints &amp; investigations</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <DocSection kind="general" categories={GENERAL_CATS} companies={companies} employees={employees}
            docs={docs.filter((d) => d.entity_type === "general")} ownerName={(d) => (d.company_id ? companyName(d.company_id) : "Grand Senaro Security")}
            onSaved={load} onDelete={canDelete ? removeDoc : undefined} />
        </TabsContent>
        <TabsContent value="company">
          <DocSection kind="company" categories={COMPANY_CATS} companies={companies} employees={employees}
            docs={docs.filter((d) => d.entity_type === "company")} ownerName={(d) => companyName(d.company_id)}
            onSaved={load} onDelete={canDelete ? removeDoc : undefined} />
        </TabsContent>
        <TabsContent value="employee">
          <DocSection kind="employee" categories={EMPLOYEE_CATS} companies={companies} employees={employees}
            docs={docs.filter((d) => d.entity_type === "employee")} ownerName={(d) => employeeName(d.employee_id)}
            onSaved={load} onDelete={canDelete ? removeDoc : undefined} />
        </TabsContent>
        <TabsContent value="complaints">
          <ComplaintSection employees={employees} companies={companies} complaints={complaints} employeeName={employeeName} companyName={companyName}
            onSaved={load} onDelete={canDelete ? removeComplaint : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocSection({ kind, categories, companies, employees, docs, ownerName, onSaved, onDelete }: {
  kind: "company" | "employee" | "general"; categories: string[]; companies: any[]; employees: any[]; docs: any[];
  ownerName: (d: any) => string; onSaved: () => void; onDelete?: (d: any) => void;
}) {
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState(categories[0] || "File");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const save = async () => {
    if (!owner && kind !== "general") { toast.error(`Please select ${kind === "company" ? "a company" : "an employee"}`); return; }
    if (!files.length) { toast.error("Please select at least one file to upload"); return; }
    setSaving(true);
    try {
      for (const file of files) {
        const path = await uploadFile(`${kind}/${owner || "gss"}`, file);
        const { error } = await db.from("documents").insert({
          entity_type: kind, company_id: kind !== "employee" ? owner || null : null, employee_id: kind === "employee" ? owner : null,
          category, title: (files.length === 1 && title) ? title : (title ? `${title} — ${file.name}` : file.name),
          file_path: path, file_name: file.name, notes: notes || null,
        });
        if (error) throw error;
      }
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
      setTitle(""); setNotes(""); setFiles([]); setInputKey((k) => k + 1); onSaved();
    } catch (e: any) {
      toast.error("Upload failed: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? docs.filter((d) => `${d.title} ${d.category} ${ownerName(d)}`.toLowerCase().includes(q)) : docs;
  }, [docs, search, ownerName]);

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>{kind === "general" ? "Our company files & quotations" : kind === "company" ? "Client company documents" : "Employee documents"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{kind === "general" ? "Related client (optional — e.g. who a quotation is for)" : kind === "company" ? "Company" : "Employee"}</Label>
            {kind !== "employee"
              ? <CompanyCombobox value={owner} onChange={setOwner} companies={companies} placeholder="Select company" />
              : <EmployeeCombobox value={owner} onChange={setOwner} employees={employees} />}
          </div>
          {categories.length > 0 && <div className="space-y-1">
            <Label>Type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>}
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to file name" /></div>
          <div className="space-y-1"><Label>Files (you can pick several at once)</Label><Input key={inputKey} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <Button onClick={save} disabled={saving}><Upload className="h-4 w-4 mr-1" />{saving ? "Uploading..." : "Upload"}</Button>

        <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Table>
          <TableHeader><TableRow>
            <TableHead>{kind === "general" ? "For" : kind === "company" ? "Company" : "Employee"}</TableHead>{categories.length > 0 && <TableHead>Type</TableHead>}
            <TableHead>Title</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No files yet</TableCell></TableRow>
            ) : visible.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{ownerName(d)}</TableCell>
                {categories.length > 0 && <TableCell>{d.category}</TableCell>}
                <TableCell><div className="font-medium">{d.title}</div>{d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}</TableCell>
                <TableCell>{new Date(d.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Open" onClick={() => openFile(d.file_path)}><Download className="h-4 w-4" /></Button>
                  {onDelete && <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ComplaintSection({ employees, companies, complaints, employeeName, companyName, onSaved, onDelete }: {
  employees: any[]; companies: any[]; complaints: any[]; employeeName: (id: string) => string; companyName: (id: string) => string;
  onSaved: () => void; onDelete?: (c: any) => void;
}) {
  const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [about, setAbout] = useState<"employee" | "company">("employee");
  const [owner, setOwner] = useState("");
  const [when, setWhen] = useState(nowLocal());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const subject = (c: any) => (c.company_id ? companyName(c.company_id) : employeeName(c.employee_id));

  const save = async () => {
    if (!owner) { toast.error(`Please select ${about === "employee" ? "an employee" : "a company"}`); return; }
    if (!title.trim()) { toast.error("Please enter a short title for the complaint (required field is empty)"); return; }
    setSaving(true);
    try {
      let proof_path: string | null = null, proof_name: string | null = null;
      if (files[0]) { proof_path = await uploadFile(`complaints/${owner}`, files[0]); proof_name = files[0].name; }
      const { data, error } = await db.from("employee_complaints").insert({
        employee_id: about === "employee" ? owner : null, company_id: about === "company" ? owner : null,
        complaint_at: new Date(when).toISOString(), title: title.trim(),
        description: description || null, proof_path, proof_name, status: "ongoing",
      }).select("id").single();
      if (error) throw error;
      for (const f of files.slice(1)) {
        const p = await uploadFile(`complaints/${owner}`, f);
        await db.from("complaint_updates").insert({ complaint_id: data.id, file_path: p, file_name: f.name });
      }
      toast.success("Complaint recorded — investigation is ongoing");
      setTitle(""); setDescription(""); setFiles([]); setWhen(nowLocal()); setInputKey((k) => k + 1); setOwner(""); onSaved();
    } catch (e: any) {
      toast.error("Could not save complaint: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  const visible = complaints.filter((c) => {
    if (statusFilter !== "all" && (c.status || "ongoing") !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || `${c.title} ${c.description || ""} ${subject(c)}`.toLowerCase().includes(q);
  });

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Complaints &amp; investigations</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Complaint about</Label>
            <Select value={about} onValueChange={(v: any) => { setAbout(v); setOwner(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="employee">An employee</SelectItem><SelectItem value="company">A company</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{about === "employee" ? "Employee" : "Company"}</Label>
            {about === "employee"
              ? <EmployeeCombobox value={owner} onChange={setOwner} employees={employees} />
              : <CompanyCombobox value={owner} onChange={setOwner} companies={companies} placeholder="Select company" />}
          </div>
          <div className="space-y-1"><Label>Date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Late for duty" /></div>
          <div className="space-y-1 md:col-span-2"><Label>Details</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Proof files (optional, several allowed)</Label><Input key={inputKey} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add complaint"}</Button>

        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Search complaints..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead><TableHead>About</TableHead><TableHead>Complaint</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No complaints</TableCell></TableRow>
            ) : visible.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{new Date(c.complaint_at).toLocaleString()}</TableCell>
                <TableCell><div>{subject(c)}</div><div className="text-xs text-muted-foreground">{c.company_id ? "Company" : "Employee"}</div></TableCell>
                <TableCell><div className="font-medium">{c.title}</div>{c.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">{c.description}</div>}</TableCell>
                <TableCell><Badge variant={(c.status || "ongoing") === "closed" ? "secondary" : "default"}>{(c.status || "ongoing") === "closed" ? "Closed" : "Ongoing"}</Badge></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => setOpenId(c.id)}><FolderSearch className="h-4 w-4 mr-1" />Investigation</Button>
                  {onDelete && <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <InvestigationDialog complaint={complaints.find((c) => c.id === openId) || null} subject={subject}
        onClose={() => setOpenId(null)} onChanged={onSaved} />
    </Card>
  );
}

function InvestigationDialog({ complaint, subject, onClose, onChanged }: {
  complaint: any | null; subject: (c: any) => string; onClose: () => void; onChanged: () => void;
}) {
  const [updates, setUpdates] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const load = async () => {
    if (!complaint) return;
    const { data } = await db.from("complaint_updates").select("*").eq("complaint_id", complaint.id).order("created_at", { ascending: false });
    setUpdates(data || []);
  };
  useEffect(() => { load(); setNote(""); setFiles([]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [complaint?.id]);

  const addUpdate = async () => {
    if (!note.trim() && !files.length) { toast.error("Write a note or choose a file to add"); return; }
    setBusy(true);
    try {
      if (!files.length) {
        const { error } = await db.from("complaint_updates").insert({ complaint_id: complaint.id, note: note.trim() });
        if (error) throw error;
      } else {
        for (const [i, f] of files.entries()) {
          const p = await uploadFile(`complaints/${complaint.employee_id || complaint.company_id}`, f);
          const { error } = await db.from("complaint_updates").insert({ complaint_id: complaint.id, note: i === 0 ? note.trim() || null : null, file_path: p, file_name: f.name });
          if (error) throw error;
        }
      }
      toast.success("Update added");
      setNote(""); setFiles([]); setInputKey((k) => k + 1); load();
    } catch (e: any) {
      toast.error("Could not add update: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const setStatus = async (status: string) => {
    const { error } = await db.from("employee_complaints").update({ status, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", complaint.id);
    if (error) { toast.error("Could not change status: " + error.message); return; }
    await db.from("complaint_updates").insert({ complaint_id: complaint.id, note: status === "closed" ? "Investigation closed" : "Investigation re-opened" });
    toast.success(status === "closed" ? "Investigation closed" : "Investigation re-opened");
    onChanged(); load();
  };

  const status = complaint?.status || "ongoing";
  return (
    <Dialog open={!!complaint} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {complaint && <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{complaint.title}
              <Badge variant={status === "closed" ? "secondary" : "default"}>{status === "closed" ? "Closed" : "Ongoing"}</Badge>
            </DialogTitle>
            <DialogDescription>{subject(complaint)} · {new Date(complaint.complaint_at).toLocaleString()}</DialogDescription>
          </DialogHeader>
          {complaint.description && <p className="text-sm whitespace-pre-wrap rounded-md border p-3">{complaint.description}</p>}
          {complaint.proof_path && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => openFile(complaint.proof_path)}>
              <Download className="h-4 w-4 mr-1" />{complaint.proof_name || "Original proof"}
            </Button>
          )}
          <div className="flex gap-2">
            {status === "closed"
              ? <Button variant="outline" onClick={() => setStatus("ongoing")}>Re-open investigation</Button>
              : <Button variant="secondary" onClick={() => setStatus("closed")}>Close investigation</Button>}
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label>Add a note or files</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was found, who was spoken to, next steps..." />
            <Input key={inputKey} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <Button onClick={addUpdate} disabled={busy}>{busy ? "Saving..." : "Add update"}</Button>
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">History</p>
            {updates.length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : updates.map((u) => (
              <div key={u.id} className="rounded-md border p-2 text-sm">
                <div className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</div>
                {u.note && <div className="whitespace-pre-wrap">{u.note}</div>}
                {u.file_path && (
                  <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => openFile(u.file_path)}>
                    <Download className="h-3.5 w-3.5 mr-1" />{u.file_name || "File"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
