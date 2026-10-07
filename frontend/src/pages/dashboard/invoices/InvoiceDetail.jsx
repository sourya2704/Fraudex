import {
  Activity, AlertTriangle, Bell, CheckCircle2,
  ChevronLeft, Clock, FileSearch, FileText,
  RefreshCw, ShieldAlert, ShieldCheck, User, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

/* ── helpers ──────────────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  DOCUMENTS_UPLOADED:"bg-blue-50 text-blue-600 border-blue-200",
  PROCESSING:"bg-amber-50 text-amber-600 border-amber-200",
  ANALYSIS_READY:"bg-indigo-50 text-indigo-600 border-indigo-200",
  UNDER_REVIEW:"bg-violet-50 text-violet-600 border-violet-200",
  DECIDED:"bg-emerald-50 text-emerald-600 border-emerald-200",
  PROCESSING_FAILED:"bg-rose-50 text-rose-600 border-rose-200",
  DRAFT:"bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABEL = {
  DOCUMENTS_UPLOADED:"Uploaded", PROCESSING:"Processing", ANALYSIS_READY:"Analysis Ready",
  UNDER_REVIEW:"Under Review", DECIDED:"Decided", PROCESSING_FAILED:"Failed", DRAFT:"Draft",
};
const RISK_STYLE = {
  CRITICAL:"bg-rose-50 text-rose-600 border-rose-200",
  HIGH:"bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM:"bg-amber-50 text-amber-600 border-amber-200",
  LOW:"bg-emerald-50 text-emerald-600 border-emerald-200",
};
const SEV_STYLE = {
  CRITICAL:"bg-rose-100 text-rose-700", HIGH:"bg-orange-100 text-orange-700",
  MEDIUM:"bg-amber-100 text-amber-700", LOW:"bg-blue-100 text-blue-700", INFO:"bg-slate-100 text-slate-500",
};
const SEV_DOT = {
  CRITICAL:"bg-rose-500", HIGH:"bg-orange-500", MEDIUM:"bg-amber-400", LOW:"bg-blue-400", INFO:"bg-slate-400",
};
const ACTION_DOT = {
  INVOICE_UPLOADED:"bg-blue-400", INVOICE_EXTRACTED:"bg-indigo-400",
  INVOICE_VALIDATED:"bg-violet-400", FRAUD_CHECK_RUN:"bg-orange-400",
  INVOICE_STATUS_CHANGED:"bg-amber-400", REVIEW_DECISION:"bg-emerald-500",
};
const ACTION_LABEL = {
  INVOICE_UPLOADED:"Uploaded", INVOICE_EXTRACTED:"Text extracted",
  INVOICE_VALIDATED:"Validated", FRAUD_CHECK_RUN:"Fraud check",
  INVOICE_STATUS_CHANGED:"Status changed", REVIEW_DECISION:"Review decision",
};

function Badge({ cls, children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"; }
function fmtAmt(v,c) { return v==null?"—":`${c||""} ${parseFloat(v).toLocaleString("en-IN",{minimumFractionDigits:2})}`.trim(); }
function fmtTs(ts) { return ts ? new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"; }

/* ── Field tile ───────────────────────────────────────────────────────────── */
function FieldTile({ label, value, warn }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1.5 text-sm font-semibold ${warn ? "text-rose-500" : value&&value!=="—" ? "text-slate-800" : "text-slate-300"}`}>
        {value||"—"}
      </p>
    </div>
  );
}

/* ── Risk score ring ──────────────────────────────────────────────────────── */
function RiskRing({ score, level }) {
  const pct = Math.min(100, Math.max(0, score||0));
  const r = 38; const circ = 2*Math.PI*r;
  const dash = (pct/100)*circ;
  const col = level==="CRITICAL"?"#ef4444":level==="HIGH"?"#f97316":level==="MEDIUM"?"#f59e0b":"#10b981";
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{transition:"stroke-dasharray 0.7s ease"}}/>
        <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="800" fill={col}>{pct.toFixed(0)}</text>
      </svg>
      {level && <Badge cls={RISK_STYLE[level]||""}>{level}</Badge>}
      <p className="text-[11px] text-slate-400">out of 100</p>
    </div>
  );
}

/* ── Fraud flags ──────────────────────────────────────────────────────────── */
function FraudFlags({ flags }) {
  const [open, setOpen] = useState(null);
  if (!flags?.length) return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><ShieldCheck size={22}/></div>
      <p className="mt-3 text-sm font-semibold text-slate-600">No fraud flags detected</p>
      <p className="mt-1 text-xs text-slate-400">Invoice passed all fraud checks</p>
    </div>
  );
  const order = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,INFO:4};
  return (
    <div className="space-y-2">
      {[...flags].sort((a,b)=>(order[a.severity]??5)-(order[b.severity]??5)).map((f,i)=>(
        <div key={i} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <button type="button"
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            onClick={()=>setOpen(open===i?null:i)}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[f.severity]||"bg-slate-400"}`}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${SEV_STYLE[f.severity]}`}>{f.severity}</span>
                <span className="text-xs font-semibold text-slate-700">{f.code.replace(/_/g," ")}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{f.message}</p>
            </div>
            <span className="mt-0.5 text-[10px] text-slate-300">{open===i?"▲":"▼"}</span>
          </button>
          {open===i && f.evidence && Object.keys(f.evidence).length>0 && (
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Evidence</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(f.evidence).map(([k,v])=>(
                  <span key={k} className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-400">{k}:</span> {String(v??"—")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Validation ───────────────────────────────────────────────────────────── */
function Validation({ result }) {
  if (!result) return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><CheckCircle2 size={22}/></div>
      <p className="mt-3 text-xs text-slate-400">Run fraud check to see validation results</p>
    </div>
  );
  const { valid, issues } = result;
  if (!issues?.length) return (
    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      <CheckCircle2 size={16}/> All validation checks passed
    </div>
  );
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold ${valid?"bg-amber-50 text-amber-700":"bg-rose-50 text-rose-700"}`}>
        {valid?<AlertTriangle size={14}/>:<XCircle size={14}/>}
        {valid?`Valid with ${issues.length} warning(s)`:`${result.error_count} error(s), ${result.warning_count} warning(s)`}
      </div>
      {issues.map((iss,i)=>(
        <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${iss.severity==="ERROR"?"border-rose-100 bg-rose-50/60":"border-amber-100 bg-amber-50/60"}`}>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${iss.severity==="ERROR"?"bg-rose-500":"bg-amber-400"}`}/>
          <div>
            <p className="text-xs font-semibold text-slate-700">{iss.code.replace(/_/g," ")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{iss.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Audit timeline ───────────────────────────────────────────────────────── */
function Timeline({ logs }) {
  if (!logs?.length) return <p className="text-xs text-slate-400">No audit events yet</p>;
  return (
    <div className="space-y-1">
      {logs.map((e,i)=>{
        let detail = null;
        try { detail = e.detail ? JSON.parse(e.detail) : null; } catch {}
        return (
          <div key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ACTION_DOT[e.action]||"bg-slate-300"}`}/>
              {i<logs.length-1 && <span className="mt-1 w-px flex-1 bg-slate-100"/>}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-xs font-semibold text-slate-700">{ACTION_LABEL[e.action]||e.action}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmtTs(e.timestamp)}</p>
              {detail && typeof detail==="object" && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(detail).slice(0,3).map(([k,v])=>(
                    <span key={k} className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Review form ──────────────────────────────────────────────────────────── */
function ReviewForm({ invoiceId, existingReview, onReviewed }) {
  const [decision,    setDecision]    = useState(existingReview?.decision||"");
  const [reason,      setReason]      = useState(existingReview?.reason||"");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!decision||!reason.trim()) { setError("Both decision and reason are required."); return; }
    setError(""); setSubmitting(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/review`, { decision, reason });
      setSuccess(true); onReviewed();
    } catch(err) { setError(err.response?.data?.detail||"Failed to submit review"); }
    finally { setSubmitting(false); }
  }

  if (success) return (
    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      <CheckCircle2 size={16}/> Review submitted successfully
    </div>
  );

  const decisions = [
    { v:"APPROVE",                l:"Approve",              idle:"border-emerald-200 bg-emerald-50 text-emerald-700",  active:"border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25" },
    { v:"REJECT",                 l:"Reject",               idle:"border-rose-200 bg-rose-50 text-rose-700",           active:"border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-500/25" },
    { v:"REQUEST_FURTHER_REVIEW", l:"Request Further Review",idle:"border-amber-200 bg-amber-50 text-amber-700",       active:"border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/25" },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      {existingReview && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700">
          <strong>Previous:</strong> {existingReview.decision} — "{existingReview.reason}"
          <p className="mt-0.5 text-indigo-400">Submitting again will overwrite this.</p>
        </div>
      )}
      <div>
        <p className="mb-2.5 text-xs font-semibold text-slate-600">Decision *</p>
        <div className="flex flex-wrap gap-2">
          {decisions.map(d=>(
            <button key={d.v} type="button" onClick={()=>setDecision(d.v)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${decision===d.v?d.active:d.idle}`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="rev-reason">
          Reason * <span className="font-normal text-slate-400">(recorded in audit trail)</span>
        </label>
        <textarea id="rev-reason" rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          placeholder="Explain your decision…"
          value={reason} onChange={e=>setReason(e.target.value)}/>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={submitting||!decision||!reason.trim()}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50">
        <ShieldCheck size={15}/>
        {submitting?"Submitting…":"Submit Review"}
      </button>
    </form>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function InvoiceDetail() {
  const { invoiceId }                     = useParams();
  const [invoice,   setInvoice]           = useState(null);
  const [fraud,     setFraud]             = useState(null);
  const [validation,setValidation]        = useState(null);
  const [audit,     setAudit]             = useState([]);
  const [review,    setReview]            = useState(null);
  const [loading,   setLoading]           = useState(true);
  const [error,     setError]             = useState(null);
  const [runningFraud,   setRunFraud]     = useState(false);
  const [runningExtract, setRunExtract]   = useState(false);
  const [refreshing,     setRefreshing]   = useState(false);

  async function loadAll() {
    const [iR,fR,aR,rR] = await Promise.allSettled([
      apiClient.get(`/invoices/${invoiceId}`),
      apiClient.get(`/invoices/${invoiceId}/fraud-detection`),
      apiClient.get(`/audit/${invoiceId}`),
      apiClient.get(`/invoices/${invoiceId}/review`),
    ]);
    if (iR.status==="fulfilled") setInvoice(iR.value.data); else setError("Invoice not found");
    if (fR.status==="fulfilled") setFraud(fR.value.data);
    if (aR.status==="fulfilled") setAudit(aR.value.data);
    if (rR.status==="fulfilled") setReview(rR.value.data);
    setLoading(false); setRefreshing(false);
  }

  useEffect(()=>{ loadAll(); },[invoiceId]);

  async function runExtract() {
    setRunExtract(true);
    try { await apiClient.post(`/invoices/${invoiceId}/extract`); await loadAll(); }
    finally { setRunExtract(false); }
  }
  async function runFraudCheck() {
    setRunFraud(true);
    try {
      const r = await apiClient.post(`/invoices/${invoiceId}/detect-fraud`); setFraud(r.data);
      const v = await apiClient.post(`/invoices/${invoiceId}/validate`); setValidation(v.data.validation);
      const a = await apiClient.get(`/audit/${invoiceId}`); setAudit(a.data);
    } finally { setRunFraud(false); }
  }

  if (loading) return (
    <main className="flex min-h-screen bg-[#f5f6fb]"><Sidebar expanded/>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"/>
          <p className="text-sm text-slate-400">Loading invoice…</p>
        </div>
      </div>
    </main>
  );
  if (error||!invoice) return (
    <main className="flex min-h-screen bg-[#f5f6fb]"><Sidebar expanded/>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-600">{error||"Invoice not found"}</p>
        <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-600 hover:underline">← Back to invoices</Link>
      </div>
    </main>
  );

  const fc = fraud ? {critical:fraud.critical_count,high:fraud.high_count,medium:fraud.medium_count,low:fraud.low_count} : null;

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/invoices" className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600 transition">
              <ChevronLeft size={15}/> Invoices
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-bold text-slate-800">
              Invoice #{invoiceId}
              {invoice.invoice_number && <span className="ml-2 font-normal text-slate-400">· {invoice.invoice_number}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge cls={STATUS_STYLE[invoice.status]||STATUS_STYLE.DRAFT}>{STATUS_LABEL[invoice.status]||invoice.status}</Badge>
            <button onClick={()=>{setRefreshing(true);loadAll();}} type="button"
              className={`grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={13}/>
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400">
              <Bell size={13}/>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:px-8">

          {/* ── Row 1: fields + risk ring ──────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1fr_200px]">

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><FileText size={14}/></div>
                  Extracted Invoice Data
                </h2>
                {invoice.status==="DOCUMENTS_UPLOADED" && (
                  <button onClick={runExtract} disabled={runningExtract} type="button"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50">
                    <FileSearch size={13}/>{runningExtract?"Extracting…":"Run Extraction"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <FieldTile label="Invoice Number" value={invoice.invoice_number}/>
                <FieldTile label="Invoice Date"   value={fmt(invoice.invoice_date)}/>
                <FieldTile label="Due Date"       value={fmt(invoice.due_date)}/>
                <FieldTile label="Subtotal"       value={fmtAmt(invoice.subtotal,invoice.currency)}/>
                <FieldTile label="Tax"            value={fmtAmt(invoice.tax,invoice.currency)}/>
                <FieldTile label="Total Amount"   value={fmtAmt(invoice.total_amount,invoice.currency)} warn={!invoice.total_amount}/>
                <FieldTile label="Currency"       value={invoice.currency} warn={!invoice.currency}/>
                <FieldTile label="Uploaded"       value={fmtTs(invoice.created_at)}/>
                <FieldTile label="Last Updated"   value={fmtTs(invoice.updated_at)}/>
              </div>
              {invoice.items?.length>0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold text-slate-500">Line Items ({invoice.items.length})</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>{["Description","Qty","Unit Price","Tax","Line Total"].map(c=><th key={c} className="px-3 py-2">{c}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {invoice.items.map((it,i)=>(
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-slate-700">{it.description||"—"}</td>
                            <td className="px-3 py-2.5 text-slate-500">{it.quantity??"-"}</td>
                            <td className="px-3 py-2.5 text-slate-500">{fmtAmt(it.unit_price,invoice.currency)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{fmtAmt(it.tax,invoice.currency)}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{fmtAmt(it.line_total,invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Risk ring */}
            <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="self-start text-sm font-semibold text-slate-900">Risk Score</h2>
              {fraud ? (
                <>
                  <RiskRing score={fraud.risk_score} level={fraud.risk_level}/>
                  <div className="w-full space-y-2 border-t border-slate-100 pt-3">
                    {[["Critical",fc.critical,"text-rose-600"],["High",fc.high,"text-orange-500"],["Medium",fc.medium,"text-amber-500"],["Low",fc.low,"text-emerald-600"]].map(([l,v,c])=>(
                      <div key={l} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{l}</span>
                        <span className={`font-bold ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">
                    {runningFraud?"Running…":"Re-run Check"}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-300"><ShieldAlert size={26}/></div>
                  <p className="text-xs text-slate-400">Not analyzed yet</p>
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {runningFraud?"Running…":"Run Fraud Check"}
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* ── Row 2: fraud flags + validation ───────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-orange-50 text-orange-500"><ShieldAlert size={14}/></div>
                Fraud Flags
                {fraud && <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{fraud.fraud_flags?.length||0}</span>}
              </h2>
              {fraud ? <FraudFlags flags={fraud.fraud_flags}/> : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><ShieldAlert size={22}/></div>
                  <p className="mt-3 text-xs text-slate-400">Run fraud detection to see results</p>
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-violet-600"><CheckCircle2 size={14}/></div>
                Validation
              </h2>
              <Validation result={validation}/>
            </section>
          </div>

          {/* ── Row 3: review + audit ──────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><User size={14}/></div>
                Human Review
              </h2>
              {review && (
                <div className={`mb-4 rounded-xl border px-4 py-3 ${review.decision==="APPROVE"?"border-emerald-200 bg-emerald-50":review.decision==="REJECT"?"border-rose-200 bg-rose-50":"border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white ${review.decision==="APPROVE"?"bg-emerald-500":review.decision==="REJECT"?"bg-rose-500":"bg-amber-400"}`}>
                      {review.decision}
                    </span>
                    <span className="text-slate-400">{fmtTs(review.reviewed_at)}</span>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-600">"{review.reason}"</p>
                </div>
              )}
              <ReviewForm invoiceId={invoiceId} existingReview={review} onReviewed={loadAll}/>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Activity size={14}/></div>
                Audit Trail
                <Link to="/dashboard/audit" className="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline">Full log →</Link>
              </h2>
              <div className="max-h-72 overflow-y-auto pr-1">
                <Timeline logs={audit}/>
              </div>
            </section>
          </div>

        </div>
      </div>
    </main>
  );
}
