import {
  Activity,
  BarChart3,
  FileText,
  FileUp,
  LogOut,
  LayoutDashboard,
  Moon,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard",       icon: LayoutDashboard, href: "/dashboard" },
  { label: "Upload Invoice",  icon: FileUp,           href: "/dashboard/upload-invoice" },
  { label: "Invoices",        icon: FileText,         href: "/dashboard/invoices" },
  { label: "Fraud Detection", icon: ShieldAlert,      href: "/dashboard/fraud-detection" },
  { label: "Analytics",       icon: BarChart3,        href: "/dashboard/analytics" },
  { label: "Audit Log",       icon: Activity,         href: "/dashboard/audit" },
  { label: "Settings",        icon: Settings,         href: "/dashboard/settings" },
];

function Sidebar({ expanded = true }) {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("fraudex-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("fraudex-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <aside
      className={`sticky top-0 flex h-screen max-h-screen shrink-0 flex-col overflow-hidden border-r border-[#2d3559] bg-[#11162a] px-3 py-6 text-slate-300 shadow-[12px_0_40px_rgba(0,0,0,0.14)] transition-[width] duration-200 ${expanded ? "w-56" : "w-20 hover:z-10 hover:w-64 hover:px-4"}`}
    >
      <div
        className={`flex items-center gap-3 px-2 ${expanded ? "justify-start" : "justify-center transition-[justify-content] group-hover:justify-start"}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c7f36b] text-[#151a31] shadow-[0_0_24px_rgba(199,243,107,0.22)]">
          <ShieldCheck size={20} strokeWidth={2.1} />
        </span>
        <div
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100"}`}
        >
          <strong className="block text-lg font-bold tracking-tight text-white">
            Fraudex
          </strong>
        </div>
      </div>

      <nav className="mt-12" aria-label="Dashboard navigation">
        <div className="space-y-2">
          {navigationItems.map(({ label, icon: Icon, href }) => {
            const active = location.pathname === href;

            return (
              <Link
                className={`mx-auto flex h-12 items-center rounded-lg px-3 text-sm font-medium transition-[width,gap,background-color,color,box-shadow] duration-200 ease-out ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"} ${active
                    ? "bg-[#5967f2] text-white shadow-[0_0_24px_rgba(89,103,242,0.32)]"
                    : "text-slate-400 hover:bg-[#222846] hover:text-white"
                  }`}
                to={href}
                key={label}
                title={label}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100"}`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-[#2a304d] pt-5">
        <button
          className={`mx-auto flex h-12 items-center rounded-lg px-3 text-left text-sm font-medium text-slate-400 transition-[width,gap,background-color,color] duration-200 ease-out hover:bg-[#222846] hover:text-white ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"}`}
          onClick={() => setDarkMode((current) => !current)}
          type="button"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}
          <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100"}`}>
            {darkMode ? "Light mode" : "Dark mode"}
          </span>
        </button>
        <button
          className={`mx-auto mt-2 flex h-12 items-center rounded-lg px-3 text-left text-sm font-medium text-slate-400 transition-[width,gap,background-color,color] duration-200 ease-out hover:bg-[#222846] hover:text-white ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"}`}
          type="button"
          title="Logout"
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100"}`}
          >
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
