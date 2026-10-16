import { Activity, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";
import NotificationBell from "../../../components/NotificationBell";

/* ── helpers ──────────────────────────────────────────────────────────────── */
function fmt(v) { return v == null ? "—" : v; }

/* ── KPI Card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, valueColor = "text-slate-900", sub }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </article>
  );
}

/* ── Custom Tooltip ──────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1.5 font-semibold text-slate-700">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }}/>
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-700">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Amount buckets ──────────────────────────────────────────────────────── */
function buildAmountBuckets(invoices) {
  const buckets = [
    { name: "<₹10K",      min: 0,     max: 10000,  count: 0 },
    { name: "₹10–50K",   min: 10000, max: 50000,  count: 0 },
    { name: "₹50K–1L",   min: 50000, max: 100000, count: 0 },
    { name: "₹1L–5L",    min: 100000,max: 500000, count: 0 },
    { name: ">₹5L",      min: 500000,max: Infinity,count: 0 },
  ];
  invoices.forEach(inv => {
    const a = parseFloat(inv.total_amount || 0);
    const b = buckets.find(b => a >= b.min && a < b.max);
    if (b) b.count++;
  });
  return buckets.map(b => ({ name: b.name, Invoices: b.count }));
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function Analytics() {
  const [stats,    setStats]    = useState(null);
  const [dist,     setDist]     = useState(null);
  const [trends,   setTrends]   = useState([]);
  const [vendors,  setVendors]  = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRef]    = useState(false);
  const [window,   setWindow]   = useState(30);
  const [t30,      setT30]      = useState([]);
  const [t7,       setT7]       = useState([]);

  async function load() {
    const [sR, dR, t30R, t7R, vR, iR] = await Promise.allSettled([
      apiClient.get("/fraud/statistics"),
      apiClient.get("/fraud/risk-distribution"),
      apiClient.get("/fraud/fraud-trends?days=30"),
      apiClient.get("/fraud/fraud-trends?days=7"),
      apiClient.get("/fraud/vendor-risk-summary?limit=6"),
      apiClient.get("/invoices/"),
    ]);
    if (sR.status  === "fulfilled") setStats(sR.value.data);
    if (dR.status  === "fulfilled") setDist(dR.value.data);
    if (t30R.status === "fulfilled") setT30(t30R.value.data.trends || []);
    if (t7R.status  === "fulfilled") setT7(t7R.value.data.trends   || []);
    if (vR.status  === "fulfilled") setVendors(vR.value.data.top_risky_vendors || []);
    if (iR.status  === "fulfilled") setInvoices(iR.value.data);
    setLoading(false); setRef(false);
  }

  useEffect(() => { load(); }, []);
  const refresh = () => { setRef(true); load(); };

  const trendData = (window === 7 ? t7 : t30).map(d => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    Total:    d.total,
    HighRisk: d.HIGH + d.CRITICAL,
  }));

  const total    = invoices.length;
  const analyzed = stats?.total_invoices_analyzed ?? 0;
  const critHigh = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const amounts  = invoices.map(i => parseFloat(i.total_amount || 0)).filter(Boolean);
  const avgAmt   = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : null;
  const detRate  = analyzed > 0 ? `${((critHigh / analyzed) * 100).toFixed(1)}%` : "—";

  // Donut data
  const donutData = dist ? [
    { name: "High Risk",  value: (dist.distribution?.CRITICAL?.count || 0) + (dist.distribution?.HIGH?.count || 0),    color: "#ef4444" },
    { name: "Low Risk",   value: dist.distribution?.LOW?.count    || 0, color: "#22c55e" },
    { name: "Medium Risk",value: dist.distribution?.MEDIUM?.count || 0, color: "#f59e0b" },
  ].filter(d => d.value > 0) : [];

  // Vendor bar data
  const vendorData = vendors.slice(0, 6).map(v => ({
    name: v.vendor_name?.split(" ").slice(0, 2).join(" ") || "Unknown",
    "Avg Risk": parseFloat(v.average_risk_score || 0),
  })).reverse();

  // Amount buckets
  const amountData = buildAmountBuckets(invoices);

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Workspace intelligence</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Fraud Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
              <Activity size={11} className="text-emerald-500"/> Live · {analyzed} analyzed
            </div>
            <button onClick={refresh} type="button"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition ${refreshing ? "animate-spin" : ""}`}>
              <RefreshCw size={15}/>
            </button>
            <NotificationBell/>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-8">

          {/* ── KPI row ──────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Total Invoices"    value={loading ? "…" : total}    sub="In your workspace"/>
            <KpiCard label="Fraudulent Invoices" value={loading ? "…" : critHigh}
              valueColor="text-rose-600" sub={`of ${analyzed} analyzed`}/>
            <KpiCard label="Detection Rate"    value={loading ? "…" : detRate}
              valueColor="text-emerald-600" sub="High / critical of analyzed"/>
            <KpiCard label="Avg Invoice Value" value={loading ? "…" : avgAmt ? `₹${avgAmt.toLocaleString("en-IN")}` : "—"}
              valueColor="text-indigo-600" sub="Across all invoices"/>
            <KpiCard label="Avg Risk Score"
              value={loading ? "…" : stats?.average_risk_score ?? "—"}
              valueColor={stats?.average_risk_score >= 50 ? "text-rose-600" : stats?.average_risk_score >= 25 ? "text-amber-600" : "text-emerald-600"}
              sub="0–100 scale"/>
          </div>

          {/* ── Charts row 1: Line + Donut ────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">

            {/* Fraud Detection Trend */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Fraud Detection Trend</h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[7, 30].map(d => (
                      <button key={d} type="button" onClick={() => setWindow(d)}
                        className={`rounded-xl px-3 py-1 text-[11px] font-semibold transition ${window === d ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {d}d
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500"/>Total</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400"/>High Risk</span>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">Loading…</div>
              ) : trendData.every(d => d.Total === 0) ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                  Run fraud detection on invoices to see trend data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip content={<ChartTooltip/>} cursor={{ stroke: "rgba(99,102,241,0.1)", strokeWidth: 1 }}/>
                    <Line type="monotone" dataKey="Total" stroke="#ef4444" strokeWidth={2.5}
                      dot={<Dot r={3} fill="#ef4444" strokeWidth={0}/>} activeDot={{ r: 5 }}/>
                    <Line type="monotone" dataKey="HighRisk" stroke="#818cf8" strokeWidth={2}
                      dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2"/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Invoice Risk Distribution */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Invoice Risk Distribution</h2>
              {loading ? (
                <div className="flex h-52 items-center justify-center text-xs text-slate-400">Loading…</div>
              ) : donutData.length === 0 ? (
                <div className="flex h-52 items-center justify-center text-xs text-slate-400">No analyzed invoices</div>
              ) : (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="45%" innerRadius={65} outerRadius={90}
                        dataKey="value" strokeWidth={0} paddingAngle={2}>
                        {donutData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <Legend iconType="circle" iconSize={8}
                        formatter={v => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>}/>
                      <Tooltip content={<ChartTooltip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-2xl font-bold text-slate-900">{dist?.total_analyzed ?? 0}</p>
                    <p className="text-[10px] text-slate-400">total</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Charts row 2: Vendor + Amount ────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">

            {/* Fraud by Vendor */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Fraud by Vendor</h2>
              {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">Loading…</div>
              ) : vendorData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">No vendor data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={vendorData.length * 42 + 20}>
                  <BarChart data={vendorData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false}/>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]}/>
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTooltip/>} cursor={{ fill: "rgba(99,102,241,0.04)" }}/>
                    <Bar dataKey="Avg Risk" fill="#e8b84b" radius={[0, 4, 4, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            {/* Fraud by Invoice Amount */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Fraud by Invoice Amount</h2>
              {loading ? (
                <div className="flex h-48 items-center justify-center text-xs text-slate-400">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={amountData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                    barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false}/>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip content={<ChartTooltip/>} cursor={{ fill: "rgba(99,102,241,0.04)" }}/>
                    <Bar dataKey="Invoices" fill="#6366f1" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

        </div>
      </div>
    </main>
  );
}
