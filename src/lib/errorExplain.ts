import { toast } from "sonner";

// Turns raw technical errors into a plain explanation + what to do next.
const RULES: { test: RegExp; explain: string }[] = [
  { test: /DOUBLE_BOOKING|already on the .* shift/i, explain: "One person can't work in two places on the same shift. Remove the other entry first, or pick a different shift." },
  { test: /employees_employee_id_key/i, explain: "That Employee No is already used by someone else. Use a different number or leave it blank." },
  { test: /duplicate key|unique constraint|already exists/i, explain: "A record with the same details already exists. Edit the existing one instead of adding it again." },
  { test: /row-level security|permission denied|not authorized|violates row/i, explain: "Your account isn't allowed to do this. Ask a Super Admin to give you access." },
  { test: /foreign key/i, explain: "This record is linked to other data (e.g. attendance, invoices or salaries). Remove or change those first." },
  { test: /check constraint/i, explain: "One of the values isn't in an accepted format. Check the fields you filled in and try again." },
  { test: /not-null|null value/i, explain: "A required field is empty. Fill in all required fields and try again." },
  { test: /invalid input syntax|invalid.*(date|number|uuid)/i, explain: "A value was typed in the wrong format, like letters in a number field or an invalid date." },
  { test: /failed to fetch|network|timeout/i, explain: "The connection dropped. Check your internet and try again." },
  { test: /invalid login|invalid username|invalid credentials/i, explain: "The username or password doesn't match. Check for typos or caps lock." },
  { test: /pop-?ups? blocked/i, explain: "Your browser stopped the download window. Allow pop-ups for this site and try again." },
  { test: /no .* (found|data)|select at least|please select/i, explain: "There's nothing to work with yet. Make the selection or add data first." },
  { test: /parse|xlsx|file/i, explain: "The file couldn't be read. Make sure it's a .xlsx file using the downloadable template." },
];

export function explainError(msg: unknown): string {
  const text = String(msg ?? "");
  const hit = RULES.find((r) => r.test.test(text));
  return hit?.explain ?? "Something went wrong. Try again; if it keeps happening, note what you were doing and contact your admin.";
}

/** Adds a plain-language explanation under every error toast in the app. */
export function installErrorExplanations() {
  const original = toast.error;
  (toast as any).error = (message: any, opts: any = {}) =>
    original(message, { description: opts.description ?? explainError(message), ...opts });
}
