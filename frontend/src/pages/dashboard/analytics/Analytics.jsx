import {
  Activity,
  BarChart3,
  Bell,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// Tiny shared components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "slate" }) {
  const num = {
    slate:  "text-slate-900",
    rose:   "text-rose-600",
    emerald:"text-emerald-600",
    indigo: "text-indigo-600",
    amber:  "text-amber-600",
  }[color] ?? "text-slate-900";
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${num}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </article>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center rounded-lg bg-slate-50 text-center">
      <Icon size={24} className="text-slate-200" />
      <p className="mt-3 text-xs font-semibold text-slate-500">{msg}</p>
      <p className="mt-1 text-[11px] text-slate-400">Upload &amp; analyse invoices to see data</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Distribution donut (pure CSS)
// ─────────────────────────────────────────────────────────────────────────────
const RISK_COLORS = {
  CRITICAL: { bg: "bg-rose-500",   text: "text-rose-600",   light: "bg-rose-50"   },
  HIGH:     { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50" },
  MEDIUM:   { bg: "bg-amber-400",  text: "text-amber-600",  light: "bg-amber-50"  },
  LOW:      { bg: "bg-green-500",  text: "text-green-600",  light: "bg-green-50"  },
};

function RiskDistribution({ distribution }) {
  if (!distribution || distribution.total_analyzed === 0) {
    return <EmptyState icon={ShieldCheck} msg="No risk distribution yet" />;
  }
  const levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  return (
    <div className="space-y-3">
      {/* stacked bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {levels.map((lvl) => {
          const pct = distribution.distribution[lvl]?.percentage || 0;
          return pct > 0 ? (
            <div
              key={lvl}
              className={`${RISK_COLORS[lvl].bg} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${lvl}: ${pct}%`}
            />
          ) : null;
        })}
      </div>
      {/* legend + count */}
      <div className="grid grid-cols-2 gap-2">
        {levels.map((lvl) => {
          const d = distribution.distribution[lvl] || { count: 0, percentage: 0 };
          return (
            <div key={lvl} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${RISK_COLORS[lvl].light}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${RISK_COLORS[lvl].bg}`} />
                <span className={`text-xs font-semibold ${RISK_COLORS[lvl].text}`}>{lvl}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-700">{d.count}</span>
                <span className="ml-1 text-[10px] text-slate-400">({d.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-right text-[11px] text-slate-400">
        {distribution.total_analyzed} invoice{distribution.total_analyzed !== 1 ? "s" : ""} analyzed
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fraud Trends bar chart (last N days)
// ─────────────────────────────────────────────────────────────────────────────
function TrendChart({ trends, days }) {
  if (!trends || trends.length === 0) {
    return <EmptyState icon={TrendingUp} msg="No trend data available" />;
  }
  const maxTotal = Math.max(...trends.map((d) => d.total), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {trends.map((day) => {
          const pct = (day.total / maxTotal) * 100;
          const hasCrit = day.CRITICAL > 0;
          const hasHigh = day.HIGH > 0;
          const color = hasCrit ? "bg-rose-500" : hasHigh ? "bg-orange-400" : day.MEDIUM > 0 ? "bg-amber-400" : "bg-green-400";
          return (
            <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1">
              {/* tooltip */}
              <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                {new Date(day.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}: {day.total}
              </div>
              <div
                className={`w-full rounded-t ${color}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
              />
              <span className="text-[8px] text-slate-400 [writing-mode:vertical-rl] rotate-180 pb-0.5">
                {new Date(day.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
        {[["bg-rose-500","Critical"],["bg-orange-400","High"],["bg-amber-400","Medium"],["bg-green-400","Low"]].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${c}`}/>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fraud signals horizontal bar chart
// ─────────────────────────────────────────────────────────────────────────────
function SignalsChart({ signals }) {
  if (!signals || signals.length === 0) {
    return <EmptyState icon={ShieldAlert} msg="No fraud signals recorded" />;
  }
  const max = signals[0]?.count || 1;
  return (
    <div className="space-y-3">
      {signals.map((s) => (
        <div key={s.code} className="flex items-center gap-3">
          <span className="w-44 truncate text-xs text-slate-500" title={s.code}>
            {s.code.replace(/_/g, " ")}
          </span>
          <div className="flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-5 text-right text-xs font-bold text-slate-600">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor risk table
// ─────────────────────────────────────────────────────────────────────────────
const RISK_BADGE = {
  CRITICAL: "bg-rose-50 text-rose-600 border-rose-100",
  HIGH:     "bg-orange-50 text-orange-600 border-orange-100",
  MEDIUM:   "bg-amber-50 text-amber-600 border-amber-100",
  LOW:      "bg-green-50 text-green-600 border-green-100",
};

function riskLevel(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function VendorRiskTable({ vendors }) {
  if (!vendors || vendors.length === 0) {
    return <EmptyState icon={BarChart3} msg="No vendor risk data" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <tr>
            {["Vendor", "Invoices", "Analyzed", "Avg Risk Score", "Risk Level", "High/Critical Flags"].map((c) => (
              <th key={c} className="px-4 py-3">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vendors.map((v) => {
            const lvl = riskLevel(v.average_risk_score);
            return (
              <tr key={v.vendor_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 text-xs font-semibold text-slate-700">{v.vendor_name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{v.total_invoices}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{v.analyzed_invoices}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${lvl === "CRITICAL" ? "bg-rose-500" : lvl === "HIGH" ? "bg-orange-500" : lvl === "MEDIUM" ? "bg-amber-400" : "bg-green-500"}`}
                        style={{ width: `${v.average_risk_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{v.average_risk_score.toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_BADGE[lvl]}`}>
                    {lvl}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{v.high_critical_flags}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analytics page
// ─────────────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [stats, setStats]       = useState(null);
  const [dist, setDist]         = useState(null);
  const [trends30, setTrends30] = useState([]);
  const [trends7, setTrends7]   = useState([]);
  const [vendors, setVendors]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendWindow, setTrendWindow] = useState(30);

  async function loadAll() {
    try {
      const [statsRes, distRes, t30Res, t7Res, vendorRes, invRes] = await Promise.allSettled([
        apiClient.get("/fraud/statistics"),
        apiClient.get("/fraud/risk-distribution"),
        apiClient.get("/fraud/fraud-trends?days=30"),
        apiClient.get("/fraud/fraud-trends?days=7"),
        apiClient.get("/fraud/vendor-risk-summary?limit=10"),
        apiClient.get("/invoices/"),
      ]);

      if (statsRes.status  === "fulfilled") setStats(statsRes.value.data);
      if (distRes.status   === "fulfilled") setDist(distRes.value.data);
      if (t30Res.status    === "fulfilled") setTrends30(t30Res.value.data.trends || []);
      if (t7Res.status     === "fulfilled") setTrends7(t7Res.value.data.trends || []);
      if (vendorRes.status === "fulfilled") setVendors(vendorRes.value.data.top_risky_vendors || []);
      if (invRes.status    === "fulfilled") setInvoices(invRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  function refresh() { setRefreshing(true); loadAll(); }

  // ── Derived values ─────────────────────────────────────────────────────────
  const total     = invoices.length;
  const decided   = invoices.filter((i) => i.status === "DECIDED").length;
  const analyzed  = stats?.total_invoices_analyzed ?? 0;
  const critHigh  = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const detectionRate = analyzed > 0 ? ((critHigh / analyzed) * 100).toFixed(1) : "—";
  const amounts   = invoices.map((i) => parseFloat(i.total_amount || 0)).filter(Boolean);
  const avgAmt    = amounts.length ? (amounts.reduce((a, b) => a + b, 0) / amounts.length).toFixed(2) : "—";

  const trendData = trendWindow === 7 ? trends7 : trends30;

  return (
    <main className="flex min-h-screen bg-[#f6f7f4] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex min-h-[70px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">
              Workspace intelligence
            </p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight">Fraud analytics</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button onClick={refresh} title="Refresh" type="button"
              className={`grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15} />
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:text-slate-700" type="button">
              <Search size={17} />
            </button>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white hover:text-slate-700" type="button">
              <Bell size={17} />
              {critHigh > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />}
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8 lg:py-9">

          {/* ── Section heading ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                See what needs attention
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A clear view of invoice risk across your organization.
              </p>
            </div>
            {!loading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Activity size={13} className="text-green-500" />
                Live data · {analyzed} invoice{analyzed !== 1 ? "s" : ""} analyzed
              </div>
            )}
          </div>

          {/* ── KPI stat cards ──────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total invoices"      value={loading ? "…" : total}           sub="Across your workspace"              color="slate"   />
            <StatCard label="High / Critical risk" value={loading ? "…" : critHigh}        sub={`of ${analyzed} analyzed`}          color="rose"    />
            <StatCard label="Detection rate"      value={loading ? "…" : `${detectionRate}%`} sub="High/critical of analyzed"       color="amber"   />
            <StatCard label="Avg. invoice value"  value={loading ? "…" : (avgAmt === "—" ? "—" : `₹${parseFloat(avgAmt).toLocaleString("en-IN")}`)} sub="Across all invoices" color="indigo" />
            <StatCard label="Avg. risk score"     value={loading ? "…" : (stats?.average_risk_score ?? "—")} sub="0–100 weighted score" color="emerald" />
          </div>

          {/* ── Risk distribution + Trend chart ─────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Risk Distribution" sub="Breakdown of analyzed invoices by risk level" />
              {loading ? <p className="text-xs text-slate-400">Loading…</p> : <RiskDistribution distribution={dist} />}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionHeader title="Fraud Detection Trend" sub={`Daily detections over last ${trendWindow} days`} />
                <div className="flex gap-1">
                  {[7, 30].map((d) => (
                    <button key={d} type="button"
                      onClick={() => setTrendWindow(d)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${trendWindow === d ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <p className="text-xs text-slate-400">Loading…</p> : <TrendChart trends={trendData} days={trendWindow} />}
            </section>
          </div>

          {/* ── Fraud signals + Vendor risk ──────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader title="Most Common Fraud Signals" sub="Which detection rules fire most often" />
              {loading
                ? <p className="text-xs text-slate-400">Loading…</p>
                : <SignalsChart signals={stats?.most_common_fraud_types || []} />}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionHeader title="Risk Summary" sub="Quick numbers" />
              </div>
              {loading ? <p className="text-xs text-slate-400">Loading…</p> : (
                <div className="space-y-3">
                  {[
                    { label: "Critical invoices",  val: stats?.critical_risk_count ?? 0, color: "bg-rose-500" },
                    { label: "High risk invoices",  val: stats?.high_risk_count ?? 0,     color: "bg-orange-500" },
                    { label: "Medium risk invoices",val: stats?.medium_risk_count ?? 0,   color: "bg-amber-400" },
                    { label: "Low risk invoices",   val: stats?.low_risk_count ?? 0,      color: "bg-green-500" },
                  ].map(({ label, val, color }) => {
                    const pct = analyzed > 0 ? (val / analyzed) * 100 : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-36 text-xs text-slate-500">{label}</span>
                        <div className="flex-1">
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="w-6 text-right text-xs font-bold text-slate-700">{val}</span>
                      </div>
                    );
                  })}
                  <div className="mt-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total analyzed</span>
                      <span className="font-bold text-slate-800">{analyzed}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Average risk score</span>
                      <span className="font-bold text-slate-800">{stats?.average_risk_score ?? "—"}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Vendor risk table ────────────────────────────────────────── */}
          {vendors.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Vendor Risk Ranking</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Top {vendors.length} vendors by average risk score</p>
                </div>
                <Link to="/dashboard/fraud-detection"
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                  Full report →
                </Link>
              </div>
              {loading
                ? <p className="px-5 py-6 text-xs text-slate-400">Loading…</p>
                : <VendorRiskTable vendors={vendors} />}
            </section>
          )}

        </section>
      </div>
    </main>
  );
}
