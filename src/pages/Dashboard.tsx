import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCompanies: 0,
    monthlyShifts: 0,
    totalSalary: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesRes, companiesRes, attendanceRes, salariesRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .gte("attendance_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .eq("present", true),
        supabase
          .from("salaries")
          .select("final_salary")
          .gte("salary_month", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const totalSalary = salariesRes.data?.reduce((sum, s) => sum + (Number(s.final_salary) || 0), 0) || 0;

      setStats({
        totalEmployees: employeesRes.count || 0,
        totalCompanies: companiesRes.count || 0,
        monthlyShifts: attendanceRes.count || 0,
        totalSalary: totalSalary,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Employees",
      value: stats.totalEmployees,
      icon: Users,
      gradient: "from-primary to-primary-hover",
    },
    {
      title: "Total Companies",
      value: stats.totalCompanies,
      icon: Building2,
      gradient: "from-secondary to-secondary-hover",
    },
    {
      title: "Shifts This Month",
      value: stats.monthlyShifts,
      icon: Calendar,
      gradient: "from-accent to-accent",
    },
    {
      title: "Total Salary Processed",
      value: `Rs. ${stats.totalSalary.toLocaleString()}`,
      icon: DollarSign,
      gradient: "from-primary to-secondary",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your HR management system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Welcome to Grand Senaro HR System</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Use the sidebar to navigate through different modules. Manage employees, companies,
            track attendance, and process salaries all in one place.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
