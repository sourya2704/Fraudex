import {
  Activity, Bell, ChevronRight, CircleAlert,
  Clock3, FileUp, RefreshCw, Search,
  ShieldAlert, ShieldCheck, TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import Sidebar from "../Sidebar/Sidebar";
import { useAuth } from "../../context/AuthContext";

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
  USER_LOGIN:"User logged in", USER_LOGOUT:"User logged out", USER_REGISTERED:"User registered",
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

/* ── Sparkline ────────────────────────────────────────────────────────────── */
function Sparkline({ trends }) {
  if (!trends?.length) return (
    <div className="flex h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
      No trend data — run fraud detection on invoices
    </div>
  );
  const last7 = trends.slice(-7);
  const max   = Math.max(...last7.map(d => d.total), 1);
  return (
    <div>
      {/* bars */}
      <div className="flex h-32 items-end gap-1.5">
        {last7.map(day => {
          const heightPct = Math.max((day.total / max) * 100, day.total > 0 ? 6 : 2);
          const col = day.CRITICAL > 0 ? "bg-rose-500"
                    : day.HIGH     > 0 ? "bg-orange-400"
                    : day.MEDIUM   > 0 ? "bg-amber-400"
                    :                    "bg-emerald-400";
          return (
            <div key={day.date} className="group relative flex flex-1 flex-col items-end justify-end">
              <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-white shadow group-hover:block">
                {new Date(day.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}: {day.total}
              </div>
              <div
                className={`w-full min-h-[3px] rounded-t-md ${col} transition-all duration-300`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* date labels */}
      <div className="mt-1 flex gap-1.5">
        {last7.map(day => (
          <div key={day.date} className="flex flex-1 justify-center">
            <span className="text-[8px] text-slate-400">
              {new Date(day.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
            </span>
          </div>
        ))}
      </div>
    </div>
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
      apiClient.get("/fraud/high-risk-invoices?min_risk_level=HIGH&limit=8"),
      apiClient.get("/fraud/fraud-trends?days=14"),
      apiClient.get("/audit/?limit=8"),
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

  const total    = invoices.length;
  const pending  = invoices.filter(i=>["ANALYSIS_READY","UNDER_REVIEW"].includes(i.status)).length;
  const decided  = invoices.filter(i=>i.status==="DECIDED").length;
  const critHigh = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const failed   = invoices.filter(i=>i.status==="PROCESSING_FAILED").length;

  const METRICS = [
    { label:"Total Invoices",  val:total,    Icon:FileUp,     from:"from-blue-500",   to:"to-indigo-600",  textColor:"text-blue-600"    },
    { label:"Awaiting Review", val:pending,  Icon:Clock3,     from:"from-amber-400",  to:"to-orange-500",  textColor:"text-amber-600"   },
    { label:"High / Critical", val:critHigh, Icon:CircleAlert,from:"from-rose-500",   to:"to-pink-600",    textColor:"text-rose-600"    },
    { label:"Decided",         val:decided,  Icon:ShieldCheck,from:"from-emerald-500",to:"to-teal-500",    textColor:"text-emerald-600" },
  ];

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar />
      <div className="min-w-0 flex-1">

        {/* ── Top bar ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-xs text-slate-400">Live overview of your invoice pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} type="button" title="Refresh"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-indigo-300 hover:text-indigo-600 ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={15}/>
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
              <Search size={15}/>
            </button>
            <button type="button" className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
              <Bell size={15}/>
              {critHigh>0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500"/>}
            </button>
            <Link to="/dashboard/upload-invoice"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40">
              <FileUp size={15}/> Upload Invoice
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 sm:px-8">

          {/* ── Metric cards ──────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map(({ label, val, Icon, from, to, textColor }) => (
              <article key={label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                {/* gradient bar top */}
                <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${from} ${to}`}/>
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${from} ${to} shadow-sm`}>
                    <Icon size={17} strokeWidth={2} className="text-white"/>
                  </div>
                </div>
                <p className={`mt-4 text-3xl font-bold tracking-tight ${textColor}`}>
                  {loading ? "…" : val}
                </p>
                {label==="High / Critical" && stats && (
                  <p className="mt-1 text-xs text-slate-400">avg score {stats.average_risk_score}</p>
                )}
                {label==="Total Invoices" && failed>0 && (
                  <p className="mt-1 text-xs text-rose-400">{failed} failed</p>
                )}
              </article>
            ))}
          </div>

          {/* ── Sparkline + Alerts ────────────────────────────────────── */}
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">

            {/* Sparkline */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Risk Activity</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Fraud detections over last 14 days</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                  <TrendingUp size={11}/> Live
                </span>
              </div>
              <Sparkline trends={trends}/>
              <div className="mt-4 flex gap-4 text-[11px] text-slate-400">
                {[["bg-rose-500","Critical"],["bg-orange-400","High"],["bg-amber-400","Medium"],["bg-emerald-400","Low"]].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${c}`}/>{l}</span>
                ))}
              </div>
            </section>

            {/* Alerts */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Open Alerts</h2>
                  <p className="mt-0.5 text-xs text-slate-400">High / Critical invoices</p>
                </div>
                <Link to="/dashboard/fraud-detection" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  View all →
                </Link>
              </div>

              {loading && <p className="text-xs text-slate-400">Loading…</p>}
              {!loading && highRisk.length===0 && (
                <div className="flex min-h-40 flex-col items-center justify-center text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-400">
                    <ShieldCheck size={22}/>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-600">No open alerts</p>
                  <p className="mt-1 text-xs text-slate-400">Run fraud detection to populate this</p>
                </div>
              )}
              <div className="space-y-2">
                {!loading && highRisk.slice(0,5).map(inv=>(
                  <Link key={inv.invoice_id} to={`/dashboard/invoices/${inv.invoice_id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/30">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {inv.vendor_name||"Unknown vendor"} #{inv.invoice_id}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Score {inv.risk_score?.toFixed(1)}</p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <Badge cls={RISK_STYLE[inv.risk_level]||""}>{inv.risk_level}</Badge>
                      <ChevronRight size={13} className="text-slate-300"/>
                    </div>
                  </Link>
                ))}
              </div>
              {!loading && highRisk.length>0 && (
                <Link to="/dashboard/fraud-detection"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600">
                  <ShieldAlert size={13}/> Review all alerts
                </Link>
              )}
            </section>
          </div>

          {/* ── Recent invoices ───────────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">Recent Invoices</h2>
                <p className="mt-0.5 text-xs text-slate-400">Latest activity in your workspace</p>
              </div>
              <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View all →</Link>
            </div>
            {loading ? (
              <p className="px-6 py-10 text-sm text-slate-400">Loading…</p>
            ) : invoices.length===0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-semibold text-slate-500">No invoices yet</p>
                <Link to="/dashboard/upload-invoice" className="text-xs font-semibold text-indigo-600 hover:underline">Upload your first invoice →</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      {["#","Invoice No.","Vendor","Date","Amount","Status",""].map(c=>(
                        <th key={c} className="px-5 py-3">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.slice(0,6).map(inv=>(
                      <tr key={inv.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-400">#{inv.id}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">{inv.invoice_number||<span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">{inv.vendor?.name||<span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{fmt(inv.invoice_date)}</td>
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

          {/* ── Activity feed ─────────────────────────────────────────── */}
          {audit.length>0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Recent Activity</h2>
                <Link to="/dashboard/audit" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Full audit log →</Link>
              </div>
              <ul className="space-y-3">
                {audit.map(e=>(
                  <li key={e.id} className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[e.action]||"bg-slate-300"}`}/>
                    <div>
                      <p className="text-xs text-slate-700">
                        <span className="font-semibold">{ACTION_LABEL[e.action]||e.action}</span>
                        {e.invoice_id&&<span className="text-slate-400"> · Invoice #{e.invoice_id}</span>}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {new Date(e.timestamp).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
