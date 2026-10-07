import { Activity, BarChart3, Bell, RefreshCw, Search, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

/* ── shared ────────────────────────────────────────────────────────────────── */
const RISK_BAR  = { CRITICAL:"bg-rose-500",   HIGH:"bg-orange-500", MEDIUM:"bg-amber-400",  LOW:"bg-emerald-500" };
const RISK_BADGE= { CRITICAL:"bg-rose-50 text-rose-600 border-rose-200", HIGH:"bg-orange-50 text-orange-600 border-orange-200", MEDIUM:"bg-amber-50 text-amber-600 border-amber-200", LOW:"bg-emerald-50 text-emerald-600 border-emerald-200" };
const RISK_RING = { CRITICAL:"text-rose-600", HIGH:"text-orange-500", MEDIUM:"text-amber-500", LOW:"text-emerald-600" };

// Derive risk color from a 0-100 score
function scoreColor(score) {
  if (score === null || score === undefined || score === "—") return "text-slate-600";
  const n = parseFloat(score);
  if (n >= 75) return "text-rose-600";
  if (n >= 50) return "text-orange-500";
  if (n >= 25) return "text-amber-500";
  return "text-emerald-600";
}

function Empty({ icon:Icon, msg }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-300 shadow-sm"><Icon size={18}/></div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{msg}</p>
      <p className="mt-1 text-[11px] text-slate-400">Upload &amp; analyse invoices to see data</p>
    </div>
  );
}

function StatCard({ label, value, sub, color="slate", scoreValue }) {
  // If scoreValue provided, derive color dynamically from the score
  const c = scoreValue !== undefined
    ? scoreColor(scoreValue)
    : ({slate:"text-slate-900",rose:"text-rose-600",emerald:"text-emerald-600",indigo:"text-indigo-600",amber:"text-amber-600"}[color]??"text-slate-900");
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${c}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </article>
  );
}

