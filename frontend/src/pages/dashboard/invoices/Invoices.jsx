import { Bell, ChevronDown, FileText, Filter, Search } from "lucide-react";
import { useState } from "react";
import Sidebar from "../../Sidebar/Sidebar";

const columns = ["Invoice ID", "Vendor", "Invoice date", "Amount", "Status", "Fraud score", "Uploaded by", "Actions"];

function Invoices() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [risk, setRisk] = useState("All Risk");

  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold text-slate-900">Invoices</h1>
          <div className="flex items-center gap-5 text-slate-400"><div className="hidden items-center gap-2 text-xs sm:flex"><Search size={16} />Search invoices...</div><button className="relative" title="Notifications" type="button"><Bell size={18} /></button><span className="hidden h-8 w-8 place-items-center rounded-full bg-indigo-500 text-xs font-bold text-white sm:grid">VY</span></div>
        </header>

        <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-7">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-400 focus-within:border-indigo-400"><Search size={16} /><input className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search by ID or vendor..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <label className="relative"><select className="h-9 min-w-28 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-600 outline-none focus:border-indigo-400" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Processing</option><option>Verified</option><option>Needs review</option></select><ChevronDown className="pointer-events-none absolute right-2 top-3 text-slate-400" size={13} /></label>
              <label className="relative"><select className="h-9 min-w-28 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-600 outline-none focus:border-indigo-400" value={risk} onChange={(event) => setRisk(event.target.value)}><option>All Risk</option><option>Low risk</option><option>Medium risk</option><option>High risk</option></select><ChevronDown className="pointer-events-none absolute right-2 top-3 text-slate-400" size={13} /></label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr>{columns.map((column) => <th className="px-4 py-3 font-bold" key={column}>{column}</th>)}</tr></thead><tbody><tr><td className="px-4 py-20 text-center" colSpan={columns.length}><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-300"><FileText size={20} /></span><p className="mt-3 text-sm font-semibold text-slate-600">No invoices found</p><p className="mt-1 text-xs text-slate-400">{query || status !== "All" || risk !== "All Risk" ? "Try changing your search or filters." : "Uploaded invoices will appear here."}</p></td></tr></tbody></table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-400"><span>Showing 0 invoices</span><button className="flex items-center gap-2 text-slate-400" disabled type="button"><Filter size={14} />Filter data</button></div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Invoices;
