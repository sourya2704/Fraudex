import {
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  DOCUMENTS_UPLOADED: "bg-blue-50 text-blue-600 border-blue-100",
  PROCESSING:         "bg-amber-50 text-amber-600 border-amber-100",
  ANALYSIS_READY:     "bg-indigo-50 text-indigo-600 border-indigo-100",
  UNDER_REVIEW:       "bg-violet-50 text-violet-600 border-violet-100",
  DECIDED:            "bg-green-50 text-green-600 border-green-100",
  PROCESSING_FAILED:  "bg-rose-50 text-rose-600 border-rose-100",
  DRAFT:              "bg-slate-50 text-slate-500 border-slate-200",
};

const STATUS_LABELS = {
  DOCUMENTS_UPLOADED: "Uploaded",
  PROCESSING:         "Processing",
  ANALYSIS_READY:     "Ready",
  UNDER_REVIEW:       "Under Review",
  DECIDED:            "Decided",
  PROCESSING_FAILED:  "Failed",
  DRAFT:              "Draft",
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>
      {label}
    </span>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────
const RISK_STYLES = {
  CRITICAL: "bg-rose-50 text-rose-600 border-rose-100",
  HIGH:     "bg-orange-50 text-orange-600 border-orange-100",
  MEDIUM:   "bg-amber-50 text-amber-600 border-amber-100",
  LOW:      "bg-green-50 text-green-600 border-green-100",
};

function RiskBadge({ level }) {
  if (!level) return <span className="text-xs text-slate-300">—</span>;
  const style = RISK_STYLES[level] || "bg-slate-50 text-slate-400";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${style}`}>
      {level}
    </span>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(amt, currency) {
  if (amt == null) return "—";
  return `${currency || ""}  ${parseFloat(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`.trim();
}

const ALL_STATUSES = ["All", "DOCUMENTS_UPLOADED", "PROCESSING", "ANALYSIS_READY", "UNDER_REVIEW", "DECIDED", "PROCESSING_FAILED"];

// ── Main component ────────────────────────────────────────────────────────────
export default function Invoices() {
  const [invoices, setInvoices]   = useState([]);
  const [fraudMap, setFraudMap]   = useState({}); // invoiceId → fraud result
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [query, setQuery]         = useState("");
  const [statusFilter, setStatus] = useState("All");
  const [riskFilter, setRisk]     = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const { data } = await apiClient.get("/invoices/");
      setInvoices(data);

      // Fetch fraud results for each invoice in parallel (best-effort)
      const results = await Promise.allSettled(
        data.map((inv) =>
          apiClient.get(`/invoices/${inv.id}/fraud-detection`)
            .then((r) => ({ id: inv.id, fraud: r.data }))
            .catch(() => ({ id: inv.id, fraud: null }))
        )
      );

      const map = {};
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value.fraud) {
          map[r.value.id] = r.value.fraud;
        }
      });
      setFraudMap(map);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load invoices");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function refresh() { setRefreshing(true); loadData(); }

  // ── Filters ────────────────────────────────────────────────────────────────
  const visible = invoices.filter((inv) => {
    const q = query.toLowerCase();
    const matchQuery =
      !query ||
      String(inv.id).includes(q) ||
      (inv.invoice_number || "").toLowerCase().includes(q) ||
      (inv.vendor?.name || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    const fraud = fraudMap[inv.id];
    const riskLevel = fraud?.risk_level;
    const matchRisk =
      riskFilter === "All" ||
      (riskFilter === "Low" && riskLevel === "LOW") ||
      (riskFilter === "Medium" && riskLevel === "MEDIUM") ||
      (riskFilter === "High" && (riskLevel === "HIGH" || riskLevel === "CRITICAL")) ||
      (riskFilter === "Unanalyzed" && !riskLevel);
    return matchQuery && matchStatus && matchRisk;
  });

  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold">Invoices</h1>
          <div className="flex items-center gap-3 text-slate-400">
            <button onClick={refresh} title="Refresh" type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15} />
            </button>
            <Bell size={18} />
            <Link to="/dashboard/upload-invoice"
              className="flex items-center gap-2 rounded-xl bg-[#5967f2] px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-[#4856df]">
              <Upload size={14} /> Upload
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          {/* Stat chips */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {[
              { label: "Total",     value: invoices.length,                                            color: "slate" },
              { label: "Ready",     value: invoices.filter(i => i.status === "ANALYSIS_READY").length, color: "indigo" },
              { label: "High Risk", value: Object.values(fraudMap).filter(f => f?.risk_level === "HIGH" || f?.risk_level === "CRITICAL").length, color: "rose" },
              { label: "Decided",   value: invoices.filter(i => i.status === "DECIDED").length,        color: "green" },
            ].map(({ label, value, color }) => (
              <span key={label} className={`rounded-full border px-3 py-1 font-semibold
                ${color === "rose" ? "border-rose-100 bg-rose-50 text-rose-600"
                  : color === "indigo" ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                  : color === "green" ? "border-green-100 bg-green-50 text-green-600"
                  : "border-slate-200 bg-white text-slate-500"}`}>
                {value} {label}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
              <label className="flex h-9 flex-1 min-w-48 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 focus-within:border-indigo-400">
                <Search size={14} />
                <input className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="Search by ID, invoice #, or vendor…"
                  value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="relative">
                <select className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-7 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : STATUS_LABELS[s]}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 text-slate-400" size={13} />
              </div>
              <div className="relative">
                <select className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-7 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={riskFilter} onChange={(e) => setRisk(e.target.value)}>
                  {["All", "High", "Medium", "Low", "Unanalyzed"].map((r) => (
                    <option key={r} value={r}>{r === "All" ? "All risk levels" : r + " risk"}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 text-slate-400" size={13} />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    {["ID", "Invoice #", "Vendor", "Date", "Amount", "Status", "Risk", ""].map((col) => (
                      <th key={col} className="px-4 py-3">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Loading invoices…</td></tr>
                  )}
                  {error && (
                    <tr><td colSpan={8} className="py-10 text-center text-sm text-rose-500">{error}</td></tr>
                  )}
                  {!loading && !error && visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-200">
                          <FileText size={20} />
                        </span>
                        <p className="mt-3 text-sm font-semibold text-slate-600">No invoices found</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {query || statusFilter !== "All" || riskFilter !== "All"
                            ? "Try adjusting your filters."
                            : "Upload an invoice to get started."}
                        </p>
                        <Link to="/dashboard/upload-invoice"
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600">
                          <Upload size={13} /> Upload Invoice
                        </Link>
                      </td>
                    </tr>
                  )}
                  {!loading && !error && visible.map((inv) => {
                    const fraud = fraudMap[inv.id];
                    return (
                      <tr key={inv.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">#{inv.id}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">{inv.invoice_number || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-slate-700">{inv.vendor?.name || <span className="text-slate-300">Unknown</span>}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">{formatAmount(inv.total_amount, inv.currency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3">
                          {fraud ? (
                            <div className="flex flex-col gap-0.5">
                              <RiskBadge level={fraud.risk_level} />
                              <span className="text-[10px] text-slate-400">{fraud.risk_score?.toFixed(1)} / 100</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300">Not analyzed</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/dashboard/invoices/${inv.id}`}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                            View <ChevronRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              <span>Showing {visible.length} of {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
              <button onClick={refresh} type="button"
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
