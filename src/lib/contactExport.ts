export interface PhoneContact {
  id: string;
  full_name: string;
  employee_id?: string | null;
  phone_number?: string | null;
  created_at?: string | null;
}

export function newestPhoneContacts<T extends PhoneContact>(employees: T[]): T[] {
  return employees.filter((e) => e.phone_number?.trim()).sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || "") || a.full_name.localeCompare(b.full_name));
}

export function selectedContactsVcf(employees: PhoneContact[], ids: Set<string>): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[;,]/g, (m) => "\\" + m);
  return newestPhoneContacts(employees).filter((e) => ids.has(e.id)).map((e) => [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${esc(`${e.full_name}${e.employee_id ? ` (${e.employee_id})` : ""} - GSS`)}`,
    `N:${esc(e.full_name)};;;;`, "ORG:Grand Senaro Security",
    `TEL;TYPE=CELL:${e.phone_number?.trim() || ""}`, "END:VCARD",
  ].join("\r\n")).join("\r\n");
}