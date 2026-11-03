import { test } from "node:test";
import assert from "node:assert/strict";
import { newestPhoneContacts, selectedContactsVcf } from "./contactExport";
import { needsClientSelection } from "./documentRules";
import { canResetData, RESET_GROUPS } from "./resetGroups";
import { computePayroll } from "./salaryEngine";

test("own company details never require a client", () => {
  assert.equal(needsClientSelection("general", "Company registration"), false);
  assert.equal(needsClientSelection("general", "Policy"), false);
});
test("quotations and proposals allow a related company", () => {
  assert.equal(needsClientSelection("general", "Quotation"), true);
  assert.equal(needsClientSelection("general", "Proposal"), true);
});
const contacts = [
  { id: "old", full_name: "Older", phone_number: "0771234567", created_at: "2025-01-01" },
  { id: "new", full_name: "Newer", phone_number: "0777654321", created_at: "2026-11-02" },
  { id: "blank", full_name: "No phone", created_at: "2026-11-03" },
];
test("contact list is newest to oldest", () => {
  assert.deepEqual(newestPhoneContacts(contacts).map((e) => e.id), ["new", "old"]);
});
test("only chosen contacts are exported", () => {
  const vcf = selectedContactsVcf(contacts, new Set(["old"]));
  assert.equal(vcf.includes("0771234567"), true);
  assert.equal(vcf.includes("0777654321"), false);
  assert.equal(selectedContactsVcf(contacts, new Set()), "");
});
test("bulk employee clearing is super-admin only", () => {
  assert.equal(canResetData("super_admin"), true);
  for (const role of ["admin", "office", "viewer", null]) assert.equal(canResetData(role), false);
  assert.equal(RESET_GROUPS.some((g) => g.key === "employees"), true);
});
test("logged OT updates net salary once across employee locations", () => {
  const base = {
    employeeId: "guard", attendance: [{ employee_id: "guard", company_id: "a", rank: "SSO", present: true }],
    companies: [{ id: "a", company_name: "A", pay_oic: 0, pay_sso: 2000, pay_jso: 0, pay_lso: 0 }],
    cashAdvances: [], foodAdvances: [], uniformAdvances: [], settings: { ot_hourly_rate: 225, normal_ot_hours: 3, extended_ot_hours: 6 }, dailyMinWage: 1200,
  };
  const before = computePayroll({ ...base, overtime: [] });
  const after = computePayroll({ ...base, overtime: [{ employee_id: "guard", amount: 450 }, { employee_id: "guard", amount: 300 }, { employee_id: "someone-else", amount: 999 }] });
  assert.equal(after.ot_pay, 750);
  assert.equal(after.net_pay - before.net_pay, 750);
  const edited = computePayroll({ ...base, overtime: [{ employee_id: "guard", amount: 225 }] });
  assert.equal(edited.net_pay - before.net_pay, 225);
});