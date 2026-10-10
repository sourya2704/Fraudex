import {
  Bell, ChevronRight, FileWarning, RefreshCw,
  Search, ShieldAlert, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

/* ── constants ────────────────────────────────────────────────────────────── */
const RISK = {
  CRITICAL: { badge:"bg-rose-50 text-rose-600 border-rose-200",   bar:"bg-rose-500",   glow:"shadow-rose-500/20",   ring:"ring-rose-200" },
  HIGH:     { badge:"bg-orange-50 text-orange-600 border-orange-200", bar:"bg-orange-500", glow:"shadow-orange-500/15", ring:"ring-orange-200" },
  MEDIUM:   { badge:"bg-amber-50 text-amber-600 border-amber-200",  bar:"bg-amber-400",  glow:"shadow-amber-400/15",  ring:"ring-amber-200" },
  LOW:      { badge:"bg-emerald-50 text-emerald-600 border-emerald-200", bar:"bg-emerald-500", glow:"", ring:"ring-emerald-200" },
};

function Badge({ level }) {
  const s = RISK[level]; if (!s) return null;
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${s.badge}`}>{level}</span>;
}

function RiskBar({ score }) {
  const p = Math.min(100, Math.max(0, score||0));
  const col = p>=75?"bg-rose-500":p>=50?"bg-orange-500":p>=25?"bg-amber-400":"bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${col} transition-all`} style={{width:`${p}%`}}/>
      </div>
      <span className="text-xs font-bold text-slate-600">{p.toFixed(0)}</span>
    </div>
  );
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
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
      const [sR,hR,dR] = await Promise.all([
        apiClient.get("/fraud/statistics"),
        apiClient.get("/fraud/high-risk-invoices?min_risk_level=MEDIUM&limit=100"),
        apiClient.get("/fraud/risk-distribution"),
      ]);
      setStats(sR.data); setHighRisk(hR.data); setDist(dR.data); setError(null);
    } catch(e) { setError(e.response?.data?.detail||"Failed to load fraud data"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(()=>{ load(); },[]);
  const refresh = ()=>{ setRefreshing(true); load(); };

  const visible = highRisk.filter(inv=>{
    const q = search.toLowerCase();
    const mS = !search||String(inv.invoice_id).includes(q)||(inv.invoice_number||"").toLowerCase().includes(q)||(inv.vendor_name||"").toLowerCase().includes(q);
    const mL = levelFilt==="All"||inv.risk_level===levelFilt;
    return mS&&mL;
  });

  const critHigh = stats ? stats.critical_risk_count + stats.high_risk_count : 0;
  const CARDS = [
    { label:"Critical / High Risk", val:loading?"…":critHigh,                         Icon:ShieldAlert,  from:"from-rose-500",   to:"to-pink-600",    textColor:"text-rose-600"    },
    { label:"Medium Risk",          val:loading?"…":stats?.medium_risk_count??"—",     Icon:TriangleAlert,from:"from-amber-400",  to:"to-orange-500",  textColor:"text-amber-600"   },
    { label:"Low Risk",             val:loading?"…":stats?.low_risk_count??"—",        Icon:FileWarning,  from:"from-emerald-500",to:"to-teal-500",    textColor:"text-emerald-600" },
    { label:"Total Analyzed",       val:loading?"…":stats?.total_invoices_analyzed??"—",Icon:ShieldCheck, from:"from-indigo-500", to:"to-violet-600",  textColor:"text-indigo-600"  },
  ];

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Fraud Detection</h1>
          <div className="flex items-center gap-2">
            <button onClick={refresh} type="button"
              className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={15}/>
            </button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700"><Bell size={15}/></button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-5 py-7 sm:px-8">

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
          )}

          {/* ── Summary cards ─────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {CARDS.map(({label,val,Icon,from,to,textColor})=>(
              <article key={label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${from} ${to}`}/>
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${from} ${to} shadow-sm`}>
                    <Icon size={17} strokeWidth={2} className="text-white"/>
                  </div>
                </div>
                <p className={`mt-4 text-3xl font-bold tracking-tight ${textColor}`}>{val}</p>
                {stats && label==="Total Analyzed" && (
                  <p className="mt-1 text-xs text-slate-400">avg score {stats.average_risk_score?.toFixed(1)}</p>
                )}
              </article>
            ))}
          </div>

          {/* ── Distribution + signals ────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">

            {/* distribution bar */}
            {dist?.total_analyzed>0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">Risk Distribution</h2>
                <div className="flex h-3 w-full overflow-hidden rounded-full">
                  {["CRITICAL","HIGH","MEDIUM","LOW"].map(l=>{
                    const pct = dist.distribution[l]?.percentage||0;
                    return pct>0 ? <div key={l} className={`${RISK[l].bar} transition-all`} style={{width:`${pct}%`}} title={`${l}: ${pct}%`}/> : null;
                  })}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {["CRITICAL","HIGH","MEDIUM","LOW"].map(l=>{
                    const d = dist.distribution[l]||{count:0,percentage:0};
                    return (
                      <div key={l} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${RISK[l].badge.replace("text-","").replace("border-","")}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${RISK[l].bar}`}/>
                          <span className={`text-xs font-semibold ${RISK[l].badge.split(" ")[1]}`}>{l}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-700">{d.count}</span>
                          <span className="ml-1 text-[10px] text-slate-400">({d.percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-right text-[11px] text-slate-400">{dist.total_analyzed} invoices analyzed</p>
              </section>
            )}

            {/* signals */}
            {stats?.most_common_fraud_types?.length>0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">Most Common Fraud Signals</h2>
                <div className="space-y-3">
                  {stats.most_common_fraud_types.slice(0,6).map(ft=>{
                    const max = stats.most_common_fraud_types[0]?.count||1;
                    const pct = (ft.count/max)*100;
                    return (
                      <div key={ft.code} className="flex items-center gap-3">
                        <span className="w-44 truncate text-xs text-slate-500" title={ft.code}>{ft.code.replace(/_/g," ")}</span>
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{width:`${pct}%`}}/>
                          </div>
                        </div>
                        <span className="w-6 text-right text-xs font-bold text-slate-600">{ft.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ── Flagged invoices table ────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Flagged Invoices</h2>
                <p className="mt-0.5 text-xs text-slate-400">Invoices with Medium risk or above</p>
              </div>
              <div className="flex gap-2">
                <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white transition">
                  <Search size={13} className="text-slate-400"/>
                  <input className="w-40 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                    placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
                </label>
                <select className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={levelFilt} onChange={e=>setLevelFilt(e.target.value)}>
                  {["All","CRITICAL","HIGH","MEDIUM"].map(l=><option key={l} value={l}>{l==="All"?"All levels":l}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>{["Invoice","Vendor","Amount","Risk Level","Score","Critical Flags","Detected",""].map(c=>(
                    <th key={c} className="px-5 py-3">{c}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Loading…</td></tr>}
                  {!loading && visible.length===0 && (
                    <tr><td colSpan={8} className="py-20 text-center">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-400">
                        <ShieldCheck size={24}/>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">
                        {highRisk.length===0?"No fraud alerts yet":"No results for this filter"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {highRisk.length===0?"Run fraud detection on your invoices to see results.":"Try adjusting your search or filter."}
                      </p>
                    </td></tr>
                  )}
                  {!loading && visible.map(inv=>(
                    <tr key={inv.invoice_id} className="transition hover:bg-indigo-50/30">
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-bold text-slate-700">#{inv.invoice_id}</p>
                        {inv.invoice_number && <p className="text-[11px] text-slate-400">{inv.invoice_number}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{inv.vendor_name||<span className="text-slate-300">Unknown</span>}</td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-800">
                        {inv.total_amount!=null ? parseFloat(inv.total_amount).toLocaleString("en-IN",{minimumFractionDigits:2}) : "—"}
                      </td>
                      <td className="px-5 py-3.5"><Badge level={inv.risk_level}/></td>
                      <td className="px-5 py-3.5"><RiskBar score={inv.risk_score}/></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl text-[11px] font-bold ${inv.critical_flags>0?"bg-rose-100 text-rose-600":"bg-slate-100 text-slate-500"}`}>
                          {inv.critical_flags??0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{fmt(inv.detection_date)}</td>
                      <td className="px-5 py-3.5">
                        <Link to={`/dashboard/invoices/${inv.invoice_id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          Review<ChevronRight size={13}/>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              <span>Showing {visible.length} flagged invoice{visible.length!==1?"s":""}</span>
              <button onClick={refresh} type="button" className="flex items-center gap-1.5 hover:text-indigo-600 transition">
                <RefreshCw size={12}/> Refresh
              </button>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
