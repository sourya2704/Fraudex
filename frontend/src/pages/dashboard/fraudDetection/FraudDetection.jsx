import {
  Bell,
  ChevronRight,
  FileWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

// ── Risk badge ────────────────────────────────────────────────────────────────
const RISK_STYLES = {
  CRITICAL: { badge: "bg-rose-50 text-rose-600 border-rose-200",   bar: "bg-rose-500" },
  HIGH:     { badge: "bg-orange-50 text-orange-600 border-orange-200", bar: "bg-orange-500" },
  MEDIUM:   { badge: "bg-amber-50 text-amber-600 border-amber-200",   bar: "bg-amber-400" },
  LOW:      { badge: "bg-green-50 text-green-600 border-green-200",   bar: "bg-green-500" },
};

function RiskBadge({ level }) {
  const s = RISK_STYLES[level];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>
      {level}
    </span>
  );
}

function RiskBar({ score }) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color =
    pct >= 75 ? "bg-rose-500" :
    pct >= 50 ? "bg-orange-500" :
    pct >= 25 ? "bg-amber-400" :
                "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{pct.toFixed(0)}</span>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FraudDetection() {
  const [stats, setStats]           = useState(null);
  const [highRisk, setHighRisk]     = useState([]);
  const [distribution, setDist]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [levelFilter, setLevel]     = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const [statsRes, highRiskRes, distRes] = await Promise.all([
        apiClient.get("/fraud/statistics"),
        apiClient.get("/fraud/high-risk-invoices?min_risk_level=MEDIUM&limit=100"),
        apiClient.get("/fraud/risk-distribution"),
      ]);
      setStats(statsRes.data);
      setHighRisk(highRiskRes.data);
      setDist(distRes.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load fraud data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function refresh() { setRefreshing(true); loadData(); }

  // ── Client-side filter ────────────────────────────────────────────────────
  const visible = highRisk.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      String(inv.invoice_id).includes(q) ||
      (inv.invoice_number || "").toLowerCase().includes(q) ||
      (inv.vendor_name || "").toLowerCase().includes(q);
    const matchLevel =
      levelFilter === "All" || inv.risk_level === levelFilter;
    return matchSearch && matchLevel;
  });

  const summaryCards = [
    {
      label: "Critical / High Risk",
      value: stats ? (stats.critical_risk_count + stats.high_risk_count) : "—",
      icon: ShieldAlert,
      color: "rose",
    },
    {
      label: "Medium Risk",
      value: stats?.medium_risk_count ?? "—",
      icon: TriangleAlert,
      color: "amber",
    },
    {
      label: "Low Risk",
      value: stats?.low_risk_count ?? "—",
      icon: FileWarning,
      color: "green",
    },
    {
      label: "Total Analyzed",
      value: stats?.total_invoices_analyzed ?? "—",
      icon: ShieldCheck,
      color: "indigo",
    },
  ];

  const colorMap = {
    rose:   { card: "border-rose-200 bg-rose-50/50",   icon: "bg-rose-100 text-rose-600" },
    amber:  { card: "border-amber-200 bg-amber-50/50", icon: "bg-amber-100 text-amber-600" },
    green:  { card: "border-green-200 bg-green-50/50", icon: "bg-green-100 text-green-600" },
    indigo: { card: "border-indigo-200 bg-indigo-50/50", icon: "bg-indigo-100 text-indigo-600" },
  };

  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold">Fraud Detection</h1>
          <div className="flex items-center gap-3 text-slate-400">
            <button onClick={refresh} title="Refresh" type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15} />
            </button>
            <Bell size={18} />
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-7 space-y-5">

          {error && (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ label, value, icon: Icon, color }) => (
              <article key={label} className={`rounded-xl border p-4 shadow-sm ${colorMap[color].card}`}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-full ${colorMap[color].icon}`}>
                    <Icon size={15} />
                  </span>
                  <p className="text-xs font-medium text-slate-600">{label}</p>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-800">{loading ? "…" : value}</p>
                {stats && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    avg score: {stats.average_risk_score?.toFixed(1) ?? "—"}
                  </p>
                )}
              </article>
            ))}
          </div>

          {/* Risk distribution bar */}
          {distribution && distribution.total_analyzed > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Risk Distribution</h2>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {["CRITICAL","HIGH","MEDIUM","LOW"].map((level) => {
                  const pct = distribution.distribution[level]?.percentage || 0;
                  const bg = { CRITICAL:"bg-rose-500", HIGH:"bg-orange-500", MEDIUM:"bg-amber-400", LOW:"bg-green-500" }[level];
                  return pct > 0 ? <div key={level} className={`${bg} transition-all`} style={{ width: `${pct}%` }} title={`${level}: ${pct}%`} /> : null;
                })}
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
                {["CRITICAL","HIGH","MEDIUM","LOW"].map((level) => {
                  const d = distribution.distribution[level];
                  const dot = { CRITICAL:"bg-rose-500", HIGH:"bg-orange-500", MEDIUM:"bg-amber-400", LOW:"bg-green-500" }[level];
                  return (
                    <span key={level} className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {level} ({d?.count || 0})
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Most common fraud types */}
          {stats?.most_common_fraud_types?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">Most Common Fraud Signals</h2>
              <div className="space-y-2">
                {stats.most_common_fraud_types.slice(0, 6).map((ft) => (
                  <div key={ft.code} className="flex items-center gap-3">
                    <span className="w-40 truncate text-xs text-slate-500">{ft.code.replace(/_/g, " ")}</span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-400"
                          style={{ width: `${Math.min(100, (ft.count / (stats.most_common_fraud_types[0]?.count || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="w-6 text-right text-xs font-semibold text-slate-600">{ft.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High-risk invoice table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Flagged Invoices</h2>
                <p className="mt-0.5 text-xs text-slate-400">Invoices with MEDIUM risk or above</p>
              </div>
              <div className="flex gap-2">
                <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 focus-within:border-indigo-400">
                  <Search size={13} />
                  <input className="w-36 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                    placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
                <select className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none"
                  value={levelFilter} onChange={(e) => setLevel(e.target.value)}>
                  {["All","CRITICAL","HIGH","MEDIUM"].map((l) => (
                    <option key={l} value={l}>{l === "All" ? "All levels" : l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    {["Invoice", "Vendor", "Amount", "Risk Level", "Risk Score", "Flags", "Detected", ""].map((c) => (
                      <th key={c} className="px-4 py-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Loading…</td></tr>
                  )}
                  {!loading && visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center">
                        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-200">
                          <ShieldCheck size={20} />
                        </span>
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                          {highRisk.length === 0 ? "No fraud alerts yet" : "No results for this filter"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {highRisk.length === 0
                            ? "Run fraud detection on your invoices to see results here."
                            : "Try adjusting your search or risk level filter."}
                        </p>
                      </td>
                    </tr>
                  )}
                  {!loading && visible.map((inv) => (
                    <tr key={inv.invoice_id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-700">#{inv.invoice_id}</div>
                        {inv.invoice_number && <div className="text-[11px] text-slate-400">{inv.invoice_number}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{inv.vendor_name || <span className="text-slate-300">Unknown</span>}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {inv.total_amount != null
                          ? parseFloat(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="px-4 py-3"><RiskBadge level={inv.risk_level} /></td>
                      <td className="px-4 py-3"><RiskBar score={inv.risk_score} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold
                          ${inv.critical_flags > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                          {inv.critical_flags ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(inv.detection_date)}</td>
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/invoices/${inv.invoice_id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                          Review <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              <span>Showing {visible.length} flagged invoice{visible.length !== 1 ? "s" : ""}</span>
              <button onClick={refresh} type="button" className="flex items-center gap-1.5 hover:text-slate-700">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
