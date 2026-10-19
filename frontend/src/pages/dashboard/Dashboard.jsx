import {
  Activity, ChevronRight, CircleAlert,
  Clock3, FileText, FileUp, RefreshCw,
  ShieldAlert, ShieldCheck, TrendingDown, TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import apiClient from "../../api/client";
import Sidebar from "../Sidebar/Sidebar";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../../components/NotificationBell";

/* ── helpers ──────────────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  DOCUMENTS_UPLOADED:"bg-blue-50 text-blue-600 border-blue-200",
  PROCESSING:        "bg-amber-50 text-amber-600 border-amber-200",
  ANALYSIS_READY:    "bg-indigo-50 text-indigo-600 border-indigo-200",
  UNDER_REVIEW:      "bg-violet-50 text-violet-600 border-violet-200",
  DECIDED:           "bg-emerald-50 text-emerald-600 border-emerald-200",
  PROCESSING_FAILED: "bg-rose-50 text-rose-600 border-rose-200",
  DRAFT:             "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABEL = {
  DOCUMENTS_UPLOADED:"Uploaded", PROCESSING:"Processing",
  ANALYSIS_READY:"Ready", UNDER_REVIEW:"Under Review",
  DECIDED:"Decided", PROCESSING_FAILED:"Failed", DRAFT:"Draft",
};
const RISK_STYLE = {
  CRITICAL:"bg-rose-50 text-rose-600 border-rose-200",
  HIGH:    "bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM:  "bg-amber-50 text-amber-600 border-amber-200",
  LOW:     "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const ACTION_LABEL = {
  INVOICE_UPLOADED:"Invoice uploaded", INVOICE_EXTRACTED:"Text extracted",
  INVOICE_VALIDATED:"Validated", FRAUD_CHECK_RUN:"Fraud check run",
  INVOICE_STATUS_CHANGED:"Status changed", REVIEW_DECISION:"Review decision",
  USER_LOGIN:"User logged in", USER_LOGOUT:"User logged out",
};
const ACTION_DOT = {
  INVOICE_UPLOADED:"bg-blue-400", FRAUD_CHECK_RUN:"bg-orange-400",
  REVIEW_DECISION:"bg-emerald-500", INVOICE_STATUS_CHANGED:"bg-violet-400",
};

function Badge({ cls, children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"; }
function fmtAmt(v,c) { return v==null?"—":`${c||""} ${parseFloat(v).toLocaleString("en-IN",{minimumFractionDigits:2})}`.trim(); }

/* ── Metric Card ─────────────────────────────────────────────────────────── */
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, sub, subColor = "text-emerald-600", loading }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${iconBg}`}>
          <Icon size={17} strokeWidth={2} className={iconColor}/>
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {loading ? <span className="text-slate-300">…</span> : value}
      </p>
      {sub && (
        <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${subColor}`}>
          {sub}
        </p>
      )}
    </article>
  );
}

