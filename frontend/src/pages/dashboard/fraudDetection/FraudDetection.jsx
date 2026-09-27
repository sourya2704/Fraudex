import { Bell, CircleAlert, FileWarning, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

const summaryCards = [
  { label: "High Risk Invoices", icon: CircleAlert, tone: "red" },
  { label: "Medium Risk Invoices", icon: CircleAlert, tone: "amber" },
  { label: "Duplicate Invoices", icon: FileWarning, tone: "blue" },
  { label: "Vendor Mismatches", icon: TriangleAlert, tone: "slate" },
];

const columns = ["Invoice", "Vendor", "Risk score", "Detected issues", "Status", "Action"];

function FraudDetection() {
  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8"><h1 className="text-base font-semibold">Fraud Detection</h1><div className="flex items-center gap-5 text-slate-400"><Search size={18} /><Bell size={18} /></div></header>
        <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-7">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(({ label, icon: Icon, tone }) => <article className={`rounded-xl border p-4 shadow-sm ${tone === "red" ? "border-red-200 bg-red-50/50" : tone === "amber" ? "border-amber-200 bg-amber-50/50" : tone === "blue" ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white"}`} key={label}><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full ${tone === "red" ? "bg-red-100 text-red-600" : tone === "amber" ? "bg-amber-100 text-amber-600" : tone === "blue" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}><Icon size={15} /></span><p className="text-xs font-medium text-slate-600">{label}</p></div><p className="mt-3 text-2xl font-bold text-slate-400">--</p><p className="mt-1 text-[11px] text-slate-400">Waiting for backend data</p></article>)}</div>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Fraud Detection Monitor</h2><p className="mt-1 text-xs text-slate-400">Invoices flagged by the AI fraud detection engine</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr>{columns.map((column) => <th className="px-4 py-3 font-bold" key={column}>{column}</th>)}</tr></thead><tbody><tr><td className="px-4 py-20 text-center" colSpan={columns.length}><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-300"><ShieldAlert size={20} /></span><p className="mt-3 text-sm font-semibold text-slate-600">No fraud alerts yet</p><p className="mt-1 text-xs text-slate-400">Analyzed invoices with detected risks will appear here.</p></td></tr></tbody></table></div><div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-400"><span>Showing 0 flagged invoices</span><span>Backend data required</span></div></section>
        </section>
      </div>
    </main>
  );
}

export default FraudDetection;
