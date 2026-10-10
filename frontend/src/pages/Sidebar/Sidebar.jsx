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
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoSvg from "../../assets/logo.svg";

const NAV = [
  { label: "Dashboard",       Icon: LayoutDashboard, href: "/dashboard" },
  { label: "Upload Invoice",  Icon: FileUp,           href: "/dashboard/upload-invoice" },
  { label: "Invoices",        Icon: FileText,         href: "/dashboard/invoices" },
  { label: "Fraud Detection", Icon: ShieldAlert,      href: "/dashboard/fraud-detection", badge: true },
  { label: "Analytics",       Icon: BarChart3,        href: "/dashboard/analytics" },
  { label: "Audit Log",       Icon: Activity,         href: "/dashboard/audit" },
  { label: "Settings",        Icon: Settings,         href: "/dashboard/settings" },
];

const ROLE_COLOR = {
  ADMIN:           "from-rose-500 to-pink-600",
  FINANCE_MANAGER: "from-violet-500 to-purple-600",
  EMPLOYEE:        "from-indigo-500 to-violet-600",
};
const ROLE_LABEL = {
  ADMIN: "Admin", FINANCE_MANAGER: "Finance Mgr", EMPLOYEE: "Employee",
};

export default function Sidebar({ expanded = true }) {
  const location         = useLocation();
  const { logout, user } = useAuth();
  const { avatar }       = useAvatar();
  const [dark, setDark]  = useState(() => localStorage.getItem("fraudex-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("fraudex-theme", dark ? "dark" : "light");
  }, [dark]);

  const initials = user?.name
    ? user.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const gradient = ROLE_COLOR[user?.role] || ROLE_COLOR.EMPLOYEE;

  function isActive(href) {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  }

  return (
    <aside
      style={{ background: "linear-gradient(180deg,#0f1219 0%,#0f1827 100%)" }}
      className={`
        sticky top-0 flex h-screen max-h-screen shrink-0 flex-col
        border-r border-white/[0.05] px-3 py-5 text-slate-300
        shadow-[6px_0_40px_rgba(0,0,0,0.4)]
        transition-[width] duration-200 ease-out
        ${expanded ? "w-60" : "w-[68px] hover:z-20 hover:w-60"}
      `}
    >
      <Link
        to="/dashboard"
        className={`flex items-center gap-3 px-2 ${expanded ? "justify-start" : "justify-center"}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c7f36b]/10 ring-1 ring-[#c7f36b]/40 shadow-[0_0_18px_rgba(199,243,107,0.18)]">
          <img src={logoSvg} alt="FrauDex logo" className="h-6 w-6" />
        </span>
        <div
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"}`}
        >
          <strong className="block text-lg font-bold tracking-tight text-white leading-none">
            Frau<span className="text-[#c7f36b]">Dex</span>
          </strong>
          <span className="text-[10px] font-medium tracking-widest text-slate-500 uppercase">
            Fraud Detection
          </span>
        </div>
      </Link>

      {/* ── Section label ─────────────────────────────────────────── */}
      <div className={`mt-7 mb-1.5 overflow-hidden whitespace-nowrap px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-700 transition-[max-width,opacity] duration-200 ${expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0"}`}>
        Main Menu
      </div>

      {/* ── Nav items ─────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5" aria-label="Sidebar navigation">
        {NAV.map(({ label, Icon, href, badge }) => {
          const active = isActive(href);
          return (
            <Link key={href} to={href} title={label}
              className={`
                relative flex h-[42px] items-center rounded-xl px-3 text-sm font-medium
                transition-all duration-150
                ${expanded ? "gap-3" : "justify-center gap-0"}
                ${active
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"}
              `}
            >
              <div className="relative shrink-0">
                <Icon size={18} strokeWidth={1.9} />
                {badge && !active && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-[#0f1219]" />
                )}
              </div>
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${expanded ? "max-w-36 opacity-100" : "max-w-0 opacity-0"}`}>
                {label}
              </span>
              {active && (
                <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-white/40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom ────────────────────────────────────────────────── */}
      <div className="mt-2 space-y-0.5 border-t border-white/[0.05] pt-4">

        {/* User card */}
        {user && (
          <div className={`mb-3 overflow-hidden rounded-xl transition-all duration-200 ${expanded ? "bg-white/[0.05] px-3 py-2.5" : "flex justify-center py-2"}`}>
            {expanded ? (
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="h-8 w-8 shrink-0 rounded-lg object-cover shadow" />
                ) : (
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-bold text-white shadow`}>
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{ROLE_LABEL[user.role] || user.role}</p>
                </div>
              </div>
            ) : (
              avatar ? (
                <img src={avatar} alt="avatar" className="h-8 w-8 rounded-lg object-cover shadow" />
              ) : (
                <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-bold text-white shadow`}>
                  {initials}
                </div>
              )
            )}
          </div>
        )}

        {/* Dark mode toggle */}
        <button type="button" title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(d => !d)}
          className={`flex h-[40px] w-full items-center rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200 ${expanded ? "gap-3" : "justify-center"}`}>
          {dark
            ? <Sun  size={17} strokeWidth={1.9} className="shrink-0" />
            : <Moon size={17} strokeWidth={1.9} className="shrink-0" />}
          <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${expanded ? "max-w-36 opacity-100" : "max-w-0 opacity-0"}`}>
            {dark ? "Light mode" : "Dark mode"}
          </span>
        </button>

        {/* Sign out */}
        <button type="button" title="Sign out" onClick={logout}
          className={`flex h-[40px] w-full items-center rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400 ${expanded ? "gap-3" : "justify-center"}`}>
          <LogOut size={17} strokeWidth={1.9} className="shrink-0" />
          <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${expanded ? "max-w-36 opacity-100" : "max-w-0 opacity-0"}`}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
