import {
  ChevronRight, RefreshCw, Search,
  ShieldAlert, ShieldCheck, TriangleAlert, FileWarning, TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
} from "recharts";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";
import NotificationBell from "../../../components/NotificationBell";

/* ── Risk config ─────────────────────────────────────────────────────────── */
const RISK = {
  CRITICAL: { badge:"bg-rose-50 text-rose-600 border-rose-200",       bar:"bg-rose-500",    color:"#ef4444", light:"#fff1f2" },
  HIGH:     { badge:"bg-orange-50 text-orange-600 border-orange-200",  bar:"bg-orange-500",  color:"#f97316", light:"#fff7ed" },
  MEDIUM:   { badge:"bg-amber-50 text-amber-600 border-amber-200",     bar:"bg-amber-400",   color:"#f59e0b", light:"#fffbeb" },
  LOW:      { badge:"bg-emerald-50 text-emerald-600 border-emerald-200",bar:"bg-emerald-500", color:"#22c55e", light:"#f0fdf4" },
};

function Badge({ level }) {
  const s = RISK[level]; if (!s) return null;
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>{level}</span>;
}

function ScoreBar({ score }) {
  const p = Math.min(100, Math.max(0, score || 0));
  const col = p >= 75 ? "bg-rose-500" : p >= 50 ? "bg-orange-500" : p >= 25 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${col} transition-all`} style={{ width: `${p}%` }}/>
      </div>
      <span className="text-xs font-bold tabular-nums text-slate-700">{p.toFixed(0)}</span>
    </div>
  );
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

/* ── KPI Card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, iconBg, iconColor, valueColor, sub }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${iconBg}`}>
          <Icon size={18} strokeWidth={1.9} className={iconColor}/>
        </div>
      </div>
      <p className={`mt-3 text-4xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-400">{sub}</p>}
    </article>
  );
}

/* ── Risk Distribution Donut ─────────────────────────────────────────────── */
function RiskDonut({ dist }) {
  if (!dist || dist.total_analyzed === 0) return (
    <div className="flex h-52 items-center justify-center text-xs text-slate-400">No data yet</div>
  );
  const levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const data = levels.map(l => ({
    name: l, value: dist.distribution[l]?.count || 0, color: RISK[l].color,
  })).filter(d => d.value > 0);
  const total = dist.total_analyzed;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
              dataKey="value" strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color}/>)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}/>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-[10px] text-slate-400">analyzed</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5">
        {levels.map(l => {
          const d = dist.distribution[l] || { count: 0, percentage: 0 };
          return (
            <div key={l} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RISK[l].color }}/>
              <span className="w-16 text-xs font-semibold text-slate-600">{l}</span>
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${d.percentage}%`, background: RISK[l].color }}/>
              </div>
              <span className="w-12 text-right text-xs text-slate-500">{d.count} <span className="text-slate-300">({d.percentage}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Fraud Signals ───────────────────────────────────────────────────────── */
function FraudSignals({ signals }) {
  if (!signals?.length) return (
    <div className="flex h-52 items-center justify-center text-xs text-slate-400">No signals recorded</div>
  );
  const max = signals[0]?.count || 1;
  const colors = ["#6366f1","#8b5cf6","#06b6d4","#f59e0b","#ef4444","#22c55e"];
  return (
    <div className="space-y-3">
      {signals.slice(0, 7).map((ft, i) => (
        <div key={ft.code} className="flex items-center gap-3">
          <div className="w-40 shrink-0">
            <p className="truncate text-xs font-medium text-slate-600" title={ft.code}>
              {ft.code.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(ft.count / max) * 100}%`, background: colors[i % colors.length] }}/>
          </div>
          <span className="w-5 shrink-0 text-right text-xs font-bold text-slate-700">{ft.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function FraudDetection() {
  const [stats,      setStats]      = useState(null);
  const [highRisk,   setHighRisk]   = useState([]);
  const [dist,       setDist]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [levelFilt,  setLevelFilt]  = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [sR, hR, dR] = await Promise.all([
        apiClient.get("/fraud/statistics"),
        apiClient.get("/fraud/high-risk-invoices?min_risk_level=MEDIUM&limit=100"),
        apiClient.get("/fraud/risk-distribution"),
      ]);
      setStats(sR.data); setHighRisk(hR.data); setDist(dR.data); setError(null);
    } catch (e) { setError(e.response?.data?.detail || "Failed to load fraud data"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);
  const refresh = () => { setRefreshing(true); load(); };

  const visible = highRisk.filter(inv => {
    const q = search.toLowerCase();
    const mS = !search || String(inv.invoice_id).includes(q) || (inv.invoice_number || "").toLowerCase().includes(q) || (inv.vendor_name || "").toLowerCase().includes(q);
    const mL = levelFilt === "All" || inv.risk_level === levelFilt;
    return mS && mL;
  });

  const critHigh = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const analyzed = stats?.total_invoices_analyzed ?? 0;
  const fraudRate = analyzed > 0 ? ((critHigh / analyzed) * 100).toFixed(1) : null;

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-500">Risk Intelligence</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Fraud Detection</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} type="button"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15}/>
            </button>
            <NotificationBell/>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-8">

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
          )}

          {/* ── KPI Cards ────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Critical / High Risk"
              value={loading ? "…" : critHigh}
              icon={ShieldAlert} iconBg="bg-rose-50" iconColor="text-rose-500"
              valueColor="text-rose-600"
              sub={fraudRate ? `${fraudRate}% fraud rate` : "No data"}/>
            <KpiCard label="Medium Risk"
              value={loading ? "…" : stats?.medium_risk_count ?? "—"}
              icon={TriangleAlert} iconBg="bg-amber-50" iconColor="text-amber-500"
              valueColor="text-amber-600"
              sub="Needs attention"/>
            <KpiCard label="Low Risk"
              value={loading ? "…" : stats?.low_risk_count ?? "—"}
              icon={FileWarning} iconBg="bg-emerald-50" iconColor="text-emerald-500"
              valueColor="text-emerald-600"
              sub="Likely clean"/>
            <KpiCard label="Total Analyzed"
              value={loading ? "…" : analyzed}
              icon={ShieldCheck} iconBg="bg-indigo-50" iconColor="text-indigo-500"
              valueColor="text-indigo-600"
              sub={`avg score ${stats?.average_risk_score?.toFixed(1) ?? "—"}`}/>
          </div>

          {/* ── Charts Row ───────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Risk Distribution</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{analyzed} invoices analyzed</p>
                </div>
                {dist?.total_analyzed > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                    <TrendingUp size={11}/> Live
                  </span>
                )}
              </div>
              <RiskDonut dist={dist}/>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-slate-900">Most Common Fraud Signals</h2>
                <p className="mt-0.5 text-xs text-slate-400">By frequency across all invoices</p>
              </div>
              <FraudSignals signals={stats?.most_common_fraud_types}/>
            </section>
          </div>

          {/* ── Flagged Invoices Table ────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Flagged Invoices</h2>
                <p className="mt-0.5 text-xs text-slate-400">Medium risk and above — {visible.length} invoice{visible.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-2">
                <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white transition">
                  <Search size={13} className="text-slate-400"/>
                  <input className="w-40 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                    placeholder="Search invoice, vendor…" value={search} onChange={e => setSearch(e.target.value)}/>
                </label>
                <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={levelFilt} onChange={e => setLevelFilt(e.target.value)}>
                  {["All", "CRITICAL", "HIGH", "MEDIUM"].map(l => (
                    <option key={l} value={l}>{l === "All" ? "All levels" : l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    {["Invoice", "Vendor", "Amount", "Risk Level", "Score", "Flags", "Detected", ""].map(c => (
                      <th key={c} className="px-5 py-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && (
                    <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Loading…</td></tr>
                  )}
                  {!loading && visible.length === 0 && (
                    <tr><td colSpan={8} className="py-20 text-center">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-400 shadow-sm">
                        <ShieldCheck size={26}/>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        {highRisk.length === 0 ? "No fraud alerts yet" : "No results for this filter"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {highRisk.length === 0 ? "Run fraud detection on invoices to populate." : "Try adjusting your search or filter."}
                      </p>
                    </td></tr>
                  )}
                  {!loading && visible.map(inv => (
                    <tr key={inv.invoice_id} className="group transition hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-bold text-slate-700">#{inv.invoice_id}</p>
                        {inv.invoice_number && <p className="text-[10px] text-slate-400">{inv.invoice_number}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {inv.vendor_name || <span className="text-slate-300">Unknown</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-800">
                        {inv.total_amount != null ? `₹${parseFloat(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-5 py-3.5"><Badge level={inv.risk_level}/></td>
                      <td className="px-5 py-3.5"><ScoreBar score={inv.risk_score}/></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl text-[11px] font-bold ${inv.critical_flags > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                          {inv.critical_flags ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{fmt(inv.detection_date)}</td>
                      <td className="px-5 py-3.5">
                        <Link to={`/dashboard/invoices/${inv.invoice_id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100 hover:text-indigo-800">
                          Review<ChevronRight size={13}/>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              <span>Showing {visible.length} of {highRisk.length} flagged invoices</span>
              <button onClick={refresh} type="button" className="flex items-center gap-1.5 hover:text-indigo-600 transition">
                <RefreshCw size={11}/> Refresh
              </button>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
