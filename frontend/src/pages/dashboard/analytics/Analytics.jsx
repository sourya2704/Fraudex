import {
  BarChart3,
  Bell,
  ChartNoAxesCombined,
  PieChart,
  Search,
} from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

const cards = [
  { label: "Total invoices", color: "text-slate-900" },
  { label: "Fraudulent invoices", color: "text-red-600" },
  { label: "Detection rate", color: "text-emerald-600" },
  { label: "Avg. invoice value", color: "text-indigo-600" },
  { label: "High-risk vendors", color: "text-amber-600" },
];

function EmptyChart({ icon: Icon, message }) {
  return (
    <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg bg-slate-50/70">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 opacity-60">
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-dashed border-slate-200" />
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-r border-dashed border-slate-200" />
        <span className="border-b border-dashed border-slate-200" />
        <span className="border-r border-dashed border-slate-200" />
        <span className="border-r border-dashed border-slate-200" />
        <span className="border-r border-dashed border-slate-200" />
        <span />
      </div>
      <div className="relative z-10 text-center">
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-slate-300 shadow-sm">
          <Icon size={18} />
        </span>
        <p className="mt-2 text-xs font-semibold text-slate-500">{message}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Waiting for backend data
        </p>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold">Fraud Analytics</h1>
          <div className="flex items-center gap-5 text-slate-400">
            <Search size={18} />
            <Bell size={18} />
          </div>
        </header>
        <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((card) => (
              <article
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                key={card.label}
              >
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className={`mt-2 text-2xl font-bold ${card.color}`}>--</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Waiting for backend data
                </p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Fraud Detection Trend</h2>
              <p className="mt-1 text-xs text-slate-400">
                Monthly fraud activity over time
              </p>
              <div className="mt-4">
                <EmptyChart
                  icon={ChartNoAxesCombined}
                  message="No trend data available"
                />
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">
                Invoice Risk Distribution
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Risk levels across analyzed invoices
              </p>
              <div className="mt-4">
                <EmptyChart
                  icon={PieChart}
                  message="No risk distribution available"
                />
              </div>
            </section>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
