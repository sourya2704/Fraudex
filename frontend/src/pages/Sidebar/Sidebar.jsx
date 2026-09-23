import {
  BarChart3,
  FileText,
  FileUp,
  LogOut,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Upload Invoice", icon: FileUp, href: "/dashboard/upload-invoice" },
  { label: "Invoices", icon: FileText },
  { label: "Fraud Detection", icon: ShieldAlert },
  { label: "Analytics", icon: BarChart3 },
];

function Sidebar({ expanded = true }) {
  const location = useLocation();

  return (
    <aside
      className={`sticky top-0 flex h-screen max-h-screen shrink-0 flex-col overflow-hidden border-r border-slate-900 bg-[#121629] px-3 py-6 text-slate-300 transition-[width] duration-200 ${expanded ? "w-52" : "w-20 hover:z-10 hover:w-64 hover:px-4"}`}
    >
      <div
        className={`flex items-center gap-3 px-2 ${expanded ? "justify-start" : "justify-center transition-[justify-content] group-hover:justify-start"}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-950/50">
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
                className={`mx-auto flex h-12 items-center rounded-lg px-3 text-sm font-medium transition-[width,gap,background-color,color,box-shadow] duration-200 ease-out ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"} ${
                  active
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-950/20"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
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

      <div className="mt-auto border-t border-slate-800 pt-5">
        <a
          className={`mx-auto flex h-12 items-center rounded-lg px-3 text-sm font-medium text-slate-400 transition-[width,gap,background-color,color] duration-200 ease-out hover:bg-slate-800/70 hover:text-slate-100 ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"}`}
          href="#settings"
          title="Settings"
        >
          <Settings size={19} strokeWidth={1.8} />
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100"}`}
          >
            Settings
          </span>
        </a>
        <button
          className={`mx-auto mt-2 flex h-12 items-center rounded-lg px-3 text-left text-sm font-medium text-slate-400 transition-[width,gap,background-color,color] duration-200 ease-out hover:bg-slate-800/70 hover:text-slate-100 ${expanded ? "w-full justify-start gap-3" : "w-14 justify-center gap-0 group-hover:w-full group-hover:justify-start group-hover:gap-3"}`}
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
