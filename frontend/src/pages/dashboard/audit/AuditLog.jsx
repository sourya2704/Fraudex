import {
  Activity, Bell, CheckCircle, ChevronDown, Clock,
  FileSearch, FileUp, Search, ShieldAlert, User, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Sidebar from "../../Sidebar/Sidebar";
import apiClient from "../../../api/client";

/* ── meta ─────────────────────────────────────────────────────────────────── */
const META = {
  INVOICE_UPLOADED:        { label:"Invoice Uploaded",   color:"blue",   Icon:FileUp },
  INVOICE_EXTRACTED:       { label:"Text Extracted",     color:"indigo", Icon:FileSearch },
  INVOICE_VALIDATED:       { label:"Validated",          color:"violet", Icon:CheckCircle },
  FRAUD_CHECK_RUN:         { label:"Fraud Check",        color:"orange", Icon:ShieldAlert },
  INVOICE_STATUS_CHANGED:  { label:"Status Changed",     color:"amber",  Icon:Activity },
  REVIEW_DECISION:         { label:"Review Decision",    color:"emerald",Icon:CheckCircle },
  USER_REGISTERED:         { label:"User Registered",    color:"teal",   Icon:User },
  USER_LOGIN:              { label:"User Login",         color:"slate",  Icon:User },
  USER_LOGOUT:             { label:"User Logout",        color:"slate",  Icon:User },
};

const DOT = {
  blue:"bg-blue-500", indigo:"bg-indigo-500", violet:"bg-violet-500",
  orange:"bg-orange-500", amber:"bg-amber-400", emerald:"bg-emerald-500",
  teal:"bg-teal-500", slate:"bg-slate-400", rose:"bg-rose-500",
};
const ICON_BG = {
  blue:"bg-blue-50 text-blue-600 border-blue-100",
  indigo:"bg-indigo-50 text-indigo-600 border-indigo-100",
  violet:"bg-violet-50 text-violet-600 border-violet-100",
  orange:"bg-orange-50 text-orange-600 border-orange-100",
  amber:"bg-amber-50 text-amber-500 border-amber-100",
  emerald:"bg-emerald-50 text-emerald-600 border-emerald-100",
  teal:"bg-teal-50 text-teal-600 border-teal-100",
  slate:"bg-slate-50 text-slate-500 border-slate-100",
  rose:"bg-rose-50 text-rose-600 border-rose-100",
};

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
function parseDetail(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

/* ── single row ───────────────────────────────────────────────────────────── */
function Row({ entry, isLast }) {
  const [open, setOpen] = useState(false);
  const m      = META[entry.action] || { label:entry.action, color:"slate", Icon:Activity };
  const detail = parseDetail(entry.detail);
  const riskBadge = detail?.risk_level;
  const decision  = detail?.decision;

  return (
    <div className="relative">
      {/* timeline line */}
      {!isLast && <span className="absolute left-[30px] top-[52px] bottom-0 w-px bg-slate-100"/>}

      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50/60">

        {/* dot */}
        <div className="mt-1.5 flex w-3 shrink-0 justify-center">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[m.color]}`}/>
        </div>

        {/* icon badge */}
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${ICON_BG[m.color]}`}>
          <m.Icon size={15} strokeWidth={2}/>
        </span>

        {/* content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{m.label}</span>
            {entry.invoice_id && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">
                Invoice #{entry.invoice_id}
              </span>
            )}
            {riskBadge && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                riskBadge==="CRITICAL"?"border-rose-200 bg-rose-50 text-rose-600":
                riskBadge==="HIGH"?"border-orange-200 bg-orange-50 text-orange-600":
                riskBadge==="MEDIUM"?"border-amber-200 bg-amber-50 text-amber-600":
                "border-emerald-200 bg-emerald-50 text-emerald-600"}`}>
                {riskBadge}
              </span>
            )}
            {decision && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                decision==="APPROVE"?"border-emerald-200 bg-emerald-50 text-emerald-600":
                decision==="REJECT"?"border-rose-200 bg-rose-50 text-rose-600":
                "border-amber-200 bg-amber-50 text-amber-600"}`}>
                {decision}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Clock size={10}/>{fmtTime(entry.timestamp)}</span>
            {entry.user_id && <span className="flex items-center gap-1"><User size={10}/>User {entry.user_id}</span>}
          </div>
          {!open && detail && typeof detail==="object" && (
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {Object.entries(detail).slice(0,2).map(([k,v])=>`${k}: ${v}`).join(" · ")}
            </p>
          )}
        </div>

        <ChevronDown size={14} className={`mt-1.5 shrink-0 text-slate-300 transition-transform duration-150 ${open?"rotate-180":""}`}/>
      </button>

      {/* expanded */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 pl-[72px]">
          {typeof detail==="object" && detail ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(detail).map(([k,v])=>(
                <span key={k} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-400">{k}:</span> {String(v??"")}
                </span>
              ))}
            </div>
          ) : <span className="text-xs text-slate-500">{detail}</span>}
          {detail?.reason && (
            <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs italic text-slate-600">
              "{detail.reason}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── stats bar ────────────────────────────────────────────────────────────── */
function StatsBar({ logs }) {
  const c = logs.reduce((a,e)=>{ a[e.action]=(a[e.action]||0)+1; return a; },{});
  const cards = [
    { label:"Total Events",     val:logs.length,                  color:"indigo" },
    { label:"Uploads",          val:c["INVOICE_UPLOADED"]||0,     color:"blue"   },
    { label:"Fraud Checks",     val:c["FRAUD_CHECK_RUN"]||0,      color:"orange" },
    { label:"Review Decisions", val:c["REVIEW_DECISION"]||0,      color:"emerald"},
  ];
  const numColor = { indigo:"text-indigo-600", blue:"text-blue-600", orange:"text-orange-500", emerald:"text-emerald-600" };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({label,val,color})=>(
        <div key={label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${DOT[color]} opacity-60`}/>
          <p className={`text-2xl font-bold ${numColor[color]}`}>{val}</p>
          <p className="mt-1 text-xs text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── filter bar ───────────────────────────────────────────────────────────── */
const QUICK = ["ALL","INVOICE_UPLOADED","FRAUD_CHECK_RUN","REVIEW_DECISION","USER_LOGIN"];

function FilterBar({ sel, onSel, search, onSearch }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input
          className="h-9 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          placeholder="Search action or invoice…" value={search} onChange={e=>onSearch(e.target.value)}/>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(a=>(
          <button key={a} type="button" onClick={()=>onSel(a)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
              sel===a
                ?"border-indigo-500 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                :"border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}>
            {a==="ALL"?"All events":META[a]?.label||a}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────────────── */
export default function AuditLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("ALL");
  const [search,  setSearch]  = useState("");
  const [invFilt, setInvFilt] = useState("");

  useEffect(()=>{
    const p = filter!=="ALL" ? {action:filter,limit:200} : {limit:200};
    apiClient.get("/audit/",{params:p})
      .then(r=>{ setLogs(r.data); setLoading(false); })
      .catch(e=>{ setError(e.response?.data?.detail||"Failed to load audit log"); setLoading(false); });
  },[filter]);

  const visible = logs.filter(e=>{
    const q = search.toLowerCase();
    const mS = !search||e.action.toLowerCase().includes(q)||String(e.invoice_id||"").includes(q)||(e.detail||"").toLowerCase().includes(q);
    const mI = !invFilt||String(e.invoice_id)===invFilt;
    return mS&&mI;
  });

  const invIds = [...new Set(logs.map(e=>e.invoice_id).filter(Boolean))];

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Activity size={14}/></div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Audit Log</h1>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white hover:text-slate-700"><Search size={15}/></button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white hover:text-slate-700"><Bell size={15}/></button>
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-5 px-5 py-7 sm:px-8">

          {!loading && !error && <StatsBar logs={logs}/>}

          <FilterBar sel={filter} onSel={setFilter} search={search} onSearch={setSearch}/>

          {/* invoice ID chips */}
          {invIds.length>0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Filter by invoice:</span>
              {invIds.slice(0,12).map(id=>(
                <button key={id} type="button"
                  onClick={()=>setInvFilt(invFilt===String(id)?"":String(id))}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${invFilt===String(id)?"border-indigo-500 bg-indigo-500 text-white":"border-slate-200 bg-white text-slate-500 hover:border-indigo-300"}`}>
                  #{id}
                </button>
              ))}
              {invFilt && (
                <button type="button" onClick={()=>setInvFilt("")}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
                  <XCircle size={12}/> Clear
                </button>
              )}
            </div>
          )}

          {/* timeline card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Event Timeline</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                {visible.length} event{visible.length!==1?"s":""}
              </span>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"/>
                Loading events…
              </div>
            )}

            {error && (
              <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <strong>Error:</strong> {error}
                {error.includes("permission") && <p className="mt-1 text-xs">System-wide audit log requires ADMIN role.</p>}
              </div>
            )}

            {!loading && !error && visible.length===0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><Activity size={22}/></div>
                <p className="text-sm font-semibold text-slate-500">No events found</p>
                <p className="text-xs text-slate-400">Try adjusting your filters</p>
              </div>
            )}

            {!loading && !error && visible.map((entry,i)=>(
              <Row key={entry.id} entry={entry} isLast={i===visible.length-1}/>
            ))}
          </div>

        </div>
      </div>
    </main>
  );
}
