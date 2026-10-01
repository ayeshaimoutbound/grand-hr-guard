import EmployerContributionsTab from "@/components/accounts/EmployerContributionsTab";

export default function EpfEtf() {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-3xl font-bold">EPF &amp; ETF</h1>
        <p className="text-muted-foreground">How much the company pays into EPF and ETF each month, and for which employee.</p>
      </div>
      <EmployerContributionsTab />
    </div>
  );
}