/* ── Area Chart ──────────────────────────────────────────────────────────── */
function InvoiceAreaChart({ trends }) {
  if (!trends?.length) return (
    <div className="flex h-48 items-center justify-center text-xs text-slate-400">
      Run fraud detection to see trends
    </div>
  );

  const data = trends.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    Analyzed: d.total,
    HighRisk: d.HIGH + d.CRITICAL,
    Clean:    d.LOW,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
        <p className="mb-2 font-semibold text-slate-700">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2 mb-0.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }}/>
            <span className="text-slate-500">{p.name}:</span>
            <span className="font-bold text-slate-700">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorAnalyzed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#9fc61c" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="#9fc61c" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorHighRisk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false}/>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9b9a8b" }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize: 10, fill: "#9b9a8b" }} axisLine={false} tickLine={false} allowDecimals={false}/>
        <Tooltip content={<CustomTooltip/>} cursor={{ stroke: "rgba(99,102,241,0.15)", strokeWidth: 1 }}/>
        <Area type="monotone" dataKey="Analyzed" stroke="#9fc61c" strokeWidth={2} fill="url(#colorAnalyzed)" dot={false}/>
        <Area type="monotone" dataKey="HighRisk"  stroke="#ef4444" strokeWidth={2} fill="url(#colorHighRisk)" dot={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Donut Chart ─────────────────────────────────────────────────────────── */
function FraudDonut({ stats }) {
  if (!stats || stats.total_invoices_analyzed === 0) return (
    <div className="flex h-48 items-center justify-center text-xs text-slate-400">
      No analyzed invoices yet
    </div>
  );

  const data = [
    { name: "High Risk", value: stats.critical_risk_count + stats.high_risk_count, color: "#ef4444" },
    { name: "Suspicious", value: stats.medium_risk_count, color: "#f59e0b" },
    { name: "Verified",   value: stats.low_risk_count, color: "#22c55e" },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-6" fontSize="22" fontWeight="700" style={{ fill: "var(--text-primary)" }}>{total}</tspan>
      <tspan x={cx} dy="20" fontSize="11" fill="#9b9a8b">analyzed</tspan>
    </text>
  );

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
          dataKey="value" labelLine={false} label={<CustomLabel/>}>
          {data.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0}/>)}
        </Pie>
        <Legend
          iconType="circle" iconSize={8}
          formatter={(value) => <span style={{ fontSize: 11, color: "#77766a" }}>{value}</span>}
        />
        <Tooltip formatter={(v, n) => [v, n]}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user }                    = useAuth();
  const [invoices,  setInvoices]    = useState([]);
  const [stats,     setStats]       = useState(null);
  const [highRisk,  setHighRisk]    = useState([]);
  const [trends,    setTrends]      = useState([]);
  const [audit,     setAudit]       = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [refreshing,setRefreshing]  = useState(false);

  async function load() {
    const [iR,sR,rR,tR,aR] = await Promise.allSettled([
      apiClient.get("/invoices/"),
      apiClient.get("/fraud/statistics"),
      apiClient.get("/fraud/high-risk-invoices?min_risk_level=HIGH&limit=5"),
      apiClient.get("/fraud/fraud-trends?days=14"),
      apiClient.get("/audit/?limit=6"),
    ]);
    if (iR.status==="fulfilled") setInvoices(iR.value.data);
    if (sR.status==="fulfilled") setStats(sR.value.data);
    if (rR.status==="fulfilled") setHighRisk(rR.value.data);
    if (tR.status==="fulfilled") setTrends(tR.value.data.trends||[]);
    if (aR.status==="fulfilled") setAudit(aR.value.data);
    setLoading(false); setRefreshing(false);
  }

  useEffect(()=>{ load(); },[]);
  const refresh = ()=>{ setRefreshing(true); load(); };
  const hardRefresh = ()=>{ window.location.reload(); };

  const total    = invoices.length;
  const pending  = invoices.filter(i=>["ANALYSIS_READY","UNDER_REVIEW"].includes(i.status)).length;
  const decided  = invoices.filter(i=>i.status==="DECIDED").length;
  const critHigh = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const analyzed = stats?.total_invoices_analyzed ?? 0;
  const fraudRate = analyzed > 0 ? ((critHigh / analyzed) * 100).toFixed(1) : null;

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <div className="min-w-0 flex-1">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              {user?.name ? `Hello, ${user.name.split(" ")[0]} 👋` : "Dashboard"}
            </h1>
            <p className="text-xs text-slate-400">Live overview of your invoice pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={hardRefresh} type="button"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-indigo-300 hover:text-indigo-600 ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={15}/>
            </button>
            <NotificationBell />
            <Link to="/dashboard/upload-invoice"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
              <FileUp size={15}/> Upload Invoice
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 sm:px-8">

          {/* ── KPI Cards ────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Invoices"  value={total}    loading={loading}
              icon={FileText}    iconBg="bg-blue-50"    iconColor="text-blue-600"
              sub={`${decided} decided`} subColor="text-slate-400"/>
            <MetricCard label="Processed"       value={analyzed} loading={loading}
              icon={ShieldCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              sub={analyzed > 0 ? `+${analyzed} analyzed` : "Run fraud check"} subColor="text-emerald-600"/>
            <MetricCard label="Potential Fraud" value={critHigh} loading={loading}
              icon={CircleAlert} iconBg="bg-rose-50"    iconColor="text-rose-600"
              sub={pending > 0 ? `${pending} awaiting review` : "No pending reviews"} subColor="text-amber-500"/>
            <MetricCard label="Fraud Rate"      value={fraudRate ? `${fraudRate}%` : "—"} loading={loading}
              icon={TrendingDown} iconBg="bg-violet-50" iconColor="text-violet-600"
              sub={`avg score ${stats?.average_risk_score ?? "—"}`} subColor="text-slate-400"/>
          </div>

          {/* ── Charts row ───────────────────────────────────────────── */}
          <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">

            {/* Area chart */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Invoice Processing Overview</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Fraud detections over last 14 days</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500"/>Analyzed</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500"/>High Risk</span>
                </div>
              </div>
              <InvoiceAreaChart trends={trends}/>
            </section>

            {/* Donut chart */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-2">
                <h2 className="font-semibold text-slate-900">Fraud Detection Summary</h2>
                <p className="mt-0.5 text-xs text-slate-400">Distribution by risk level</p>
              </div>
              <FraudDonut stats={stats}/>
            </section>
          </div>

          {/* ── Bottom row: Recent Invoices + Activity ───────────────── */}
          <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">

            {/* Recent Invoices */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Recent Invoices</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Latest activity in your workspace</p>
                </div>
                <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View all →</Link>
              </div>
              {loading ? (
                <p className="px-6 py-8 text-sm text-slate-400">Loading…</p>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-semibold text-slate-500">No invoices yet</p>
                  <Link to="/dashboard/upload-invoice" className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Upload your first invoice →</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left">
                    <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <tr>
                        {["Invoice No.","Vendor","Amount","Status",""].map(c=>(
                          <th key={c} className="px-5 py-3">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invoices.slice(0,6).map(inv=>(
                        <tr key={inv.id} className="transition hover:bg-slate-50/60">
                          <td className="px-5 py-3.5">
                            <p className="text-xs font-semibold text-slate-700">{inv.invoice_number||"—"}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{fmt(inv.invoice_date)}</p>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">{inv.vendor_name||<span className="text-slate-300">Unknown</span>}</td>
                          <td className="px-5 py-3.5 text-xs font-medium text-slate-800">{fmtAmt(inv.total_amount,inv.currency)}</td>
                          <td className="px-5 py-3.5"><Badge cls={STATUS_STYLE[inv.status]||STATUS_STYLE.DRAFT}>{STATUS_LABEL[inv.status]||inv.status}</Badge></td>
                          <td className="px-5 py-3.5">
                            <Link to={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                              View<ChevronRight size={13}/>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Activity feed */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Recent Activity</h2>
                <Link to="/dashboard/audit" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Full log →</Link>
              </div>
              {audit.length === 0 ? (
                <p className="text-xs text-slate-400">No activity yet</p>
              ) : (
                <ul className="space-y-3.5">
                  {audit.map(e=>(
                    <li key={e.id} className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[e.action]||"bg-slate-300"}`}/>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{ACTION_LABEL[e.action]||e.action}</span>
                          {e.invoice_id&&<span className="text-slate-400"> · #{e.invoice_id}</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {new Date(e.timestamp).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* High risk alerts below activity */}
              {highRisk.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">Open Alerts</p>
                    <Link to="/dashboard/fraud-detection" className="text-[11px] font-semibold text-rose-600">View all →</Link>
                  </div>
                  <div className="space-y-2">
                    {highRisk.slice(0,3).map(inv=>(
                      <Link key={inv.invoice_id} to={`/dashboard/invoices/${inv.invoice_id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition hover:border-rose-200 hover:bg-rose-50/30">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-700">#{inv.invoice_id} {inv.vendor_name||""}</p>
                          <p className="text-[10px] text-slate-400">Score {inv.risk_score?.toFixed(1)}</p>
                        </div>
                        <Badge cls={RISK_STYLE[inv.risk_level]||""}>{inv.risk_level}</Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
