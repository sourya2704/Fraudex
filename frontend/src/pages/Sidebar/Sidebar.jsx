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
  { label: "Alerts", icon: Bell },
];

function Sidebar() {
  return (
    <aside className="group flex min-h-screen w-20 shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-950 px-3 py-6 text-slate-300 transition-[width] duration-200 hover:z-10 hover:w-72 hover:px-5">
      <div className="flex items-center justify-center gap-3 px-2 transition-[justify-content] group-hover:justify-start">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-950/40">
          <ShieldCheck size={22} strokeWidth={2.2} />
        </span>
        <div className="w-0 min-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:w-auto group-hover:opacity-100">
          <strong className="block text-base tracking-tight text-white">Fraudex</strong>
          <span className="text-[11px] text-slate-500">Risk intelligence</span>
        </div>
      </div>

      <nav className="mt-12" aria-label="Dashboard navigation">
        <p className="h-0 overflow-hidden whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 opacity-0 transition-all group-hover:h-auto group-hover:opacity-100">
          Workspace
        </p>
        <div className="mt-3 space-y-1">
          {navigationItems.map(({ label, icon: Icon, active }) => (
            <a
              className={`flex items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors group-hover:justify-start ${
                active
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              }`}
              href={`#${label.toLowerCase()}`}
              key={label}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="w-0 min-w-0 flex-1 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:w-auto group-hover:opacity-100">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-auto space-y-1">
        <a
          className="flex items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100 group-hover:justify-start"
          href="#settings"
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:w-auto group-hover:opacity-100">Settings</span>
        </a>
        <button
          className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100 group-hover:justify-start"
          type="button"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:w-auto group-hover:opacity-100">Sign out</span>
        </button>
        <div className="mt-5 flex items-center justify-center gap-3 border-t border-slate-800 px-3 pt-5 group-hover:justify-start">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
            JD
          </span>
          <div className="w-0 min-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover:w-auto group-hover:opacity-100">
            <p className="truncate text-sm font-medium text-slate-200">Jordan Davis</p>
            <p className="truncate text-xs text-slate-500">Finance admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;