import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CircleAlert,
  Clock3,
  FileUp,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../Sidebar/Sidebar";

const metrics = [
  { label: "Invoices reviewed", value: "2,481", change: "+12.8%", detail: "vs. last month", icon: FileUp, tone: "indigo", rising: true },
  { label: "Risk flagged", value: "34", change: "-8.4%", detail: "vs. last month", icon: CircleAlert, tone: "rose", rising: false },
  { label: "Protected value", value: "$184.6K", change: "+18.2%", detail: "vs. last month", icon: ShieldCheck, tone: "emerald", rising: true },
  { label: "Avg. review time", value: "4m 12s", change: "-16.5%", detail: "vs. last month", icon: Clock3, tone: "amber", rising: false },
];

function MetricCard({ label, value, change, detail, icon: Icon, tone, rising }) {
  const toneStyles = { indigo: "bg-indigo-50 text-indigo-600", rose: "bg-rose-50 text-rose-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneStyles[tone]}`}><Icon size={18} strokeWidth={2} /></span></div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-xs">{rising ? <ArrowUpRight size={14} className="text-emerald-600" /> : <ArrowDownRight size={14} className="text-emerald-600" />}<span className="font-semibold text-emerald-600">{change}</span><span className="text-slate-400">{detail}</span></div>
    </article>
  );
}

function Dashboard() {
  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar />
      <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium text-indigo-600">Tuesday, September 22, 2026</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Good morning, Jordan</h1><p className="mt-1 text-sm text-slate-500">Here is what needs your attention today.</p></div>
            <div className="flex items-center gap-3"><button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800" title="Search" type="button"><Search size={18} /></button><button className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800" title="Notifications" type="button"><Bell size={18} /></button><Link className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-500" to="/dashboard/upload-invoice"><FileUp size={16} />Upload invoice</Link></div>
        </header>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>

      </section>
    </main>
  );
}

export default Dashboard;