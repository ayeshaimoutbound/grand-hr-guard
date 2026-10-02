import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Shift a YYYY-MM month string by n months. */
export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function MonthNav({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" title="Previous month" onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input type="month" className="w-44" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      <Button variant="outline" size="icon" title="Next month" onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
