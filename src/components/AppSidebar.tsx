import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  DollarSign,
  Shield,
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "super_admin"] },
  { title: "Employees", url: "/employees", icon: Users, roles: ["admin", "super_admin"] },
  { title: "Companies", url: "/companies", icon: Building2, roles: ["admin", "super_admin"] },
  { title: "Attendance", url: "/attendance", icon: Calendar, roles: ["admin", "super_admin"] },
  { title: "Salaries", url: "/salaries", icon: DollarSign, roles: ["admin", "super_admin"] },
  { title: "User Management", url: "/users", icon: Shield, roles: ["super_admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { role, signOut } = useAuth();
  const isCollapsed = state === "collapsed";

  const filteredItems = menuItems.filter((item) =>
    role && item.roles.includes(role)
  );

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center">
              <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">Grand Senaro</p>
              <p className="text-xs text-sidebar-foreground/60">HR System</p>
            </div>
          </div>
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
