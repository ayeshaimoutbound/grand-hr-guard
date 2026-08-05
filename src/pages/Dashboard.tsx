import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building2, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LowStockItem {
  id: string;
  item_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  low_stock_threshold: number;
}

export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCompanies: 0,
    monthlyRevenue: 0,
    monthlySalary: 0,
  });

  const fetchLowStock = async () => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, item_name, size, color, quantity, low_stock_threshold, inventory_type")
      .eq("inventory_type", "critical");
    setLowStock(((data as any) || []).filter((i: any) => i.quantity < (i.low_stock_threshold ?? 3)));
  };

  useEffect(() => {
    fetchStats();
    fetchLowStock();


    // Set up real-time subscriptions for invoices and salaries
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        () => {
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salaries'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 7);
      
      const [employeesRes, companiesRes, invoicesRes, salariesRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase
          .from("invoices")
          .select("amount_to_collect")
          .gte("month_period", `${currentMonth}-01`)
          .lte("month_period", `${currentMonth}-31`),
        supabase
          .from("salaries")
          .select("gross_shift_total, final_salary")
          .gte("salary_month", `${currentMonth}-01`)
          .lte("salary_month", `${currentMonth}-31`),
      ]);

      const totalCharged = invoicesRes.data?.reduce((sum, inv) => sum + (Number(inv.amount_to_collect) || 0), 0) || 0;
      const totalPaidToEmployees = salariesRes.data?.reduce((sum, s) => sum + (Number(s.gross_shift_total) || 0), 0) || 0;
      const monthlySalary = salariesRes.data?.reduce((sum, s) => sum + (Number(s.final_salary) || 0), 0) || 0;
      const monthlyRevenue = totalCharged - totalPaidToEmployees;

      setStats({
        totalEmployees: employeesRes.count || 0,
        totalCompanies: companiesRes.count || 0,
        monthlyRevenue: monthlyRevenue,
        monthlySalary: monthlySalary,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching stats:", error);
      }
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
      title: "Total Monthly Revenue",
      value: `LKR ${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      gradient: "from-accent to-accent",
    },
    {
      title: "Total Monthly Salary",
      value: `LKR ${stats.monthlySalary.toLocaleString()}`,
      icon: Calendar,
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
        {statCards.map((stat, index) => {
          // Hide revenue metrics from regular admins for security
          if (stat.title === "Total Monthly Revenue" && !isSuperAdmin) {
            return null;
          }
          
          return (
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
          );
        })}
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
