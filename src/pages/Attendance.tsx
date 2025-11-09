import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function Attendance() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Track employee attendance and shifts</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Attendance module coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
