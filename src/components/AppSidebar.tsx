import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Wallet,
  Package,
  Utensils,
  HandCoins,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard", roles: ["admin", "super_admin"] },
  { title: "Employees", url: "/employees", icon: Users, key: "employees", roles: ["admin", "super_admin", "office"] },
  { title: "Companies", url: "/companies", icon: Building2, key: "companies", roles: ["admin", "super_admin"] },
  { title: "Attendance", url: "/attendance", icon: Calendar, key: "attendance", roles: ["admin", "super_admin", "office"] },
  { title: "Salaries", url: "/salaries", icon: DollarSign, key: "salaries", roles: ["admin", "super_admin", "office"] },
  { title: "Advances", url: "/advances", icon: HandCoins, key: "advances", roles: ["admin", "super_admin", "office"] },
  { title: "Invoices", url: "/invoices", icon: FileText, key: "invoices", roles: ["admin", "super_admin"] },
  { title: "Accounts", url: "/accounts", icon: Wallet, key: "accounts", roles: ["admin", "super_admin"] },
  { title: "Inventory", url: "/inventory", icon: Package, key: "inventory", roles: ["admin", "super_admin", "office"] },
  { title: "Food", url: "/food", icon: Utensils, key: "food", roles: ["admin", "super_admin", "office"] },
  { title: "Vendors", url: "/vendors", icon: Store, key: "vendors", roles: ["admin", "super_admin", "office"] },
  { title: "Maintenance", url: "/maintenance", icon: Wrench, key: "maintenance", roles: ["admin", "super_admin", "office"] },
  { title: "Settings", url: "/settings", icon: SettingsIcon, key: "settings", roles: ["super_admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { role, signOut, moduleAccess } = useAuth();
  const isCollapsed = state === "collapsed";

  const filteredItems = menuItems.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    // per-user override: if explicitly disabled, hide
    if (moduleAccess && moduleAccess[item.key] === false) return false;
    return true;
  });

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Grand Senaro Security" className="w-10 h-10 object-contain drop-shadow" />
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">Grand Senaro</p>
              <p className="text-xs text-sidebar-foreground/60">HR System</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <img src="/logo.png" alt="GSS" className="w-8 h-8 object-contain mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
