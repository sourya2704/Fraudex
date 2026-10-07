import { Bell, ChevronDown, ChevronRight, FileText, RefreshCw, Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

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
  DOCUMENTS_UPLOADED:"Uploaded", PROCESSING:"Processing", ANALYSIS_READY:"Ready",
  UNDER_REVIEW:"Under Review", DECIDED:"Decided", PROCESSING_FAILED:"Failed", DRAFT:"Draft",
};
const RISK_STYLE = {
  CRITICAL:"bg-rose-50 text-rose-600 border-rose-200",
  HIGH:    "bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM:  "bg-amber-50 text-amber-600 border-amber-200",
  LOW:     "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const ALL_STATUSES = ["All","DOCUMENTS_UPLOADED","PROCESSING","ANALYSIS_READY","UNDER_REVIEW","DECIDED","PROCESSING_FAILED"];

function Badge({ cls, children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"; }
function fmtAmt(v,c) { return v==null?"—":`${c||""} ${parseFloat(v).toLocaleString("en-IN",{minimumFractionDigits:2})}`.trim(); }

export default function Invoices() {
  const [invoices,   setInvoices]   = useState([]);
  const [fraudMap,   setFraudMap]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [query,      setQuery]      = useState("");
  const [statusFilt, setStatusFilt] = useState("All");
  const [riskFilt,   setRiskFilt]   = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const { data } = await apiClient.get("/invoices/");
      setInvoices(data);
      const results = await Promise.allSettled(
        data.map(inv => apiClient.get(`/invoices/${inv.id}/fraud-detection`)
          .then(r => ({ id: inv.id, fraud: r.data })).catch(()=>({ id: inv.id, fraud: null })))
      );
      const map = {};
      results.forEach(r => { if (r.status==="fulfilled" && r.value.fraud) map[r.value.id]=r.value.fraud; });
      setFraudMap(map); setError(null);
    } catch(e) { setError(e.response?.data?.detail||"Failed to load invoices"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(()=>{ loadData(); },[]);
  const refresh = ()=>{ setRefreshing(true); loadData(); };

  const visible = invoices.filter(inv=>{
    const q = query.toLowerCase();
    const mQ = !query||String(inv.id).includes(q)||(inv.invoice_number||"").toLowerCase().includes(q)||(inv.vendor?.name||"").toLowerCase().includes(q);
    const mS = statusFilt==="All"||inv.status===statusFilt;
    const lvl = fraudMap[inv.id]?.risk_level;
    const mR = riskFilt==="All"||(riskFilt==="High"&&(lvl==="HIGH"||lvl==="CRITICAL"))||(riskFilt==="Medium"&&lvl==="MEDIUM")||(riskFilt==="Low"&&lvl==="LOW")||(riskFilt==="Unanalyzed"&&!lvl);
    return mQ&&mS&&mR;
  });

  const chips = [
    { label:"Total",     val:invoices.length, cls:"border-slate-200 bg-white text-slate-600" },
    { label:"Ready",     val:invoices.filter(i=>i.status==="ANALYSIS_READY").length,  cls:"border-indigo-200 bg-indigo-50 text-indigo-700" },
    { label:"High Risk", val:Object.values(fraudMap).filter(f=>f?.risk_level==="HIGH"||f?.risk_level==="CRITICAL").length, cls:"border-rose-200 bg-rose-50 text-rose-700" },
    { label:"Decided",   val:invoices.filter(i=>i.status==="DECIDED").length,          cls:"border-emerald-200 bg-emerald-50 text-emerald-700" },
  ];

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Invoices</h1>
          <div className="flex items-center gap-2">
            <button onClick={refresh} type="button" className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 ${refreshing?"animate-spin":""}`}><RefreshCw size={15}/></button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700"><Bell size={15}/></button>
            <Link to="/dashboard/upload-invoice" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25">
              <Upload size={14}/> Upload
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">

          {/* chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {chips.map(({label,val,cls})=>(
              <span key={label} className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${cls}`}>
                {val} {label}
              </span>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
              <label className="flex h-9 flex-1 min-w-52 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 focus-within:border-indigo-400 focus-within:bg-white transition">
                <Search size={14} className="text-slate-400"/>
                <input className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="Search by ID, invoice #, vendor…" value={query} onChange={e=>setQuery(e.target.value)}/>
              </label>
              <div className="relative">
                <select className="h-9 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={statusFilt} onChange={e=>setStatusFilt(e.target.value)}>
                  {ALL_STATUSES.map(s=><option key={s} value={s}>{s==="All"?"All statuses":STATUS_LABEL[s]}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" size={13}/>
              </div>
              <div className="relative">
                <select className="h-9 appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-600 outline-none focus:border-indigo-400"
                  value={riskFilt} onChange={e=>setRiskFilt(e.target.value)}>
                  {["All","High","Medium","Low","Unanalyzed"].map(r=>(
                    <option key={r} value={r}>{r==="All"?"All risk levels":r+" risk"}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" size={13}/>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>{["#","Invoice No.","Vendor","Date","Amount","Status","Risk",""].map(c=>(
                    <th key={c} className="px-5 py-3">{c}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading && <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Loading invoices…</td></tr>}
                  {error   && <tr><td colSpan={8} className="py-10 text-center text-sm text-rose-500">{error}</td></tr>}
                  {!loading&&!error&&visible.length===0 && (
                    <tr><td colSpan={8} className="py-20 text-center">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-300"><FileText size={22}/></div>
                      <p className="mt-3 text-sm font-semibold text-slate-600">No invoices found</p>
                      <p className="mt-1 text-xs text-slate-400">{query||statusFilt!=="All"||riskFilt!=="All"?"Try adjusting filters.":"Upload an invoice to get started."}</p>
                      <Link to="/dashboard/upload-invoice" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                        <Upload size={13}/> Upload Invoice
                      </Link>
                    </td></tr>
                  )}
                  {!loading&&!error&&visible.map(inv=>{
                    const fraud = fraudMap[inv.id];
                    return (
                      <tr key={inv.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-5 py-3.5 text-xs font-bold text-slate-400">#{inv.id}</td>
                        <td className="px-5 py-3.5 text-xs font-medium text-slate-700">{inv.invoice_number||<span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">{inv.vendor?.name||<span className="text-slate-300">Unknown</span>}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{fmt(inv.invoice_date)}</td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-slate-800">{fmtAmt(inv.total_amount,inv.currency)}</td>
                        <td className="px-5 py-3.5"><Badge cls={STATUS_STYLE[inv.status]||STATUS_STYLE.DRAFT}>{STATUS_LABEL[inv.status]||inv.status}</Badge></td>
                        <td className="px-5 py-3.5">
                          {fraud ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge cls={RISK_STYLE[fraud.risk_level]||""}>{fraud.risk_level}</Badge>
                              <span className="text-[10px] text-slate-400">{fraud.risk_score?.toFixed(1)} / 100</span>
                            </div>
                          ) : <span className="text-[11px] text-slate-300">Not analyzed</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <Link to={`/dashboard/invoices/${inv.id}`}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                            View<ChevronRight size={13}/>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              <span>Showing {visible.length} of {invoices.length} invoice{invoices.length!==1?"s":""}</span>
              <button onClick={refresh} type="button" className="flex items-center gap-1.5 hover:text-indigo-600">
                <RefreshCw size={12}/> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
