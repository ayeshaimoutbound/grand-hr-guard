import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function Salaries() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground">Calculate and manage employee salaries</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Salary Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Salary module coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
