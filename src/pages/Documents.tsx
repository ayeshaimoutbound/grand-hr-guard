import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyCombobox } from "@/components/CompanyCombobox";
import { EmployeeCombobox } from "@/components/EmployeeCombobox";

const db = supabase as any;
const BUCKET = "documents";
const COMPANY_CATS = ["Quotation", "Proposal", "Contract", "Increment", "Other"];
const EMPLOYEE_CATS = ["NIC copy", "Certificate", "Police report", "Contract", "Other"];

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
        <h1 className="text-3xl font-bold">Documents &amp; Complaints</h1>
        <p className="text-muted-foreground">Company quotations, proposals, contracts and increments; employee files; complaints with proof.</p>
      </div>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company files</TabsTrigger>
          <TabsTrigger value="employee">Employee files</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

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
          <ComplaintSection employees={employees} complaints={complaints} employeeName={employeeName}
            onSaved={load} onDelete={canDelete ? removeComplaint : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocSection({ kind, categories, companies, employees, docs, ownerName, onSaved, onDelete }: {
  kind: "company" | "employee"; categories: string[]; companies: any[]; employees: any[]; docs: any[];
  ownerName: (d: any) => string; onSaved: () => void; onDelete?: (d: any) => void;
}) {
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const save = async () => {
    if (!owner) { toast.error(`Please select ${kind === "company" ? "a company" : "an employee"}`); return; }
    if (!file) { toast.error("Please select a file to upload"); return; }
    setSaving(true);
    try {
      const path = await uploadFile(`${kind}/${owner}`, file);
      const { error } = await db.from("documents").insert({
        entity_type: kind, company_id: kind === "company" ? owner : null, employee_id: kind === "employee" ? owner : null,
        category, title: title || file.name, file_path: path, file_name: file.name, notes: notes || null,
      });
      if (error) throw error;
      toast.success("File uploaded");
      setTitle(""); setNotes(""); setFile(null); setInputKey((k) => k + 1); onSaved();
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
      <CardHeader><CardTitle>{kind === "company" ? "Company documents" : "Employee documents"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{kind === "company" ? "Company" : "Employee"}</Label>
            {kind === "company"
              ? <CompanyCombobox value={owner} onChange={setOwner} companies={companies} placeholder="Select company" />
              : <EmployeeCombobox value={owner} onChange={setOwner} employees={employees} />}
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to file name" /></div>
          <div className="space-y-1"><Label>File</Label><Input key={inputKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <Button onClick={save} disabled={saving}><Upload className="h-4 w-4 mr-1" />{saving ? "Uploading..." : "Upload"}</Button>

        <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Table>
          <TableHeader><TableRow>
            <TableHead>{kind === "company" ? "Company" : "Employee"}</TableHead><TableHead>Type</TableHead>
            <TableHead>Title</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No files yet</TableCell></TableRow>
            ) : visible.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{ownerName(d)}</TableCell>
                <TableCell>{d.category}</TableCell>
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

function ComplaintSection({ employees, complaints, employeeName, onSaved, onDelete }: {
  employees: any[]; complaints: any[]; employeeName: (id: string) => string; onSaved: () => void; onDelete?: (c: any) => void;
}) {
  const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [employee, setEmployee] = useState("");
  const [when, setWhen] = useState(nowLocal());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const save = async () => {
    if (!employee) { toast.error("Please select an employee"); return; }
    if (!title.trim()) { toast.error("Please enter a short title for the complaint (required field is empty)"); return; }
    setSaving(true);
    try {
      let proof_path: string | null = null;
      if (file) proof_path = await uploadFile(`complaints/${employee}`, file);
      const { error } = await db.from("employee_complaints").insert({
        employee_id: employee, complaint_at: new Date(when).toISOString(), title: title.trim(),
        description: description || null, proof_path, proof_name: file?.name || null,
      });
      if (error) throw error;
      toast.success("Complaint recorded");
      setTitle(""); setDescription(""); setFile(null); setWhen(nowLocal()); setInputKey((k) => k + 1); onSaved();
    } catch (e: any) {
      toast.error("Could not save complaint: " + (e?.message || e));
    } finally { setSaving(false); }
  };

  const visible = filterEmp ? complaints.filter((c) => c.employee_id === filterEmp) : complaints;

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Employee complaints</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label>Employee</Label><EmployeeCombobox value={employee} onChange={setEmployee} employees={employees} /></div>
          <div className="space-y-1"><Label>Date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Late for duty" /></div>
          <div className="space-y-1 md:col-span-2"><Label>Details</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Proof document (optional)</Label><Input key={inputKey} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Add complaint"}</Button>

        <div className="max-w-sm space-y-1">
          <Label>Filter by employee</Label>
          <div className="flex gap-2">
            <div className="flex-1"><EmployeeCombobox value={filterEmp} onChange={setFilterEmp} employees={employees} /></div>
            {filterEmp && <Button variant="outline" onClick={() => setFilterEmp("")}>All</Button>}
          </div>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead><TableHead>Employee</TableHead><TableHead>Complaint</TableHead>
            <TableHead>Recorded</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No complaints</TableCell></TableRow>
            ) : visible.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{new Date(c.complaint_at).toLocaleString()}</TableCell>
                <TableCell>{employeeName(c.employee_id)}</TableCell>
                <TableCell><div className="font-medium">{c.title}</div>{c.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{c.description}</div>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {c.proof_path && <Button variant="ghost" size="icon" title="Open proof" onClick={() => openFile(c.proof_path)}><Download className="h-4 w-4" /></Button>}
                  {onDelete && <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
