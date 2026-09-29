import {
  BarChart3,
  Bell,
  ChartNoAxesCombined,
  PieChart,
  Search,
  ShieldCheck,
} from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

const cards = [
  { label: "Total invoices", color: "text-slate-900", note: "Across your workspace" },
  { label: "Fraudulent invoices", color: "text-rose-600", note: "Flagged for review" },
  { label: "Detection rate", color: "text-emerald-600", note: "Based on reviewed invoices" },
  { label: "Avg. invoice value", color: "text-indigo-600", note: "Across analyzed invoices" },
  { label: "High-risk vendors", color: "text-amber-600", note: "With repeated flags" },
];

function EmptyChart({ icon: Icon, message }) {
  return (
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50/70">
      <div className="absolute inset-x-5 top-8 space-y-10 opacity-70">
        <span className="block border-t border-dashed border-slate-200" />
        <span className="block border-t border-dashed border-slate-200" />
        <span className="block border-t border-dashed border-slate-200" />
      </div>
      <div className="relative z-10 text-center">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-300 shadow-sm">
          <Icon size={18} />
        </span>
        <p className="mt-3 text-xs font-semibold text-slate-600">{message}</p>
        <p className="mt-1 text-[11px] text-slate-400">Connect your data to populate this view</p>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <main className="flex min-h-screen bg-[#f6f7f4] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex min-h-[76px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">Workspace intelligence</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">Fraud analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:text-slate-700" title="Search" type="button"><Search size={17} /></button>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:text-slate-700" title="Notifications" type="button"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" /></button>
          </div>
        </header>
        <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-9">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">See what needs attention</h2><p className="mt-1 text-sm text-slate-500">A clear view of invoice risk across your organization.</p></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-400" /> Awaiting backend data</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((card) => (
              <article
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                key={card.label}
              >
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className={`mt-3 text-2xl font-semibold ${card.color}`}>--</p>
                <p className="mt-1 text-[11px] text-slate-400">{card.note}</p>
              </article>
            ))}
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Fraud detection trend</h2>
              <p className="mt-1 text-xs text-slate-400">
                Monthly fraud activity over time
              </p></div><span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400">MONTHLY</span></div>
              <div className="mt-4">
                <EmptyChart
                  icon={ChartNoAxesCombined}
                  message="No trend data available"
                />
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">
                Invoice Risk Distribution
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Risk levels across analyzed invoices
              </p></div><ShieldCheck className="text-slate-300" size={18} /></div>
              <div className="mt-4">
                <EmptyChart
                  icon={PieChart}
                  message="No risk distribution available"
                />
              </div>
            </section>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-semibold">Fraud by Vendor</h2>
              <p className="mt-1 text-xs text-slate-400">
                Vendors with the most flagged invoices
              </p>
              <div className="mt-4">
                <EmptyChart
                  icon={BarChart3}
                  message="No vendor data available"
                />
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-semibold">Fraud by Invoice Amount</h2>
              <p className="mt-1 text-xs text-slate-400">
                Risk grouped by invoice value
              </p>
              <div className="mt-4">
                <EmptyChart
                  icon={BarChart3}
                  message="No amount data available"
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Analytics;
