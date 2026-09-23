import {
  Bell,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  FileUp,
  Filter,
  Inbox,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar";

const metrics = [
  { label: "Invoices reviewed", icon: FileUp, tone: "indigo" },
  { label: "Risk flagged", icon: CircleAlert, tone: "rose" },
  { label: "Protected value", icon: ShieldCheck, tone: "emerald" },
  { label: "Avg. review time", icon: Clock3, tone: "amber" },
];

function MetricCard({ label, icon: Icon, tone }) {
  const toneStyles = {
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`grid h-9 w-9 place-items-center rounded-lg ${toneStyles[tone]}`}
        >
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-400">--</p>
      <p className="mt-2 text-xs text-slate-400">Waiting for backend data</p>
    </article>
  );
}

function Dashboard() {
  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Dashboard overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Your invoice and risk metrics will appear here after backend data is connected.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              title="Search"
              type="button"
            >
              <Search size={18} />
            </button>
            <button
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              title="Notifications"
              type="button"
            >
              <Bell size={18} />
            </button>
            <Link
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-500"
              to="/dashboard/upload-invoice"
            >
              <FileUp size={16} />
              Upload invoice
            </Link>
          </div>
        </header>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">Risk activity</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Awaiting data</span></div>
                <p className="mt-1 text-sm text-slate-500">Invoice and risk activity will appear here.</p>
              </div>
              <button className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400" disabled type="button">Last 30 days <span aria-hidden="true">⌄</span></button>
            </div>
            <div className="relative mt-7 h-56 overflow-hidden rounded-lg bg-slate-50/70">
              <div className="absolute inset-0 flex flex-col justify-between p-5"><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /><span className="border-t border-dashed border-slate-200" /></div>
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-300 shadow-sm"><ChartNoAxesCombined size={19} /></span><p className="mt-3 text-sm font-semibold text-slate-600">No activity to display</p><p className="mt-1 text-xs text-slate-400">Connect the backend to populate this graph.</p></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-900">Open alerts</h2><p className="mt-1 text-sm text-slate-500">Requiring your review</p></div><button className="text-xs font-semibold text-slate-400" disabled type="button">View all</button></div>
            <div className="flex min-h-52 flex-col items-center justify-center text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-300"><CircleAlert size={19} /></span><p className="mt-3 text-sm font-semibold text-slate-600">No open alerts</p><p className="mt-1 max-w-[210px] text-xs leading-5 text-slate-400">Alerts will appear after invoices are analyzed.</p></div>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-xs font-semibold text-slate-400" disabled type="button"><Filter size={14} />Review alert queue</button>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 sm:p-6"><div><h2 className="font-semibold text-slate-900">Recent invoices</h2><p className="mt-1 text-sm text-slate-500">Latest activity across your workspace</p></div><button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400" disabled type="button"><Filter size={14} />Filter</button></div>
          <div className="flex min-h-36 flex-col items-center justify-center text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-300"><Inbox size={19} /></span><p className="mt-3 text-sm font-semibold text-slate-600">No invoices yet</p><p className="mt-1 text-xs text-slate-400">Upload an invoice to start building your workspace.</p></div>
        </section>
      </section>
    </main>
  );
}

export default Dashboard;