/* ── Risk distribution stacked bar ──────────────────────────────────────────── */
function RiskDist({ dist }) {
  if (!dist||dist.total_analyzed===0) return <Empty icon={ShieldCheck} msg="No risk distribution yet"/>;
  const levels = ["CRITICAL","HIGH","MEDIUM","LOW"];
  return (
    <div className="space-y-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {levels.map(l=>{ const p=dist.distribution[l]?.percentage||0; return p>0?<div key={l} className={`${RISK_BAR[l]}`} style={{width:`${p}%`}} title={`${l}: ${p}%`}/>:null; })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {levels.map(l=>{
          const d=dist.distribution[l]||{count:0,percentage:0};
          return (
            <div key={l} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${RISK_BADGE[l]}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${RISK_BAR[l]}`}/>
                <span className={`text-xs font-semibold ${RISK_RING[l]}`}>{l}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-700">{d.count}</span>
                <span className="ml-1 text-[10px] text-slate-400">({d.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-right text-[11px] text-slate-400">{dist.total_analyzed} invoices analyzed</p>
    </div>
  );
}

/* ── Trend bar chart ─────────────────────────────────────────────────────────── */
function TrendChart({ trends }) {
  if (!trends?.length) return <Empty icon={TrendingUp} msg="No trend data available"/>;

  const max = Math.max(...trends.map(d => d.total), 1);

  return (
    <div>
      {/* bars — fixed height container so bars always render */}
      <div className="flex h-40 items-end gap-1">
        {trends.map(day => {
          const heightPct = Math.max((day.total / max) * 100, day.total > 0 ? 6 : 2);
          const col = day.CRITICAL > 0 ? "bg-rose-500"
                    : day.HIGH     > 0 ? "bg-orange-400"
                    : day.MEDIUM   > 0 ? "bg-amber-400"
                    :                    "bg-emerald-400";
          return (
            <div key={day.date} className="group relative flex flex-1 flex-col items-center justify-end">
              {/* tooltip */}
              <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                {new Date(day.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}: {day.total}
              </div>
              {/* bar */}
              <div
                className={`w-full min-h-[3px] rounded-t-md ${col} transition-all duration-300`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* date labels below — separate row, no height impact on bars */}
      <div className="mt-1 flex gap-1">
        {trends.map(day => (
          <div key={day.date} className="flex flex-1 justify-center">
            <span className="text-[8px] text-slate-400 leading-tight text-center">
              {new Date(day.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short" })}
            </span>
          </div>
        ))}
      </div>

      {/* legend */}
      <div className="mt-3 flex gap-4 text-[11px] text-slate-400">
        {[["bg-rose-500","Critical"],["bg-orange-400","High"],["bg-amber-400","Medium"],["bg-emerald-400","Low"]].map(([c,l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c}`}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Signals horizontal bar ──────────────────────────────────────────────────── */
function Signals({ signals }) {
  if (!signals?.length) return <Empty icon={ShieldAlert} msg="No fraud signals recorded"/>;
  const max = signals[0]?.count||1;
  return (
    <div className="space-y-3">
      {signals.map(s=>(
        <div key={s.code} className="flex items-center gap-3">
          <span className="w-44 truncate text-xs text-slate-500" title={s.code}>{s.code.replace(/_/g," ")}</span>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{width:`${(s.count/max)*100}%`}}/>
            </div>
          </div>
          <span className="w-6 text-right text-xs font-bold text-slate-600">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Vendor table ────────────────────────────────────────────────────────────── */
function rlvl(s) { return s>=75?"CRITICAL":s>=50?"HIGH":s>=25?"MEDIUM":"LOW"; }

function VendorTable({ vendors }) {
  if (!vendors?.length) return <Empty icon={BarChart3} msg="No vendor risk data"/>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <tr>{["Vendor","Invoices","Analyzed","Avg Score","Level","High/Crit Flags"].map(c=><th key={c} className="px-5 py-3">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {vendors.map(v=>{
            const l=rlvl(v.average_risk_score);
            return (
              <tr key={v.vendor_id} className="transition hover:bg-indigo-50/30">
                <td className="px-5 py-3 text-xs font-semibold text-slate-700">{v.vendor_name}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{v.total_invoices}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{v.analyzed_invoices}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${RISK_BAR[l]}`} style={{width:`${v.average_risk_score}%`}}/>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{v.average_risk_score.toFixed(1)}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${RISK_BADGE[l]}`}>{l}</span>
                </td>
                <td className="px-5 py-3 text-xs font-bold text-slate-600">{v.high_critical_flags}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────────── */
export default function Analytics() {
  const [stats,   setStats]    = useState(null);
  const [dist,    setDist]     = useState(null);
  const [t30,     setT30]      = useState([]);
  const [t7,      setT7]       = useState([]);
  const [vendors, setVendors]  = useState([]);
  const [invoices,setInvoices] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [refreshing,setRef]    = useState(false);
  const [window,  setWindow]   = useState(30);

  async function load() {
    const [sR,dR,t30R,t7R,vR,iR] = await Promise.allSettled([
      apiClient.get("/fraud/statistics"),
      apiClient.get("/fraud/risk-distribution"),
      apiClient.get("/fraud/fraud-trends?days=30"),
      apiClient.get("/fraud/fraud-trends?days=7"),
      apiClient.get("/fraud/vendor-risk-summary?limit=10"),
      apiClient.get("/invoices/"),
    ]);
    if (sR.status==="fulfilled") setStats(sR.value.data);
    if (dR.status==="fulfilled") setDist(dR.value.data);
    if (t30R.status==="fulfilled") setT30(t30R.value.data.trends||[]);
    if (t7R.status==="fulfilled")  setT7(t7R.value.data.trends||[]);
    if (vR.status==="fulfilled")   setVendors(vR.value.data.top_risky_vendors||[]);
    if (iR.status==="fulfilled")   setInvoices(iR.value.data);
    setLoading(false); setRef(false);
  }

  useEffect(()=>{ load(); },[]);
  const refresh = ()=>{ setRef(true); load(); };

  const total     = invoices.length;
  const analyzed  = stats?.total_invoices_analyzed??0;
  const critHigh  = stats ? stats.critical_risk_count+stats.high_risk_count : 0;
  const amounts   = invoices.map(i=>parseFloat(i.total_amount||0)).filter(Boolean);
  const avgAmt    = amounts.length ? (amounts.reduce((a,b)=>a+b,0)/amounts.length).toFixed(0) : null;
  const trendData = window===7?t7:t30;

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Workspace intelligence</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Fraud Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} type="button"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={15}/>
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700"><Search size={15}/></button>
            <button type="button" className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
              <Bell size={15}/>
              {critHigh>0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500"/>}
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-7 sm:px-8">

          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">See what needs attention</h2>
              <p className="mt-1 text-sm text-slate-400">Invoice risk across your organization</p>
            </div>
            {!loading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Activity size={12} className="text-emerald-500"/> Live · {analyzed} analyzed
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total invoices"       value={loading?"…":total}          sub="In your workspace"            color="slate"  />
            <StatCard label="High / Critical"      value={loading?"…":critHigh}       sub={`of ${analyzed} analyzed`}    color="rose"   />
            <StatCard label="Detection rate"       value={loading?"…":analyzed>0?`${((critHigh/analyzed)*100).toFixed(1)}%`:"—"} sub="High/critical of analyzed" color="amber"/>
            <StatCard label="Avg. invoice value"   value={loading?"…":avgAmt?`₹${parseInt(avgAmt).toLocaleString("en-IN")}`:"—"} sub="Across all invoices" color="indigo"/>
            <StatCard label="Avg. risk score"      value={loading?"…":stats?.average_risk_score??"—"} sub="0–100 scale" scoreValue={stats?.average_risk_score}/>
          </div>

          {/* Distribution + Trend */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Risk Distribution</h2>
              {loading?<p className="text-xs text-slate-400">Loading…</p>:<RiskDist dist={dist}/>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Fraud Trend</h2>
                <div className="flex gap-1">
                  {[7,30].map(d=>(
                    <button key={d} type="button" onClick={()=>setWindow(d)}
                      className={`rounded-xl px-3 py-1 text-[11px] font-semibold transition-colors ${window===d?"bg-indigo-500 text-white shadow-sm":"bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              {loading?<p className="text-xs text-slate-400">Loading…</p>:<TrendChart trends={trendData}/>}
            </section>
          </div>

          {/* Signals + Summary */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Most Common Fraud Signals</h2>
              {loading?<p className="text-xs text-slate-400">Loading…</p>:<Signals signals={stats?.most_common_fraud_types||[]}/>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Risk Summary</h2>
              {loading?<p className="text-xs text-slate-400">Loading…</p>:(
                <div className="space-y-3">
                  {[["Critical",stats?.critical_risk_count??0,"bg-rose-500"],["High",stats?.high_risk_count??0,"bg-orange-500"],["Medium",stats?.medium_risk_count??0,"bg-amber-400"],["Low",stats?.low_risk_count??0,"bg-emerald-500"]].map(([l,v,c])=>(
                    <div key={l} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-slate-500">{l}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${c}`} style={{width:analyzed>0?`${(v/analyzed)*100}%`:"0%"}}/>
                      </div>
                      <span className="w-6 text-right text-xs font-bold text-slate-700">{v}</span>
                    </div>
                  ))}
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-1.5">
                    {[["Total analyzed",analyzed],["Avg risk score",stats?.average_risk_score??"—"]].map(([l,v])=>(
                      <div key={l} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{l}</span>
                        <span className="font-bold text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Vendor table */}
          {vendors.length>0 && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Vendor Risk Ranking</h2>
                  <p className="mt-0.5 text-xs text-slate-400">Top {vendors.length} vendors by average risk score</p>
                </div>
                <Link to="/dashboard/fraud-detection" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Full report →</Link>
              </div>
              {loading?<p className="px-6 py-6 text-xs text-slate-400">Loading…</p>:<VendorTable vendors={vendors}/>}
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
