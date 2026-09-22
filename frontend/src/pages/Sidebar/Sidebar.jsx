import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

const navigationItems = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Invoices", icon: FileText },
  { label: "Vendors", icon: Users },
  { label: "Alerts", icon: Bell, badge: "3" },
];

function Sidebar() {
  return (
    <aside className="flex min-h-screen w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 px-5 py-6 text-slate-300">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40">
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
        <div>
          <strong className="block text-base tracking-tight text-white">Fraudex</strong>
          <span className="text-[11px] text-slate-500">Risk intelligence</span>
        </div>
      </div>

      <nav className="mt-12" aria-label="Dashboard navigation">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Workspace
        </p>
        <div className="mt-3 space-y-1">
          {navigationItems.map(({ label, icon: Icon, active, badge }) => (
            <a
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              }`}
              href={`#${label.toLowerCase()}`}
              key={label}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-300">
                  {badge}
                </span>
              )}
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-auto space-y-1">
        <a
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
          href="#settings"
        >
          <Settings size={18} strokeWidth={1.8} />
          Settings
        </a>
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
          type="button"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Sign out
        </button>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-800 px-3 pt-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
            JD
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">Jordan Davis</p>
            <p className="truncate text-xs text-slate-500">Finance admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;