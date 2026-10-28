import { ArrowDownUp, Building2, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import apiClient, { apiError } from "../../../api/client";
import NotificationBell from "../../../components/NotificationBell";
import Sidebar from "../../Sidebar/Sidebar";

// Some records store the GSTIN with a "GSTIN" prefix; show the number itself.
const gstin = (t) => (t || "").replace(/^GSTIN/i, "");
const inr = (v) => (v == null ? "—" : `INR ${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);

const SORTS = {
  risk:      { label: "Average risk",   key: (v) => v.average_risk ?? -1 },
  high:      { label: "High-risk count", key: (v) => v.high_risk_count },
  rejection: { label: "Rejection rate", key: (v) => v.rejection_rate ?? -1 },
  invoices:  { label: "Invoices",       key: (v) => v.invoice_count },
  amount:    { label: "Total billed",   key: (v) => v.total_amount },
  name:      { label: "Name",           key: (v) => v.name.toLowerCase() },
};

function riskTone(score) {
  if (score == null) return "text-slate-300";
  if (score >= 50) return "text-rose-600";
  if (score >= 25) return "text-amber-600";
  return "text-emerald-600";
}

export default function Vendors() {
  const [vendors, setVendors] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("risk");

  useEffect(() => {
    apiClient.get("/vendor-insights/")
      .then(({ data }) => setVendors(data))
      .catch((e) => setError(apiError(e, "Failed to load vendors")));
  }, []);

  const visible = useMemo(() => {
    if (!vendors) return [];
    const q = query.trim().toLowerCase();
    const rows = vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || (v.tax_id || "").toLowerCase().includes(q));
    const k = SORTS[sort].key;
    return [...rows].sort((a, b) => (sort === "name" ? (k(a) < k(b) ? -1 : 1) : k(b) - k(a)));
  }, [vendors, query, sort]);

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Supplier risk</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Vendors</h1>
          </div>
          <NotificationBell />
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-no-tilt>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
              <label className="flex h-9 min-w-52 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3">
                <Search size={14} className="text-slate-400" />
                <input className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="Search by vendor name or GSTIN…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <ArrowDownUp size={13} /> Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700">
                  {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {error && <p className="p-6 text-sm text-rose-500">{error}</p>}
            {!vendors && !error && <p className="p-6 text-sm text-slate-400">Loading vendors…</p>}

            {vendors && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      {["Vendor", "Invoices", "Total billed", "Avg risk", "High risk", "Rejection rate", "Last invoice", ""].map((h) => (
                        <th key={h} className="px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((v) => (
                      <tr key={v.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-5 py-3.5">
                          <Link to={`/dashboard/vendors/${v.id}`} className="flex items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 size={14} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-800">{v.name}</span>
                              <span className="block font-mono-num text-[10px] text-slate-400">{gstin(v.tax_id) || "No GSTIN"}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">{v.invoice_count}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-800">{inr(v.total_amount)}</td>
                        <td className={`px-5 py-3.5 text-xs font-bold ${riskTone(v.average_risk)}`}>{v.average_risk ?? "—"}</td>
                        <td className={`px-5 py-3.5 text-xs font-semibold ${v.high_risk_count ? "text-rose-600" : "text-slate-400"}`}>{v.high_risk_count}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">
                          {pct(v.rejection_rate)}
                          {v.rejection_rate != null && <span className="ml-1 text-[10px] text-slate-400">of {v.approved + v.rejected}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {v.last_invoice_date ? new Date(v.last_invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <Link to={`/dashboard/vendors/${v.id}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600">
                            Profile <ChevronRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {!visible.length && (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">No vendors match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
