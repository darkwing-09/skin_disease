import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Microscope,
  ShieldCheck,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/scan", label: "New Scan", icon: Microscope },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden md:flex flex-col border-r border-border-subtle bg-surface h-dvh sticky top-0"
    >
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        {!collapsed && (
          <span className="font-sora font-bold text-text-primary text-sm">
            🏥 DermAI
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
          className="p-1.5 rounded hover:bg-surface-hover text-text-secondary min-w-[32px] min-h-[32px]"
        >
          <ChevronLeft
            size={16}
            className={collapsed ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors min-h-[44px] ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`
            }
          >
            <item.icon size={18} />
            {!collapsed && item.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors min-h-[44px] ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`
            }
          >
            <ShieldCheck size={18} />
            {!collapsed && "Admin"}
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t border-border-subtle">
        {!collapsed && (
          <div className="px-3 mb-2">
            <p className="text-sm text-text-primary font-medium truncate">
              {user?.username}
            </p>
            <span className="text-xs text-text-tertiary capitalize">
              {user?.role}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-text-secondary hover:bg-danger-critical/10 hover:text-danger-critical transition-colors w-full min-h-[44px]"
        >
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </motion.aside>
  );
}
